import { test } from "node:test";
import assert from "node:assert/strict";
import { formatWebToolResult, cleanCitationMarkers } from "../src/output";

test("output - cleanCitationMarkers replaces unicode citation markers with clean inline TUI references", () => {
  const text = "OpenAI Codex \uE200cite\uE202turn0search0\uE201 L0: \uE200cite\uE2020†Skip to content\uE201";
  const results = [
    { ref_id: "turn0search0", title: "OpenAI Codex GitHub", url: "https://github.com/openai/codex" },
  ];

  const cleaned = cleanCitationMarkers(text, results);
  assert.equal(
    cleaned,
    "OpenAI Codex [turn0search0: OpenAI Codex GitHub (https://github.com/openai/codex)] L0: [Skip to content]"
  );
});

test("output - formatWebToolResult cleans citation markers in response.output", () => {
  const cmd = { search_query: [{ q: "rust" }] };
  const response = {
    output: "Raw backend model output with citations \uE200cite\uE202turn0search0\uE201",
    results: [{ ref_id: "turn0search0", title: "Rust", url: "https://rust-lang.org" }],
  };

  const formatted = formatWebToolResult(cmd, response);
  assert.equal(
    formatted.content[0].text,
    "Raw backend model output with citations [turn0search0: Rust (https://rust-lang.org)]"
  );
  assert.equal(formatted.details.resultCount, 1);
  assert.deepEqual(formatted.details.results, response.results);
});

test("output - formatWebToolResult falls back to formatted results if output is empty", () => {
  const cmd = { search_query: [{ q: "rust" }] };
  const response = {
    output: "",
    results: [{ title: "Rust", url: "https://rust-lang.org", snippet: "Rust lang" }],
  };

  const formatted = formatWebToolResult(cmd, response);
  assert.match(formatted.content[0].text, /Web Search Results:/);
  assert.match(formatted.content[0].text, /Rust/);
  assert.match(formatted.content[0].text, /https:\/\/rust-lang\.org/);
});

test("output - formatWebToolResult handles empty output and empty results", () => {
  const cmd = { search_query: [{ q: "nonexistent" }] };
  const response = { results: [] };

  const formatted = formatWebToolResult(cmd, response);
  assert.equal(formatted.content[0].text, "No output or structured web results returned.");
});
