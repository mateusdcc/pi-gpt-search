export type WebSearchErrorCode =
  | "CODEX_AUTH_MISSING"
  | "CODEX_AUTH_EXPIRED"
  | "CODEX_RATE_LIMIT"
  | "CODEX_HTTP_ERROR"
  | "WEB_SEARCH_TIMEOUT"
  | "WEB_SEARCH_CANCELLED";

export class WebSearchError extends Error {
  constructor(
    message: string,
    public readonly code: WebSearchErrorCode
  ) {
    super(message);
    this.name = "WebSearchError";
  }
}

export const CodexAuthMissingError = () =>
  new WebSearchError(
    "Codex-backed web search is unavailable because Codex is not authenticated. Please run 'codex login' in your terminal or configure CODEX_ACCESS_TOKEN in .env.",
    "CODEX_AUTH_MISSING"
  );

export const CodexAuthExpiredError = () =>
  new WebSearchError(
    "Codex authentication expired or unauthorized. Please run 'codex login' to re-authenticate.",
    "CODEX_AUTH_EXPIRED"
  );

export const CodexRateLimitError = () =>
  new WebSearchError(
    "Codex web search rate limit exceeded. Please wait before retrying.",
    "CODEX_RATE_LIMIT"
  );

export const CodexHttpError = (statusCode: number, details: string) =>
  new WebSearchError(`Codex search HTTP ${statusCode}: ${details}`, "CODEX_HTTP_ERROR");

export const WebSearchTimeoutError = (ms: number) =>
  new WebSearchError(`Web search request timed out after ${ms}ms`, "WEB_SEARCH_TIMEOUT");

export const WebSearchCancelledError = () =>
  new WebSearchError("Web search request was cancelled", "WEB_SEARCH_CANCELLED");
