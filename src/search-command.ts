import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { WebSearchProvider } from "./provider.js";
import { formatWebToolResult } from "./output.js";

export const SEARCH_OUTPUT_ENTRY_TYPE = "gpt-search-output";

interface SearchOutputEntry {
  text: string;
}

export function registerSearchCommand(pi: ExtensionAPI, provider: WebSearchProvider): void {
  pi.registerEntryRenderer(SEARCH_OUTPUT_ENTRY_TYPE, (entry, _options, theme) => {
    const { text } = entry.data as SearchOutputEntry;
    return new Text(theme.fg("toolOutput", text), 1, 0);
  });

  pi.registerCommand("gpt-search", {
    description: "Search the web directly using Codex standalone web search engine",
    handler: async (args, ctx) => {
      const query = args.trim();
      if (!query) {
        ctx.ui.notify("Please provide a search query. Example: /gpt-search Rust 1.97 release notes", "warning");
        return;
      }

      ctx.ui.setStatus("gpt-search", `Searching web for "${query}"...`);
      try {
        const command = { search_query: [{ q: query }] };
        const response = await provider.execute(command, undefined, ctx.signal);
        const text = formatWebToolResult(command, response).content[0].text;

        pi.appendEntry(SEARCH_OUTPUT_ENTRY_TYPE, { text });
        ctx.ui.notify(`Web action succeeded (${response.results.length} results)`, "info");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`Search failed: ${message}`, "error");
      } finally {
        ctx.ui.setStatus("gpt-search", undefined);
      }
    },
  });
}
