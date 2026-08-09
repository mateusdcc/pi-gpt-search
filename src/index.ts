import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodexWebSearchProvider } from "./codex-provider";
import { createWebSearchTool, formatSearchResponseText } from "./tool";

export default function (pi: ExtensionAPI) {
  const provider = new CodexWebSearchProvider();
  const tool = createWebSearchTool(provider);
  pi.registerTool(tool);

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
        const response = await provider.search({ query }, ctx.signal);
        ctx.ui.setStatus("gpt-search", undefined);

        const textOutput = formatSearchResponseText(query, response);
        ctx.ui.notify(`Found ${response.results.length} search results for "${query}"`, "info");
        
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
