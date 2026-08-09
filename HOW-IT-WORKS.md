# How It Works: Technical Architecture

`pi-gpt-search` connects **any active Pi coding agent model** (e.g. Gemini, Claude, DeepSeek, local models via Ollama/Llama) with OpenAI Codex's standalone search and browsing engine, evolving simple search into an iterative, multi-step web research harness with **Zero Additional GPT Agent Turns**.

---

## 🏗️ System Architecture & Data Flow

### 1. Simple Single-Query Search Flow (`web_search`)

The `web_search` tool provides a simple interface for single-query searches (the primary mode from earlier releases). The active Pi model sends a single search query string, which is formatted into a search action and executed against the OpenAI standalone search engine endpoint.

```text
               +-------------------------------------------------------+
               |                       Pi Agent                        |
               +---------------------------+---------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |        Active Pi Model (Reasoning Engine)             |
               |      (Gemini / Claude / DeepSeek / Ollama / etc.)     |
               +---------------------------+---------------------------+
                                           |
                                           v Tool Call: web_search({ query: "..." })
               +-------------------------------------------------------+
               |              web_search Compatibility Tool            |
               |                       (web-tool.ts)                   |
               |     - Wraps query into web({ search_query: ... })     |
               |     - Emits live TUI status updates via onUpdate      |
               +---------------------------+---------------------------+
                                           |
                                           v Forward WebRunCommand DTO
               +-------------------------------------------------------+
               |                CodexWebSearchProvider                 |
               |                  (codex-provider.ts)                  |
               |     - Resolves auth credentials (~/.codex/auth.json)  |
               |     - Maintains session identity mapping             |
               +---------------------------+---------------------------+
                                           |
                                           | 1. Serialize payload
                                           | 2. HTTPS POST (alpha/search)
                                           v
               +-------------------------------------------------------+
               |       OpenAI Standalone Web Search Endpoint           |
               |    (https://chatgpt.com/backend-api/codex/alpha/search) |
               +---------------------------+---------------------------+
                                           |
                                           v Returns JSON (output, results)
               +-------------------------------------------------------+
               |            Output Formatter & Citation Engine          |
               |                  (output.ts & normalize.ts)           |
               |     - Preserves raw model-oriented output             |
               |     - Replaces Unicode markers with OSC 8 hyperlinks  |
               +---------------------------+---------------------------+
                                           |
                                           v Clean text + OSC 8 hyperlinks + TUI details
               +-------------------------------------------------------+
               |        Active Pi Model (Reasoning Engine)             |
               |      Receives web search answer with inline citations |
               +-------------------------------------------------------+
```

---

### 2. Multi-Step Web Research Harness Flow (`web`)

The `web` tool introduces a full research harness capability. Instead of stopping after a single search query, the active model can execute rich, multi-action research commands (`search_query`, `open`, `find`, `click`, `response_length`) across a persistent research session to investigate documents in depth.

```text
               +-------------------------------------------------------+
               |                       Pi Agent                        |
               +---------------------------+---------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |        Active Pi Model (Reasoning Engine)             |
               |      (Gemini / Claude / DeepSeek / Ollama / etc.)     |
               +---------------------------+---------------------------+
                                           |
                                           v Tool Call: web({ search_query, open, find, click, response_length })
               +-------------------------------------------------------+
               |                   web Research Harness                |
               |                       (web-tool.ts)                   |
               |     - Emits TUI status updates via onUpdate           |
               |     - Collapsible TUI rendering (Ctrl+O to expand)    |
               +---------------------------+---------------------------+
                                           |
                                           v Forward WebRunCommand DTO
               +-------------------------------------------------------+
               |                CodexWebSearchProvider                 |
               |                  (codex-provider.ts)                  |
               |     - Session ID mapping across search/open/find      |
               |     - Context shaping (filterSearchContext)           |
               |     - Auth loading (~/.codex/auth.json or .env)       |
               +---------------------------+---------------------------+
                                           |
                                           | 1. Validate command (commands.ts)
                                           | 2. Serialize payload
                                           | 3. HTTPS POST (alpha/search)
                                           v
               +-------------------------------------------------------+
               |       OpenAI Standalone Web Search Endpoint           |
               |    (https://chatgpt.com/backend-api/codex/alpha/search) |
               +---------------------------+---------------------------+
                                           |
                                           v Returns JSON (output, results, encrypted_output)
               +-------------------------------------------------------+
               |            Output Formatter & Citation Engine          |
               |                  (output.ts & normalize.ts)           |
               |     - Preserves raw model-oriented output             |
               |     - Replaces Unicode markers with OSC 8 hyperlinks  |
               |     - Prunes raw web payloads from LLM context        |
               +---------------------------+---------------------------+
                                           |
                                           v Clean text + OSC 8 hyperlinks + TUI details
               +-------------------------------------------------------+
               |        Active Pi Model (Reasoning Engine)             |
               |   Iteratively decides next web action or final answer |
               +-------------------------------------------------------+
```

---

## 🛠️ Core Modules & Responsibilities

### 1. Extension Entrypoint (`src/index.ts`)
Handles Pi Extension registration cleanly:
- Registers compatibility tool wrapper `web_search`.
- Registers primary research harness tool `web`.
- Registers direct user slash command `/gpt-search`.

### 2. Model-Facing Research Tools (`src/web-tool.ts`)
Exposes both single-query search and rich research actions to any active Pi session model:
- **Single-Query Search (`web_search`):** Accepts `{ query: string }` and translates it into a single-query `search_query` execution.
- **Rich Research Harness (`web`):** Supports full research actions (`search_query`, `open`, `find`, `click`, `response_length`).
- **TUI Progress Feedback:** Calls `onUpdate()` to report live stage descriptions (e.g. `Searching web for "query"...`, `Opening document turn0search0...`).
- **Collapsible Display (`renderCall` & `renderResult`):** Collapses completed execution rows to a single line `✓ Web action complete (N results) (Ctrl+O to expand)`.
- **System Guidance:** Teaches the active model when to browse, how to execute multi-step research, and how to cite sources inline.

### 3. Command DTOs & Validation (`src/commands.ts`)
Defines structured command DTOs and validation logic:
- `search_query`: Multi-query array with optional `recency` filter and `domains` list.
- `open`: Opens document content by `ref_id` (e.g. `turn0search0`) with optional `lineno`.
- `click`: Clicks link or element by `id` inside document `ref_id`.
- `find`: Searches for pattern inside document `ref_id`.
- `response_length`: Controls output granularity (`short`, `medium`, `long`).
- `serializeWebRunPayload`: Constructs standard JSON request payloads for OpenAI search endpoint.

### 4. Provider Contract (`src/provider.ts`)
Defines abstract `WebSearchProvider` interface contract supporting both legacy `search({ query })` and rich `execute(command, options)` methods with session identity management (`getSessionId`, `setSessionId`).

### 5. Codex Transport Layer (`src/codex-provider.ts`)
Interacts directly with OpenAI's search backend:
- Endpoint: `https://chatgpt.com/backend-api/codex/alpha/search`
- Auth: Automatically resolves `~/.codex/auth.json` (from `codex login`) or `CODEX_ACCESS_TOKEN` / `CODEX_ACCOUNT_ID` in `.env`.
- Session Identity: Maintains stable session `id` across calls so reference IDs (`turn0search0`) survive across sequential `search` -> `open` -> `find` steps.
- Resilience: Retries transient HTTP 502/503/504 gateway errors automatically.

### 6. Context Filter (`src/context.ts`)
Optional conversation context shaper (`SearchContextMode = "none" | "recent"`):
- Filters out system prompts, developer instructions, tool execution messages, env dumps, and API tokens before sending context to search.

### 7. Output Formatter & Citation Engine (`src/output.ts`)
Transforms backend response into clean tool results:
- **Model Output Preservation:** Passes raw backend model-oriented text (`response.output`) to the active model as `content[0].text`.
- **OSC 8 Terminal Hyperlinks:** Converts private Unicode citation markers (`\uE200cite\uE202turn0search0\uE201`) and turn IDs into clickable OSC 8 ANSI escape sequences (`\u001b]8;;<URL>\u001b\\[1]\u001b]8;;\u001b\\`). Holding `Cmd`/`Ctrl` underlines the link and clicking opens the web page directly.
- **Sources List:** Appends a numbered `Sources:` index listing titles and URLs.

### 8. Response Normalization (`src/normalize.ts`)
Normalizes API response payloads while preserving forward-compatible fields (`ref_id`, `url`, `title`, `snippet`, `domain`, `type`, `raw`).

### 9. Error Hierarchy (`src/errors.ts`)
Typed error classes:
- `CodexAuthMissingError`: Unauthenticated session.
- `CodexAuthExpiredError`: HTTP 401/403 expired credentials.
- `CodexRateLimitError`: HTTP 429 rate limit exceeded.
- `CodexHttpError`: HTTP 5xx backend errors.
- `WebSearchTimeoutError`: Request timeout.
- `WebSearchCancelledError`: User cancellation.

---

## 🧠 Context Isolation & Token Efficiency

1. **Raw Web Data Excluded:** Raw HTML, unparsed crawl payloads, HTTP headers, and raw API JSON arrays never enter the active model's conversation context window.
2. **Pruned LLM Memory:** Only the cleaned model-oriented summary text (`content[0].text`) with inline citations enters the active model's prompt memory.
3. **Isolated UI Metadata:** Detailed result arrays are attached to `details`, which Pi uses strictly as local TUI side-car state for widget rendering (such as `Ctrl+O` expansion).

---

## ⏱️ Cancellation & Timeout Handling

When a user hits `Esc` in Pi, Pi signals abortion through an `AbortSignal`.
`CodexWebSearchProvider` binds `AbortSignal` listeners and an internal `setTimeout` controller directly to `fetch()`, ensuring zero dangling HTTP requests or background socket leaks.
