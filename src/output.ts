import type { SearchResponse } from "./normalize";
import type { WebRunCommand } from "./commands";

export interface FormattedToolOutput {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
}

export function formatWebToolResult(command: WebRunCommand, response: SearchResponse): FormattedToolOutput {
  let primaryText = "";

  if (typeof response.output === "string" && response.output.trim().length > 0) {
    primaryText = response.output.trim();
  } else if (response.results && response.results.length > 0) {
    const formatted = response.results.map((item, idx) => {
      const title = item.title ? item.title : item.url ?? `Result ${idx + 1}`;
      const urlLine = item.url ? `   URL: ${item.url}\n` : "";
      const refLine = item.ref_id ? `   Ref: ${item.ref_id}\n` : "";
      const snippetLine = item.snippet ? `   ${item.snippet}` : "";
      return `${idx + 1}. ${title}\n${refLine}${urlLine}${snippetLine}`.trim();
    });
    primaryText = `Web Search Results:\n\n${formatted.join("\n\n")}`;
  } else {
    primaryText = "No output or structured web results returned.";
  }

  return {
    content: [
      {
        type: "text",
        text: primaryText,
      },
    ],
    details: {
      command,
      outputLength: primaryText.length,
      resultCount: response.results ? response.results.length : 0,
      results: response.results,
      encrypted_output: response.encrypted_output,
      raw: response.raw,
    },
  };
}
