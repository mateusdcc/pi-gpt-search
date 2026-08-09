# How It Works: Technical Architecture

`pi-gpt-search` connects Pi coding agent models (e.g. Gemini, Claude) with OpenAI Codex's standalone search engine without relying on GPT model inference.

---

## 🏛️ System Architecture & Data Flow

```text
               +-------------------------------------------------------+
               |                       Pi Agent                        |
               +---------------------------+---------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |              Gemini LLM (Reasoning Engine)            |
               +---------------------------+---------------------------+
                                           |
                                           v Tool Call: web_search({ query })
               +-------------------------------------------------------+
               |                  web_search Pi Tool                   |
               |                       (tool.ts)                       |
               +---------------------------+---------------------------+
                                           |
                                           v Forward request
               +-------------------------------------------------------+
               |                CodexWebSearchProvider                 |
               |                  (codex-provider.ts)                  |
               +---------------------------+---------------------------+
                                           |
                                           | 1. Read ~/.codex/auth.json or .env
                                           | 2. HTTPS POST
                                           v
               +-------------------------------------------------------+
               |       OpenAI Standalone Web Search Endpoint           |
               |    (https://chatgpt.com/backend-api/codex/alpha/search) |
               +---------------------------+---------------------------+
                                           |
                                           v Returns JSON (results: [...])
               +-------------------------------------------------------+
               |                   Response Normalizer                 |
               |                     (normalize.ts)                    |
               +---------------------------+---------------------------+
                                           |
                                           v Formatted Markdown + DTO
               +-------------------------------------------------------+
               |              Gemini LLM (Reasoning Engine)            |
               |          Synthesizes answer with citations            |
               +-------------------------------------------------------+
```

---

## 📦 Core Modules

### 1. `src/errors.ts`
Defines typed, user-friendly errors:
- `CodexAuthMissingError`: Fired when `auth.json` or `CODEX_ACCESS_TOKEN` is missing.
- `CodexAuthExpiredError`: Fired on HTTP 401/403 (expired credentials).
- `CodexRateLimitError`: Fired on HTTP 429.
- `CodexHttpError`: Fired on HTTP 5xx.
- `WebSearchTimeoutError`: Fired on request timeout.
- `WebSearchCancelledError`: Fired when user aborts turn.

### 2. `src/normalize.ts`
Normalizes untrusted external API data into strict TypeScript DTOs:
```typescript
export interface SearchResult {
  title?: string;
  url: string;
  snippet?: string;
  domain?: string;
  refId?: string;
}
```

### 3. `src/provider.ts`
Defines the `WebSearchProvider` interface contract. Allows mocking or adding alternative providers in the future.

### 4. `src/codex-provider.ts`
Transport layer that interacts directly with OpenAI's search backend:
- Endpoint: `https://chatgpt.com/backend-api/codex/alpha/search`
- Headers:
  - `Authorization: Bearer <access_token>`
  - `ChatGPT-Account-ID: <account_id>` (optional)
  - `User-Agent: codex-cli/0.147.0-alpha.6.5`
- Payload:
  ```json
  {
    "id": "search_1",
    "model": "gpt-4o",
    "commands": {
      "search_query": [{ "q": "query" }]
    }
  }
  ```

### 5. `src/tool.ts`
Exposes the tool definition to Pi and formats response text into scannable markdown list for the reasoning model.

---

## 🛑 Cancellation & Timeout Architecture

When a user hits `Esc` in Pi, Pi signals abortion through an `AbortSignal`.
`CodexWebSearchProvider` binds `AbortSignal` listeners and an internal `setTimeout` controller directly to `fetch()`, ensuring zero dangling HTTP requests or background socket leaks.
