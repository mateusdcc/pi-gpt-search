import type { WebRunCommand } from "./commands.js";
import type { SearchResponse } from "./normalize.js";

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

export function describeCommandStatus(command: WebRunCommand): string {
  const parts: string[] = [];
  if (command.search_query && command.search_query.length > 0) {
    const q = command.search_query.map((s) => `"${s.q}"`).join(", ");
    parts.push(`Searching web for ${q}`);
  }
  if (command.open && command.open.length > 0) {
    const refs = command.open.map((o) => o.ref_id).join(", ");
    parts.push(`Opening document ${refs}`);
  }
  if (command.find && command.find.length > 0) {
    const patterns = command.find.map((f) => `"${f.pattern}" in ${f.ref_id}`).join(", ");
    parts.push(`Finding pattern ${patterns}`);
  }
  if (command.click && command.click.length > 0) {
    const clicks = command.click.map((c) => `element #${c.id} in ${c.ref_id}`).join(", ");
    parts.push(`Clicking ${clicks}`);
  }
  return parts.length > 0 ? parts.join("; ") + "..." : "Executing web research action...";
}
