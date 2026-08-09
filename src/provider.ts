import type { SearchResponse } from "./normalize";

export interface SearchRequest {
  query: string;
}

export interface WebSearchProvider {
  search(request: SearchRequest, signal?: AbortSignal): Promise<SearchResponse>;
}
