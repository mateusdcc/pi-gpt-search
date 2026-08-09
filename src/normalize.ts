export interface SearchResult {
  title?: string;
  url: string;
  snippet?: string;
  domain?: string;
  refId?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  output?: string;
}

export function normalizeRawSearchResult(item: unknown): SearchResult | null {
  if (typeof item !== "object" || item === null) return null;
  const obj = item as Record<string, unknown>;
  const url = typeof obj.url === "string" ? obj.url.trim() : "";
  if (!url) return null;

  const result: SearchResult = { url };
  if (typeof obj.title === "string" && obj.title.trim()) {
    result.title = obj.title.trim();
  }
  if (typeof obj.snippet === "string" && obj.snippet.trim()) {
    result.snippet = obj.snippet.trim();
  }
  if (typeof obj.domain === "string" && obj.domain.trim()) {
    result.domain = obj.domain.trim();
  }
  if (typeof obj.ref_id === "string" && obj.ref_id.trim()) {
    result.refId = obj.ref_id.trim();
  }

  return result;
}

export function normalizeSearchResponseBody(body: unknown): SearchResponse {
  if (typeof body !== "object" || body === null) {
    return { results: [] };
  }

  const obj = body as Record<string, unknown>;
  const rawResults = Array.isArray(obj.results) ? obj.results : [];
  const results: SearchResult[] = [];

  for (const item of rawResults) {
    const normalized = normalizeRawSearchResult(item);
    if (normalized) {
      results.push(normalized);
    }
  }

  const output = typeof obj.output === "string" ? obj.output.trim() : undefined;
  return { results, output };
}
