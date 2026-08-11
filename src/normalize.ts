export interface SearchResult {
  type?: string;
  refId?: string;
  ref_id?: string;
  url?: string;
  title?: string;
  snippet?: string;
  domain?: string;
}

export interface SearchResponse {
  output?: string;
  results: SearchResult[];
  encrypted_output?: string;
}

export function normalizeRawSearchResult(item: unknown): SearchResult | null {
  if (typeof item !== "object" || item === null) return null;
  const obj = item as Record<string, unknown>;

  const url = typeof obj.url === "string" ? obj.url.trim() : undefined;
  const refId = typeof obj.ref_id === "string" ? obj.ref_id.trim() : undefined;
  const title = typeof obj.title === "string" ? obj.title.trim() : undefined;
  const snippet = typeof obj.snippet === "string" ? obj.snippet.trim() : undefined;
  const domain = typeof obj.domain === "string" ? obj.domain.trim() : undefined;
  const type = typeof obj.type === "string" ? obj.type.trim() : undefined;

  if (!url && !refId && !title && !snippet) {
    return null;
  }

  const result: SearchResult = {};

  if (url) result.url = url;
  if (refId) {
    result.refId = refId;
    result.ref_id = refId;
  }
  if (title) result.title = title;
  if (snippet) result.snippet = snippet;
  if (domain) result.domain = domain;
  if (type) result.type = type;

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

  const output = typeof obj.output === "string" ? obj.output : undefined;
  const encrypted_output = typeof obj.encrypted_output === "string" ? obj.encrypted_output : undefined;

  return {
    output,
    results,
    encrypted_output,
  };
}
