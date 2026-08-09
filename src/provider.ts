import type { SearchResponse } from "./normalize";
import type { WebRunCommand } from "./commands";
import type { SearchContextMode, ConversationTurn } from "./context";

export interface SearchRequest {
  query: string;
}

export interface SearchExecutionOptions {
  sessionId?: string;
  contextMode?: SearchContextMode;
  conversationTurns?: ConversationTurn[];
}

export interface WebSearchProvider {
  search(request: SearchRequest, signal?: AbortSignal): Promise<SearchResponse>;
  execute(command: WebRunCommand, options?: SearchExecutionOptions, signal?: AbortSignal): Promise<SearchResponse>;
  getSessionId(): string;
  setSessionId(id: string): void;
}
