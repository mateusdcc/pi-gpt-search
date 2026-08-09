# pi-gpt-search

> **Native, Model-Independent Web Research Harness for Pi powered by OpenAI Codex Standalone Search Engine.**

`pi-gpt-search` gives **any** active Pi model (Gemini, Claude, DeepSeek, local models, OpenRouter) real-time, multi-step web research capabilities using OpenAI Codex's standalone search and browsing infrastructure—with **Zero Additional GPT Agent Turns**.

---

## ⚡ Quick Start: 1-Line Installation

Install from feature branch via GitHub:

```bash
pi install https://github.com/mateusdcc/pi-gpt-search#feat/codex-web-harness
```

Or install project-locally for your current repository (`-l` flag):

```bash
pi install https://github.com/mateusdcc/pi-gpt-search#feat/codex-web-harness -l
```

Or try it temporarily in a single session without installing:

```bash
pi -ne -e https://github.com/mateusdcc/pi-gpt-search#feat/codex-web-harness
```

---

## ⚡ Architecture & Zero-Agent-Turn Guarantee

```text
Pi Coding Agent (Active Model: Gemini / Claude / DeepSeek / etc.)
     │
     ▼
web({ search_query, open, find, click, response_length })
     │
     ▼
Codex Standalone Search Endpoint (/backend-api/codex/alpha/search)
     │
     ▼
Model-Oriented Output + OSC 8 Hyperlinks + Structured Details
     │
     ▼
Active Model (Evaluates evidence, decides next web action or final answer)
```

- **Zero Additional GPT Agent Turns:** The extension does not invoke a separate GPT/Codex agent turn to perform web research. It calls OpenAI Codex's standalone search endpoint directly.
- **Model-Independent Reasoning:** Your active Pi session model controls the research loop, deciding when to search, open documents, find patterns, follow links, or finish.
- **Clickable Terminal Hyperlinks (Cmd+Click):** Inline citations `[1]`, `[2]` and `Sources:` links are formatted as OSC 8 terminal escape sequences. Holding `Cmd`/`Ctrl` reveals the target URL and clicking opens it in your default browser.
- **Compact Collapsible TUI Display:** Tool calls collapse into a single-line status row (`✓ Web action complete (N results) (Ctrl+O to expand)`).
- **Context Isolation:** Raw HTML/JSON data is excluded from LLM prompt memory, keeping context overhead near zero while storing full details in local TUI state.
- **Session Reference Continuity:** Session IDs map across multi-step research calls, preserving `ref_id` targets across `search` -> `open` -> `find` -> `click` actions.

---

## 🛠️ Model Tools & Commands

### 1. Primary Model Tool: `web`

Supported web research actions:

```typescript
interface WebRunCommand {
  search_query?: Array<{ q: string; recency?: number; domains?: string[] }>;
  open?: Array<{ ref_id: string; lineno?: number }>;
  click?: Array<{ ref_id: string; id: number }>;
  find?: Array<{ ref_id: string; pattern: string }>;
  response_length?: "short" | "medium" | "long";
}
```

Example usage by the active model:

```json
{
  "search_query": [
    { "q": "OpenAI Codex GitHub repository", "domains": ["github.com"] }
  ],
  "response_length": "medium"
}
```

Followed by opening the retrieved reference in the same session:

```json
{
  "open": [
    { "ref_id": "turn0search0" }
  ]
}
```

Followed by finding specific patterns inside the document:

```json
{
  "find": [
    { "ref_id": "turn1view0", "pattern": "terminal" }
  ]
}
```

### 2. Compatibility Tool: `web_search`

Legacy wrapper for simple single-query lookups:

```json
{
  "query": "Rust 1.97 release notes"
}
```

Internally translates into `web({ search_query: [{ q: "query" }] })`.

### 3. Direct User Slash Command: `/gpt-search`

Perform direct web searches from the Pi prompt without consuming LLM reasoning turns:

```text
/gpt-search OpenAI Codex release notes
```

---

## 🔑 Authentication

Automatically resolves authentication in order of priority:
1. `CODEX_ACCESS_TOKEN` / `CODEX_ACCOUNT_ID` in `.env` or process environment.
2. Saved CLI session credentials in `~/.codex/auth.json` (from running `codex login`).

> Credentials are kept secure and never exposed to the LLM or printed in debug logs.

---

## 🧪 Testing Suite

Run the full test suite (unit, integration, real endpoint, zero-agent turn, and E2E):

```bash
npm test
```

### Test Suite Breakdown:

- **Unit Tests (`commands.test.ts`, `normalize.test.ts`, `context.test.ts`, `output.test.ts`, `web-tool.test.ts`, `unit.test.ts`):** Validates DTO parsing, command validation, output formatting, context filtering, and tool schemas.
- **Provider Integration Tests (`provider-integration.test.ts`):** Deterministic mock tests for 200, 401, 403, 429, 500, timeout, and cancellation error handling.
- **Real Endpoint Integration (`real-endpoint.test.ts` & `real-search.test.ts`):** Exercises the live Codex endpoint for session continuity (`search` -> `open` -> `find`), `response_length`, and domain filters.
- **Zero-GPT Verification (`zero-gpt.test.ts`):** Proves that rich web commands execute with **0 GPT model inference calls** (`chat/completions`, `responses`, `turn/start`).
- **Pi E2E Harness Suite (`e2e-research.test.ts`):** Full end-to-end research harness tests running Pi CLI with the active model, validating single-step search, multi-step `search` -> `open` research, `search` -> `open` -> `find` patterns, fresh information lookups, and error recovery.

---

## 📄 Documentation

- [HOW-IT-WORKS.md](./HOW-IT-WORKS.md) - Complete technical breakdown of architecture, data flow, TUI renderers, context isolation, and error handling.

---

## 📄 License

MIT License.
