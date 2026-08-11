# How It Works: Technical Architecture

`pi-gpt-search` connects **any active Pi coding agent model** (e.g. Gemini, Claude, DeepSeek, local models via Ollama/Llama) with OpenAI Codex's standalone search and browsing engine, evolving simple search into an iterative, multi-step web research harness with **Zero Additional GPT Agent Turns**.

---

## 🏗️ System Architecture & Data Flow

### 1. Simple Single-Query Search Flow (`codex-search`)

The `codex-search` tool provides a simple interface for single-query searches (the primary mode from earlier releases). The active Pi model sends a single search query string, which is formatted into a search action and executed against the OpenAI standalone search engine endpoint.

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
                                           v Tool Call: codex-search({ query: "..." })
               +-------------------------------------------------------+
               |              codex-search Search Tool                |
               |                       (search-tool.ts)               |
               |     - Wraps query into a standalone search command   |
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

### 2. Multi-Step Research Harness Flow (`codex-research`)

The `codex-research` tool introduces a full research harness capability. Instead of stopping after a single search query, the active model can execute rich, multi-action research commands (`search_query`, `open`, `find`, `click`, `response_length`) across a persistent research session to investigate documents in depth.

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
                                           v Tool Call: codex-research({ search_query, open, find, click, response_length })
               +-------------------------------------------------------+
               |                codex-research Research Harness        |
               |                       (research-tool.ts)             |
               |     - Emits TUI status updates via onUpdate           |
               |     - Collapsible TUI rendering (Ctrl+O to expand)    |
               +---------------------------+---------------------------+
                                           |
                                           v Forward WebRunCommand DTO
               +-------------------------------------------------------+
               |                CodexWebSearchProvider                 |
               |                  (codex-provider.ts)                  |
               |     - Session ID mapping across search/open/find      |
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
                                           v Returns JSON (output, results)
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
Handles Pi extension registration:
- Registers `codex-search`, `codex-research`, and the deprecated `web` alias.
- Registers the direct user slash command `/gpt-search`.

### 2. Research Tool (`src/research-tool.ts`)
Defines `codex-research` and its shared execution path:
- Supports `search_query`, `open`, `find`, `click`, and `response_length`.
- Reports progress through `onUpdate()`.
- Formats provider responses before returning them to the model and renderer.

### 3. Search Tool (`src/search-tool.ts`)
Defines the single-query `codex-search` tool:
- Accepts `query`, `recency`, `domains`, and `response_length`.
- Translates the request into the provider's standalone search contract.

### 4. Legacy Alias (`src/legacy-web-tool.ts`)
Preserves backward compatibility for `web`:
- Delegates to the same execution path as `codex-research`.
- Prepends a deprecation notice to every legacy invocation.

### 5. Shared Tool Presentation
Shared tool concerns are separated by responsibility:
- `src/web-schemas.ts`: TypeBox parameters and model browsing guidance.
- `src/web-format.ts`: Search result text and command status formatting.
- `src/render.ts`: Themed collapsed and expanded result rendering.

### 6. Command DTOs & Validation (`src/commands.ts`)
Defines command validation and endpoint serialization:
- `search_query`: Multi-query array with optional `recency` and `domains` filters.
- `open`: Opens document content by `ref_id` with an optional `lineno`.
- `click`: Clicks an element by `id` inside a document.
- `find`: Searches for a pattern inside a document.
- `response_length`: Controls output granularity (`short`, `medium`, `long`).

### 7. Provider Contract (`src/provider.ts`)
Defines the `WebSearchProvider` contract for standalone search and rich research commands with shared session identity.

### 8. Codex Transport Layer (`src/codex-provider.ts`)
Interacts directly with OpenAI's search backend:
- Resolves authentication from `~/.codex/auth.json` or environment variables.
- Maintains a stable session ID across `search`, `open`, and `find` calls.
- Retries transient HTTP 502, 503, and 504 responses.

### 9. Output Formatter & Citation Engine (`src/output.ts`)
Transforms backend responses into model-facing tool results:
- Preserves cleaned backend output in `content[0].text`.
- Converts private citation markers and turn IDs into terminal hyperlinks.
- Appends a numbered source index for model attribution and direct command output.

### 10. Response Normalization (`src/normalize.ts`)
Normalizes supported response fields: `ref_id`, `url`, `title`, `snippet`, `domain`, and `type`.

### 11. Error Hierarchy (`src/errors.ts`)
Provides typed errors for authentication, authorization, rate limits, HTTP failures, timeouts, and cancellation.

---

## 🧠 Context Isolation & Token Efficiency

1. **Raw Web Data Excluded:** Raw HTML, unparsed crawl payloads, HTTP headers, and raw API JSON arrays never enter the active model's conversation context window.
2. **Pruned LLM Memory:** Only the cleaned model-oriented summary text (`content[0].text`) with inline citations enters the active model's prompt memory.
3. **Isolated UI Metadata:** Detailed result arrays are attached to `details`, which Pi uses strictly as local TUI side-car state for widget rendering (such as `Ctrl+O` expansion).

---

## ⏱️ Cancellation & Timeout Handling

When a user hits `Esc` in Pi, Pi signals abortion through an `AbortSignal`.
`CodexWebSearchProvider` binds `AbortSignal` listeners and an internal `setTimeout` controller directly to `fetch()`, ensuring zero dangling HTTP requests or background socket leaks.
