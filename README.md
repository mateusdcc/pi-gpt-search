# pi-gpt-search

> **Native, Model-Independent Web Search for Pi using OpenAI Codex Standalone Search Engine.**

`pi-gpt-search` gives **any** Pi model (Gemini, Claude, local models, OpenRouter) real-time web search capabilities by reusing OpenAI Codex's standalone web retrieval infrastructure - with **ZERO GPT Model Inference Turns** and **ZERO GPT Tokens Consumed**.

---

## ⚡ Quick Start: 1-Line Installation

Install via npm:

```bash
pi install npm:pi-gpt-search
```

Or install via GitHub:

```bash
pi install https://github.com/mateusdcc/pi-gpt-search
```

Or install project-locally for your current repository (`-l` flag):

```bash
pi install npm:pi-gpt-search -l
```

Or try it temporarily in a single session without installing:

```bash
pi -e npm:pi-gpt-search
```

---

## ⚡ Key Highlights: ZERO-GPT INFERENCE

- 🚀 **Zero GPT Tokens Spent:** Pure web retrieval via OpenAI's backend endpoint. No GPT/Codex LLM turns are executed, meaning **0 input tokens, 0 output tokens, and 0 reasoning credits are billed**.
- 👑 **Model Sovereign:** Your active Pi model (e.g., Gemini 3.5 Flash / Gemini 3.1 Pro) remains the sole reasoning model.
- 🛠️ **Slash Command & LLM Tools:** Works both automatically as LLM tools (`web_search` & `web`) and as a direct user command (`/gpt-search`).
- 🔑 **Credential Reuse:** Automatically uses your existing `codex login` session (`~/.codex/auth.json`) or custom `.env` tokens.
- 🛡️ **Data Privacy:** Query-only by default. Does not send conversation history, project files, or system prompts to search.

---

## 🏗️ Architecture

```text
Pi Coding Agent
 └── Gemini (or active model)
      ├── web_search(query: "latest Rust release")
      │    └── Codex/OpenAI Standalone Search API (/codex/alpha/search)
      │         └── Structured Results (Title, URL, Snippet)
      │              └── Gemini continues reasoning & answers user
      │
      └── web(search_query: [...], open: [...], find: [...])
           └── Multi-Step Web Research Harness
                └── Deep document content, pattern matching & citations
```

---

## 🛠️ Usage & Commands

### 1. Direct Slash Command: `/gpt-search`

Perform a direct web search immediately without spending LLM tokens:

```text
/gpt-search give me the repo link to codex
```

```text
/gpt-search Rust 1.97 release notes
```

### 2. Automatic LLM Tool: `web_search`

Ask any model a question requiring current facts (single-query lookup):

```bash
pi --model antigravity/gemini-3.5-flash "What is the latest release of Rust and what changed?"
```

### Example Log Output (with `PI_WEB_SEARCH_DEBUG=1`):

```text
[PI_WEB_SEARCH_DEBUG] req_id=maqk8a5 query="latest Rust release version and date 2026" provider=codex
[PI_WEB_SEARCH_DEBUG] req_id=maqk8a5 status=200 elapsed_ms=1863 results=41
```

### 3. Advanced Web Research Harness Tool: `web`

Ask models to conduct deep, iterative web research with multi-query execution, page content inspection, pattern finding, and link navigation:

```json
{
  "search_query": [
    { "q": "OpenAI Codex GitHub repository", "domains": ["github.com"] }
  ],
  "response_length": "medium"
}
```

Followed by opening specific document references in the same session:

```json
{
  "open": [
    { "ref_id": "turn0search0" }
  ]
}
```

And pattern matching within opened documents:

```json
{
  "find": [
    { "ref_id": "turn1view0", "pattern": "terminal" }
  ]
}
```

---

## 📋 Requirements

1. **Pi Coding Agent:** `pi` CLI installed (`v0.80+`).
2. **Node.js:** `v18.0.0` or higher.
3. **OpenAI Codex Auth:** An authenticated Codex session (run `codex login` in terminal, or set `CODEX_ACCESS_TOKEN` in `.env`).

---

## ⚙️ Manual Installation & Environment Setup

If you prefer manual placement instead of `pi install`:

### 1. Manual Placement

```bash
# Global (All projects)
mkdir -p ~/.pi/agent/extensions
cp -r pi-gpt-search ~/.pi/agent/extensions/

# Project-local
mkdir -p .pi/extensions
cp -r pi-gpt-search .pi/extensions/
```

### 2. Environment Variables (Optional)

Copy `.env.example` to `.env` if you want to explicitly override your Codex access token:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Optional: If unset, automatically reads ~/.codex/auth.json
CODEX_ACCESS_TOKEN=your_token_here
CODEX_ACCOUNT_ID=your_account_id_here

# Enable debug logging
PI_WEB_SEARCH_DEBUG=1
```

> **Security Note:** Never commit `.env` to Git. `.env` is listed in `.gitignore`.

---

## 🧪 Running Tests

`pi-gpt-search` comes with a 4-level test suite:

```bash
npm test
```

Test suite breakdown:
- **Unit Tests (`unit.test.ts`, `commands.test.ts`, `normalize.test.ts`, `output.test.ts`, `web-tool.test.ts`):** Schema validation, DTO normalization, error classes, output formatting, collapsible display.
- **Integration Tests (`provider-integration.test.ts`):** Mock server handling for 200, 401, 403, 429, 500, timeouts, cancellation.
- **Real Search Test (`real-search.test.ts` & `real-endpoint.test.ts`):** Live execution against OpenAI's search endpoint and session continuity.
- **Zero-GPT Verification (`zero-gpt.test.ts`):** Network interception test proving **0 GPT inference calls** are made.
- **E2E Research Harness Suite (`e2e-research.test.ts`):** Full end-to-end multi-step web research test suite.

---

## 📖 Documentation

- [HOW-IT-WORKS.md](./HOW-IT-WORKS.md) - Deep architectural breakdown of modules, data flow, TUI renderers, context isolation, and cancellation.
- [HOW-IT-WAS-EXTRACT.md](./HOW-IT-WAS-EXTRACT.md) - Reverse-engineering guide documenting how the standalone search endpoint was discovered.

---

## ⚠️ Limitations

- **Search Index Scope:** Returns search result snippets, URLs, and document views; does not include a full headless browser DOM renderer.
- **Session Auth:** Requires an active ChatGPT/Codex login session (`codex login`). Expired sessions require running `codex login` to re-authenticate.

---

## 📜 License

MIT License.
