import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { WebSearchProvider } from "./provider";
import type { SearchResponse } from "./normalize";

export function formatSearchResponseText(query: string, response: SearchResponse): string {
  if (!response.results || response.results.length === 0) {
    return `No web search results found for: "${query}".`;
  }

  const formattedResults = response.results.map((item, idx) => {
    const title = item.title ? item.title : item.url;
    const snippet = item.snippet ? `   ${item.snippet}` : "";
    return `${idx + 1}. ${title}\n   URL: ${item.url}${snippet ? "\n" + snippet : ""}`;
  });

  return `Search results for: "${query}"\n\n${formattedResults.join("\n\n")}`;
}

export function createWebSearchTool(provider: WebSearchProvider): ToolDefinition {
  return {
    name: "codex-search",
    label: "Web Search",
    description:
      "Search the public web for current or externally verifiable information. Use this tool whenever the answer depends on information that may have changed, including recent software versions, documentation, releases, news, APIs, products, schedules, or facts you are unsure about. Do not guess current information when this tool is available.",
    promptSnippet: "Search the web for current or externally verifiable information",
    promptGuidelines: [
      "Use codex-search for current, uncertain, niche, or explicitly requested online information."
    ],
    parameters: Type.Object({
      query: Type.String({
        description: "The search query to look up on the web"
      })
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const query = (params as { query: string }).query;
      try {
        const searchRes = await provider.search({ query }, signal);
        const textOutput = formatSearchResponseText(query, searchRes);
        return {
          content: [{ type: "text", text: textOutput }],
          details: {
            query,
            resultCount: searchRes.results.length,
            results: searchRes.results
          }
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Search failed: ${errorMsg}` }],
          details: { error: errorMsg },
          isError: true
        };
      }
    }
  };
}
