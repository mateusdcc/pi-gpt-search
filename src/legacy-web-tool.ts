import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { WebSearchProvider } from "./provider.js";
import type { WebRunCommand } from "./commands.js";
import { executeResearch } from "./research-tool.js";
import { makeWebToolRenderer } from "./render.js";
import { BROWSING_GUIDELINES, ResearchToolParameters } from "./web-schemas.js";

export const WEB_DEPRECATION_MESSAGE =
  "The 'web' tool is deprecated. Use 'codex-research' instead.";

/**
 * Backward-compatible alias for the legacy `web` tool name. Delegates to the
 * same research implementation as `codex-research` and prepends a deprecation
 * notice to every invocation's output. Direct `codex-research` calls do not
 * see the notice.
 */
export function createLegacyWebTool(provider: WebSearchProvider): ToolDefinition {
  return {
    name: "web",
    label: "Codex Web Research (deprecated)",
    description:
      `[DEPRECATED] ${WEB_DEPRECATION_MESSAGE} ` +
      "Execute iterative web research actions (search_query, open, find, click, response_length) against live web search & document browser engine.",
    promptSnippet: "Perform iterative web research with search, open, find, click",
    promptGuidelines: BROWSING_GUIDELINES,
    parameters: ResearchToolParameters,
    async execute(_toolCallId, params, signal, onUpdate, _ctx) {
      const base = await executeResearch(provider, params as WebRunCommand, signal, onUpdate);
      const text = base.content?.[0]?.type === "text" ? base.content[0].text : "";
      return {
        ...base,
        content: [{ type: "text", text: `${WEB_DEPRECATION_MESSAGE}\n\n${text}` }],
      };
    },
    renderResult: makeWebToolRenderer("web (deprecated)"),
  };
}
