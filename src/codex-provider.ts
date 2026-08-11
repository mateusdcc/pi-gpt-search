import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { SearchRequest, SearchExecutionOptions, WebSearchProvider } from "./provider";
import { normalizeSearchResponseBody, type SearchResponse } from "./normalize";
import {
  validateWebRunCommand,
  serializeWebRunPayload,
  type WebRunCommand,
  type SearchQuery,
} from "./commands";
import {
  CodexAuthMissingError,
  CodexAuthExpiredError,
  CodexRateLimitError,
  CodexHttpError,
  WebSearchTimeoutError,
  WebSearchCancelledError,
} from "./errors";

export interface CodexAuthCredentials {
  accessToken: string;
  accountId?: string;
}

export function loadEnvFile(envPath?: string): void {
  const targetPath = envPath ?? path.join(process.cwd(), ".env");
  if (!fs.existsSync(targetPath)) return;
  try {
    const content = fs.readFileSync(targetPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch {
    // Ignore read errors
  }
}

export function loadCodexAuth(): CodexAuthCredentials | null {
  loadEnvFile();

  if (process.env.CODEX_ACCESS_TOKEN) {
    return {
      accessToken: process.env.CODEX_ACCESS_TOKEN,
      accountId: process.env.CODEX_ACCOUNT_ID,
    };
  }

  const authPath = path.join(os.homedir(), ".codex", "auth.json");
  if (!fs.existsSync(authPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(authPath, "utf8");
    const parsed = JSON.parse(raw);
    const accessToken = parsed.tokens?.access_token;
    if (typeof accessToken !== "string" || !accessToken) {
      return null;
    }
    const accountId = typeof parsed.tokens?.account_id === "string" ? parsed.tokens.account_id : undefined;
    return { accessToken, accountId };
  } catch {
    return null;
  }
}

export interface CodexWebSearchProviderOptions {
  endpoint?: string;
  timeoutMs?: number;
  customFetch?: typeof fetch;
  sessionId?: string;
  model?: string;
  maxRetries?: number;
}

const DEFAULT_ENDPOINT = "https://chatgpt.com/backend-api/codex/alpha/search";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MODEL = "gpt-4o";

export class CodexWebSearchProvider implements WebSearchProvider {
  private endpoint: string;
  private timeoutMs: number;
  private fetchImpl: typeof fetch;
  private currentSessionId: string;
  private model: string;
  private maxRetries: number;

  constructor(options?: CodexWebSearchProviderOptions) {
    this.endpoint = options?.endpoint ?? DEFAULT_ENDPOINT;
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options?.customFetch ?? globalThis.fetch;
    this.model = options?.model ?? DEFAULT_MODEL;
    this.maxRetries = options?.maxRetries ?? 2;
    this.currentSessionId =
      options?.sessionId ?? `search_session_${Math.random().toString(36).substring(2, 10)}`;
  }

  getSessionId(): string {
    return this.currentSessionId;
  }

  setSessionId(id: string): void {
    if (id && id.trim()) {
      this.currentSessionId = id.trim();
    }
  }

  async search(request: SearchRequest, signal?: AbortSignal): Promise<SearchResponse> {
    const searchQuery: SearchQuery = { q: request.query };
    if (request.recency !== undefined) {
      searchQuery.recency = request.recency;
    }
    if (request.domains && request.domains.length > 0) {
      searchQuery.domains = request.domains;
    }
    const command: WebRunCommand = { search_query: [searchQuery] };
    if (request.response_length) {
      command.response_length = request.response_length;
    }
    return this.execute(command, undefined, signal);
  }

  async execute(
    command: WebRunCommand,
    options?: SearchExecutionOptions,
    signal?: AbortSignal
  ): Promise<SearchResponse> {
    const validatedCmd = validateWebRunCommand(command);
    const auth = loadCodexAuth();
    if (!auth) {
      throw CodexAuthMissingError();
    }

    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    if (signal) {
      if (signal.aborted) {
        throw WebSearchCancelledError();
      }
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    timeoutId = setTimeout(() => controller.abort("timeout"), this.timeoutMs);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": "codex-cli/0.147.0-alpha.6.5",
    };
    if (auth.accountId) {
      headers["ChatGPT-Account-ID"] = auth.accountId;
    }

    const sessionId = options?.sessionId ?? this.currentSessionId;
    const payload = serializeWebRunPayload(validatedCmd, {
      sessionId,
      model: this.model,
    });

    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(2, 9);

    if (process.env.PI_WEB_SEARCH_DEBUG) {
      console.error(
        `[PI_WEB_SEARCH_DEBUG] req_id=${requestId} session_id=${sessionId} cmd=${JSON.stringify(
          validatedCmd
        )} provider=codex`
      );
    }

    try {
      let response: Response | null = null;
      let attempt = 0;

      while (attempt <= this.maxRetries) {
        attempt++;
        response = await this.fetchImpl(this.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (response.status === 502 || response.status === 503 || response.status === 504) {
          if (attempt <= this.maxRetries) {
            await new Promise((res) => setTimeout(res, 500 * attempt));
            continue;
          }
        }
        break;
      }

      if (!response) {
        throw CodexHttpError(500, "No response received");
      }

      const elapsedMs = Date.now() - startTime;

      if (response.status === 401 || response.status === 403) {
        if (process.env.PI_WEB_SEARCH_DEBUG) {
          console.error(`[PI_WEB_SEARCH_DEBUG] req_id=${requestId} status=${response.status} auth_failed`);
        }
        throw CodexAuthExpiredError();
      }

      if (response.status === 429) {
        if (process.env.PI_WEB_SEARCH_DEBUG) {
          console.error(`[PI_WEB_SEARCH_DEBUG] req_id=${requestId} status=429 rate_limited`);
        }
        throw CodexRateLimitError();
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        if (process.env.PI_WEB_SEARCH_DEBUG) {
          console.error(`[PI_WEB_SEARCH_DEBUG] req_id=${requestId} status=${response.status} error="${text}"`);
        }
        throw CodexHttpError(response.status, text.slice(0, 200));
      }

      const body = await response.json();
      const normalized = normalizeSearchResponseBody(body);

      if (process.env.PI_WEB_SEARCH_DEBUG) {
        console.error(
          `[PI_WEB_SEARCH_DEBUG] req_id=${requestId} status=200 elapsed_ms=${elapsedMs} results=${normalized.results.length} output_len=${normalized.output?.length ?? 0}`
        );
      }

      return normalized;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        if (controller.signal.reason === "timeout") {
          throw WebSearchTimeoutError(this.timeoutMs);
        }
        throw WebSearchCancelledError();
      }
      if (err instanceof Error && "code" in err && typeof (err as { code: unknown }).code === "string") {
        throw err;
      }
      throw err;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
