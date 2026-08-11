import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodexWebSearchProvider } from "./codex-provider";
import { createResearchTool } from "./research-tool";
import { createSearchTool } from "./search-tool";
import { createLegacyWebTool } from "./legacy-web-tool";
import { formatWebToolResult } from "./output";

export default function (pi: ExtensionAPI) {
  const provider = new CodexWebSearchProvider();

  // Register codex-research harness tool
  pi.registerTool(createResearchTool(provider));

  // Register codex-search single-query wrapper
  pi.registerTool(createSearchTool(provider));

  // Register legacy `web` alias (deprecated, delegates to codex-research)
  pi.registerTool(createLegacyWebTool(provider));

  // Register /gpt-search slash command
  pi.registerCommand("gpt-search", {
    description: "Search the web directly using Codex standalone web search engine",
    handler: async (args, ctx) => {
      const query = args ? args.trim() : "";
      if (!query) {
        ctx.ui.notify("Please provide a search query. Example: /gpt-search Rust 1.97 release notes", "warning");
        return;
      }

      ctx.ui.setStatus("gpt-search", `Searching web for "${query}"...`);
      try {
        const command = { search_query: [{ q: query }] };
        const response = await provider.execute(command, undefined, ctx.signal);
        ctx.ui.setStatus("gpt-search", undefined);

        const formatted = formatWebToolResult(command, response);
        const textOutput = formatted.content[0].text;
        ctx.ui.notify(`Web action succeeded (${response.results.length} results)`, "info");

        if ("print" in ctx.ui && typeof (ctx.ui as { print?: (text: string) => void }).print === "function") {
          (ctx.ui as { print: (text: string) => void }).print(textOutput);
        } else {
          console.log(textOutput);
        }
      } catch (err) {
        ctx.ui.setStatus("gpt-search", undefined);
        const errorMsg = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Search failed: ${errorMsg}`, "error");
      }
    },
  });
}
