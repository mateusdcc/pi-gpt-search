# How the Standalone Search Engine Was Extracted

This document details the reverse-engineering methodology used to extract OpenAI Codex's standalone search engine and adapt it into a Zero-GPT web-search extension for Pi.

---

## 🔍 Phase 1: Protocol Schema Analysis

We began by inspecting the local Codex executable (`/Applications/ChatGPT.app/Contents/Resources/codex`) and generating its TypeScript protocol bindings:

```bash
codex app-server generate-ts --out /tmp/codex-ts
```

```text
+-----------------------+      codex app-server generate-ts       +------------------------+
| Installed Codex CLI   | --------------------------------------> | TypeScript Schema Files|
| (v0.147.0-alpha.6.5)  |                                         | (/tmp/codex-ts/)       |
+-----------------------+                                         +-----------+------------+
                                                                              |
                                                                              | Searched for "WebSearch"
                                                                              v
                                                                  +------------------------+
                                                                  |  Found WebSearchItem   |
                                                                  |  & WebSearchAction     |
                                                                  +------------------------+
```

Analysis revealed `WebSearchItem` with rust doc comments:
> *"Structured search results returned out-of-band by standalone web search."*

---

## 🔬 Phase 2: Binary Symbol Mining

Using `strings`, we scanned the compiled Rust binary for search-related identifiers, URLs, and struct names:

```bash
strings /Applications/ChatGPT.app/Contents/Resources/codex | grep -iE "(search|alpha/search|backend-api)"
```

```text
+-----------------------+        strings /.../codex        +-----------------------------------+
|  Codex macOS Binary   | -------------------------------> |  Extracted Internal Identifiers:  |
+-----------------------+                                  |  1. "standalone_web_search"       |
                                                           |  2. "codex.web_search.results"     |
                                                           |  3. "alpha/search"                |
                                                           |  4. "https://chatgpt.com/backend-api/" |
                                                           +-----------------+-----------------+
                                                                             |
                                                                             v
                                                           +-----------------------------------+
                                                           | Derived Endpoint Candidate:       |
                                                           | https://chatgpt.com/backend-api/  |
                                                           |         codex/alpha/search        |
                                                           +-----------------------------------+
```

Key symbols discovered:
- Base URL: `https://chatgpt.com/backend-api/`
- Endpoint path: `codex/alpha/search`
- Struct names: `SearchCommands`, `SearchQuery`

---

## 🧪 Phase 3: Endpoint Probing & Parameter Discovery

Using node `fetch` with OAuth tokens extracted from `~/.codex/auth.json`, we sent test requests to `https://chatgpt.com/backend-api/codex/alpha/search`. The backend API's error handling provided explicit feedback guiding us to the valid schema:

```text
           Request Sent                                     Backend Response
  +----------------------------+                     +-----------------------------------+
  | { q: "Rust" }              | ------------------> | 400: Missing parameter 'id'       |
  +----------------------------+                     +-----------------------------------+

  +----------------------------+                     +-----------------------------------+
  | { id: "1" }                | ------------------> | 400: Missing parameter 'model'    |
  +----------------------------+                     +-----------------------------------+

  +----------------------------+                     +-----------------------------------+
  | { id: "1", model:"gpt-4o" }| ------------------> | 200: "Invalid to send empty calls |
  |                            |                     |       to web.run"                 |
  +----------------------------+                     +-----------------------------------+

  +----------------------------+                     +-----------------------------------+
  | { id: "1", model: "gpt-4o",| ------------------> | 400: Unknown parameter 'command'. |
  |   command: "search" }      |                     |      Did you mean 'commands'?     |
  +----------------------------+                     +-----------------------------------+

  +----------------------------+                     +-----------------------------------+
  | { id: "1", model: "gpt-4o",| ------------------> | 400: 'commands.search_query'      |
  |   commands: {              |                     |      expected an array of objects |
  |     search_query: "Rust"   |                     |                                   |
  |   } }                      |                     +-----------------------------------+
  +----------------------------+
```

---

## ✅ Phase 4: Verification & Zero-GPT Proof

The final valid request format was established:

```json
{
  "id": "1",
  "model": "gpt-4o",
  "commands": {
    "search_query": [
      { "q": "OpenAI Codex GitHub repository" }
    ]
  }
}
```

The response returns HTTP 200 OK with a structured `results` array containing URLs, titles, and snippets.

To prove that zero GPT model inference turns occur:

```text
                      +-----------------------------+
                      |   Zero-GPT Test Harness     |
                      +--------------+--------------+
                                     |
                                     v
                      +-----------------------------+
                      |   Intercepting Proxy Fetch  |
                      +--------------+--------------+
                                     |
           +-------------------------+-------------------------+
           |                                                   |
           v                                                   v
+-----------------------+                           +-----------------------+
|  /codex/alpha/search  |                           |  Model Inference /    |
|   (Search Engine)     |                           |  Completions Routes   |
+-----------+-----------+                           +-----------+-----------+
            |                                                   |
            v                                                   v
    Status: 200 OK                                       Count == 0 (PASSED)
    Results Returned
```

The test confirmed:
- Standalone Search Requests: 1
- GPT Model Inference Calls: 0
