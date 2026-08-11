import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { WebSearchProvider } from "./provider.js";
import type { WebRunCommand } from "./commands.js";
import { formatWebToolResult } from "./output.js";
import { makeWebToolRenderer } from "./render.js";
import { BROWSING_GUIDELINES, ResearchToolParameters } from "./web-schemas.js";
import { describeCommandStatus } from "./web-format.js";

/**
 * Shared execution path for research actions (search/open/find/click).
 * Used by the `codex-research` tool and the deprecated `web` alias so both
 * produce identical results.
 */
export async function executeResearch(
  provider: WebSearchProvider,
  params: WebRunCommand,
  signal: AbortSignal | undefined,
  onUpdate: ((update: { content: Array<{ type: "text"; text: string }>; details: Record<string, unknown> }) => void) | undefined
) {
  const command = params;
  if (!command.response_length) {
    command.response_length = "long";
  }
  if (typeof onUpdate === "function") {
    const statusMsg = describeCommandStatus(command);
    onUpdate({
      content: [{ type: "text", text: statusMsg }],
      details: { status: statusMsg, command },
    });
  }
  try {
    const response = await provider.execute(command, undefined, signal);
    const formatted = formatWebToolResult(command, response);
    return formatted;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const content: Array<{ type: "text"; text: string }> = [
      { type: "text", text: `Web execution failed: ${errorMsg}` },
    ];
    return {
      content,
      details: { error: errorMsg },
      isError: true,
    };
  }
}

export function createResearchTool(provider: WebSearchProvider): ToolDefinition {
  return {
    name: "codex-research",
    label: "Codex Research Harness",
    description:
      "Execute iterative web research actions (search_query, open, find, click, response_length) against live web search & document browser engine. Use to search current information, inspect official docs, and perform iterative multi-step research.",
    promptSnippet: "Perform iterative web research with search, open, find, click",
    promptGuidelines: BROWSING_GUIDELINES,
    parameters: ResearchToolParameters,
    async execute(_toolCallId, params, signal, onUpdate, _ctx) {
      return executeResearch(provider, params as WebRunCommand, signal, onUpdate);
    },
    renderResult: makeWebToolRenderer("codex-research"),
  };
}
