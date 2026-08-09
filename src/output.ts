import type { SearchResponse, SearchResult } from "./normalize";
import type { WebRunCommand } from "./commands";

export interface FormattedToolOutput {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
}

export function cleanCitationMarkers(text: string, results: SearchResult[] = []): string {
  if (!text) return "";

  const refToNumMap = new Map<string, number>();
  results.forEach((r, idx) => {
    const ref = r.ref_id || r.refId;
    if (ref) {
      refToNumMap.set(ref, idx + 1);
    }
  });

  // Matches Codex private Unicode citation markers: \uE200cite\uE202<ref>\uE201 or cite<ref>
  const cleaned = text.replace(/[\uE000-\uE2FF]?cite[\uE000-\uE2FF]?([^\uE000-\uE2FF\r\n]+)[\uE000-\uE2FF]?/gi, (match, inner) => {
    const cleanInner = inner.trim();
    if (!cleanInner) return "";

    if (cleanInner.includes("†")) {
      const parts = cleanInner.split("†");
      const label = parts.slice(1).join("†").trim();
      return label ? `[${label}]` : "";
    }

    if (refToNumMap.has(cleanInner)) {
      return `[${refToNumMap.get(cleanInner)}]`;
    }

    const matchedResult = results.find((r) => (r.ref_id || r.refId) === cleanInner);
    if (matchedResult && matchedResult.url) {
      const title = matchedResult.title ? matchedResult.title : matchedResult.url;
      return `[${cleanInner}: ${title} (${matchedResult.url})]`;
    }

    return `[${cleanInner}]`;
  });

  return cleaned;
}

export function formatWebToolResult(command: WebRunCommand, response: SearchResponse): FormattedToolOutput {
  let primaryText = "";

  if (typeof response.output === "string" && response.output.trim().length > 0) {
    primaryText = cleanCitationMarkers(response.output.trim(), response.results);

    // Append formatted source reference list if results exist and aren't already formatted at end
    if (response.results && response.results.length > 0 && !primaryText.includes("Sources:")) {
      const sourcesList = response.results
        .filter((r) => r.url)
        .slice(0, 10)
        .map((r, idx) => {
          const num = idx + 1;
          const title = r.title ? r.title : r.url;
          const refStr = r.ref_id ? ` (${r.ref_id})` : "";
          return `[${num}] ${title}${refStr} - ${r.url}`;
        });

      if (sourcesList.length > 0) {
        primaryText += `\n\nSources:\n${sourcesList.join("\n")}`;
      }
    }
  } else if (response.results && response.results.length > 0) {
    const formatted = response.results.map((item, idx) => {
      const title = item.title ? item.title : item.url ?? `Result ${idx + 1}`;
      const urlLine = item.url ? `   URL: ${item.url}\n` : "";
      const refLine = item.ref_id ? `   Ref: [${idx + 1}] (${item.ref_id})\n` : "";
      const snippetLine = item.snippet ? cleanCitationMarkers(item.snippet, response.results) : "";
      return `[${idx + 1}] ${title}\n${refLine}${urlLine}${snippetLine ? "   " + snippetLine : ""}`.trim();
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
