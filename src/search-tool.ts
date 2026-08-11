import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { WebSearchProvider } from "./provider.js";
import { formatSearchResponseText } from "./web-format.js";
import { makeWebToolRenderer } from "./render.js";
import { SearchToolParameters } from "./web-schemas.js";

export function createSearchTool(provider: WebSearchProvider): ToolDefinition {
  return {
    name: "codex-search",
    label: "Codex Search",
    description:
      "Single-query Codex search tool. Translates directly into codex-research({ search_query: [{ q: query }] }). Supports optional recency/domains filters and response_length (default: short).",
    promptSnippet: "Search the web for current or externally verifiable information",
    promptGuidelines: [
      "Use codex-search for simple web lookups. For iterative research (opening pages, searching patterns), use the 'codex-research' tool instead."
    ],
    parameters: SearchToolParameters,
    async execute(_toolCallId, params, signal, onUpdate, _ctx) {
      const { query, recency, domains, response_length = "short" } = params as {
        query: string;
        recency?: number;
        domains?: string[];
        response_length?: "short" | "medium" | "long";
      };
      if (typeof onUpdate === "function") {
        onUpdate({
          content: [{ type: "text", text: `Searching web for "${query}"...` }],
          details: { status: `Searching web for "${query}"...`, query },
        });
      }
      try {
        const response = await provider.search({ query, recency, domains, response_length }, signal);
        const textOutput = formatSearchResponseText(query, response);
        return {
          content: [{ type: "text", text: textOutput }],
          details: {
            query,
            results: response.results,
          },
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Search failed: ${errorMsg}` }],
          details: { error: errorMsg },
          isError: true,
        };
      }
    },
    renderResult: makeWebToolRenderer("codex-search"),
  };
}
