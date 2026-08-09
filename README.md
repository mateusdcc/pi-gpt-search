# pi-gpt-search

> **Native, Model-Independent Web Search for Pi using OpenAI Codex Standalone Search Engine.**

`pi-gpt-search` gives **any** Pi model (Gemini, Claude, local models, OpenRouter) real-time web search capabilities by reusing OpenAI Codex's standalone web retrieval infrastructure—with **ZERO GPT Model Inference Turns** and **ZERO GPT Tokens Consumed**.

---

## ⚡ Key Highlights: ZERO-GPT INFERENCE

- 🚫 **Zero GPT Tokens Spent:** Pure web retrieval via OpenAI's backend endpoint. No GPT/Codex LLM turns are executed, meaning **0 input tokens, 0 output tokens, and 0 reasoning credits are billed**.
- 🧠 **Model Sovereign:** Your active Pi model (e.g., Gemini 3.5 Flash / Gemini 3.1 Pro) remains the sole reasoning model.
- 🔓 **Credential Reuse:** Automatically uses your existing `codex login` session (`~/.codex/auth.json`) or custom `.env` tokens.
- 🛡️ **Data Privacy:** Query-only by default. Does not send conversation history, project files, or system prompts to search.

---

## 🏗️ Architecture

```text
Pi Coding Agent
 └── Gemini (or active model)
      └── web_search(query: "latest Rust release")
           └── Codex/OpenAI Standalone Search API (/codex/alpha/search)
                └── Structured Results (Title, URL, Snippet)
                     └── Gemini continues reasoning & answers user
```

```text
  +-------------+
  |    User     |
  +------+------+
         | "Search the web for current Rust release notes"
         v
  +-------------+
  |  Pi Agent   |
  +------+------+
         |
         v
  +-------------+       LLM Tool Call (web_search)      +--------------------------+
  |   Gemini    | -----------------------------------> | web_search Tool (tool.ts)|
  +------+------+                                      +------------+-------------+
         ^                                                          |
         |                                                          v
         |                                             +--------------------------+
         |                                             |  CodexWebSearchProvider  |
         |                                             |   (codex-provider.ts)    |
         |                                             +------------+-------------+
         |                                                          |
         |  Structured Search Results                               |  HTTPS POST (Zero GPT)
         |  (Title, URL, Snippet)                                   |  Bearer ChatGPT Token
         |                                                          v
         |                                             +--------------------------+
         |                                             | OpenAI Standalone Search |
         | <------------------------------------------ |  (/codex/alpha/search)   |
         |                                             +--------------------------+
         v
  +-------------+
  | Final Answer|
  +-------------+
```

---

## 📋 Requirements

1. **Pi Coding Agent:** `pi` CLI installed.
2. **Node.js:** `v18.0.0` or higher.
3. **OpenAI Codex Auth:** An authenticated Codex session (run `codex login` in terminal, or set `CODEX_ACCESS_TOKEN` in `.env`).

---

## 🚀 Quick Setup

### 1. Global Installation (Recommended)

Copy or link `pi-gpt-search` to your global Pi extensions directory:

```bash
mkdir -p ~/.pi/agent/extensions
cp -r pi-gpt-search ~/.pi/agent/extensions/
```

### 2. Project-Local Installation

Copy `pi-gpt-search` into your project's `.pi/extensions/` directory:

```bash
mkdir -p .pi/extensions
cp -r pi-gpt-search .pi/extensions/
```

### 3. Environment Variables (Optional)

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

## 💻 Usage

Run `pi` with any model (for example Gemini) and ask a question requiring live web information:

```bash
pi --model antigravity/gemini-3.5-flash "What is the latest release of Rust and what changed?"
```

### Example Log Output (with `PI_WEB_SEARCH_DEBUG=1`):

```text
[PI_WEB_SEARCH_DEBUG] req_id=maqk8a5 query="latest Rust release version and date 2026" provider=codex
[PI_WEB_SEARCH_DEBUG] req_id=maqk8a5 status=200 elapsed_ms=1863 results=41
```

---

## 🧪 Running Tests

`pi-gpt-search` comes with a 4-level test suite:

```bash
npm test
```

Test suite breakdown:
- **Unit Tests (`unit.test.ts`):** Schema validation, DTO normalization, error classes, output formatting.
- **Integration Tests (`provider-integration.test.ts`):** Mock server handling for 200, 401, 403, 429, 500, timeouts, cancellation.
- **Real Search Test (`real-search.test.ts`):** Live execution against OpenAI's search endpoint.
- **Zero-GPT Verification (`zero-gpt.test.ts`):** Network interception test proving **0 GPT inference calls** are made.

---

## 📖 Documentation

- [HOW-IT-WORKS.md](./HOW-IT-WORKS.md) - Deep architectural breakdown of modules, data flow, and cancellation.
- [HOW-IT-WAS-EXTRACT.md](./HOW-IT-WAS-EXTRACT.md) - Reverse-engineering guide documenting how the standalone search endpoint was discovered.

---

## ⚠️ Limitations

- **Search Index Scope:** Returns search result snippets and URLs; does not include a full headless browser DOM renderer.
- **Session Auth:** Requires an active ChatGPT/Codex login session (`codex login`). Expired sessions require running `codex login` to re-authenticate.

---

## 📄 License

MIT License.
