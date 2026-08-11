import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import {
  InvalidCommandError,
  validateSearchToolRequest,
  validateWebRunCommand,
  type SearchToolRequest,
  type WebRunCommand,
} from "./commands.js";
import type { SearchResponse } from "./normalize.js";
import { formatWebToolResult } from "./output.js";
import type { WebSearchProvider } from "./provider.js";
import { describeCommandStatus, formatSearchResponseText } from "./web-format.js";

export const SEARCH_OUTPUT_ENTRY_TYPE = "gpt-search-output";

interface SearchOutputEntry {
  text: string;
}

interface CommandContext {
  signal?: AbortSignal;
  ui: {
    notify: (message: string, level: "info" | "warning" | "error") => void;
    setStatus: (key: string, value: string | undefined) => void;
  };
}

type CommandHandler = (args: string, ctx: CommandContext) => Promise<void>;

function parseJson(value: string, command: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new InvalidCommandError(`${command} expects valid JSON parameters`);
  }
}

function parseSearchArgs(args: string) {
  const value = args.trim();
  if (!value) throw new InvalidCommandError("Please provide a search query");
  return validateSearchToolRequest(value.startsWith("{") ? parseJson(value, "/codex-search") : { query: value });
}

function parseResearchArgs(args: string): WebRunCommand {
  const value = args.trim();
  if (!value) throw new InvalidCommandError("Please provide a query or JSON research command");
  return validateWebRunCommand(value.startsWith("{") ? parseJson(value, "/codex-research") : { search_query: [{ q: value }] });
}

function toSearchCommand(request: SearchToolRequest): WebRunCommand {
  const searchQuery = {
    q: request.query,
    ...(request.recency === undefined ? {} : { recency: request.recency }),
    ...(request.domains === undefined ? {} : { domains: request.domains }),
  };
  return { search_query: [searchQuery], response_length: request.response_length };
}

function appendOutput(pi: ExtensionAPI, text: string): void {
  pi.appendEntry(SEARCH_OUTPUT_ENTRY_TYPE, { text });
}

function statusFor(command: WebRunCommand): string {
  return describeCommandStatus(command);
}

async function runCommand(
  pi: ExtensionAPI,
  name: string,
  ctx: CommandContext,
  command: WebRunCommand,
  execute: () => Promise<SearchResponse>,
  format: (response: SearchResponse) => string
): Promise<void> {
  ctx.ui.setStatus(name, statusFor(command));
  try {
    const response = await execute();
    appendOutput(pi, format(response));
    ctx.ui.notify(`Web action succeeded (${response.results.length} results)`, "info");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(`Web action failed: ${message}`, "error");
  } finally {
    ctx.ui.setStatus(name, undefined);
  }
}

function registerCommand(pi: ExtensionAPI, name: string, description: string, handler: CommandHandler): void {
  pi.registerCommand(name, { description, handler });
}

export function registerSearchCommand(pi: ExtensionAPI, provider: WebSearchProvider): void {
  pi.registerEntryRenderer(SEARCH_OUTPUT_ENTRY_TYPE, (entry, _options, theme) => {
    const { text } = entry.data as SearchOutputEntry;
    return new Text(theme.fg("toolOutput", text), 1, 0);
  });

  registerCommand(pi, "gpt-search", "Search the web directly using Codex", async (args, ctx) => {
    let command: WebRunCommand;
    try {
      command = toSearchCommand(parseSearchArgs(args));
    } catch (error) {
      ctx.ui.notify(error instanceof Error ? error.message : String(error), "warning");
      return;
    }
    await runCommand(
      pi,
      "gpt-search",
      ctx,
      command,
      () => provider.execute(command, undefined, ctx.signal),
      (response) => formatWebToolResult(command, response).content[0].text
    );
  });

  registerCommand(pi, "codex-search", "Run the codex-search tool directly", async (args, ctx) => {
    let request: SearchToolRequest;
    try {
      const parsed = parseSearchArgs(args);
      request = { ...parsed, response_length: parsed.response_length ?? "short" };
    } catch (error) {
      ctx.ui.notify(error instanceof Error ? error.message : String(error), "warning");
      return;
    }
    const command = toSearchCommand(request);
    await runCommand(
      pi,
      "codex-search",
      ctx,
      command,
      () => provider.search(request, ctx.signal),
      (response) => formatSearchResponseText(request.query, response)
    );
  });

  registerCommand(pi, "codex-research", "Run the codex-research tool directly", async (args, ctx) => {
    let command: WebRunCommand;
    try {
      const parsed = parseResearchArgs(args);
      command = { ...parsed, response_length: parsed.response_length ?? "long" };
    } catch (error) {
      ctx.ui.notify(error instanceof Error ? error.message : String(error), "warning");
      return;
    }
    await runCommand(
      pi,
      "codex-research",
      ctx,
      command,
      () => provider.execute(command, undefined, ctx.signal),
      (response) => formatWebToolResult(command, response).content[0].text
    );
  });
}
