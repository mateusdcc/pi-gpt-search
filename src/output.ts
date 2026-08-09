import type { SearchResponse, SearchResult } from "./normalize";
import type { WebRunCommand } from "./commands";

export interface FormattedToolOutput {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
}

export function cleanCitationMarkers(text: string, results: SearchResult[] = []): string {
  if (!text) return "";

  const resultMap = new Map<string, SearchResult>();
  for (const r of results) {
    const ref = r.ref_id || r.refId;
    if (ref) {
      resultMap.set(ref, r);
    }
  }

  // Matches Codex private Unicode citation markers: \uE200cite\uE202<ref>\uE201 or cite<ref>
  return text.replace(/[\uE000-\uE2FF]?cite[\uE000-\uE2FF]?([^\uE000-\uE2FF\r\n]+)[\uE000-\uE2FF]?/gi, (match, inner) => {
    const cleanInner = inner.trim();
    if (!cleanInner) return "";

    if (cleanInner.includes("†")) {
      const parts = cleanInner.split("†");
      const label = parts.slice(1).join("†").trim();
      return label ? `[${label}]` : "";
    }

    const matchedResult = resultMap.get(cleanInner);
    if (matchedResult && matchedResult.url) {
      const title = matchedResult.title ? matchedResult.title : matchedResult.url;
      return `[${cleanInner}: ${title} (${matchedResult.url})]`;
    }

    return `[${cleanInner}]`;
  });
}

export function formatWebToolResult(command: WebRunCommand, response: SearchResponse): FormattedToolOutput {
  let primaryText = "";

  if (typeof response.output === "string" && response.output.trim().length > 0) {
    primaryText = cleanCitationMarkers(response.output.trim(), response.results);
  } else if (response.results && response.results.length > 0) {
    const formatted = response.results.map((item, idx) => {
      const title = item.title ? item.title : item.url ?? `Result ${idx + 1}`;
      const urlLine = item.url ? `   URL: ${item.url}\n` : "";
      const refLine = item.ref_id ? `   Ref: ${item.ref_id}\n` : "";
      const snippetLine = item.snippet ? cleanCitationMarkers(item.snippet, response.results) : "";
      return `${idx + 1}. ${title}\n${refLine}${urlLine}${snippetLine ? "   " + snippetLine : ""}`.trim();
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
