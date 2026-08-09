import { test } from "node:test";
import assert from "node:assert/strict";
import { formatWebToolResult } from "../src/output";

test("output - formatWebToolResult prefers raw response.output when available", () => {
  const cmd = { search_query: [{ q: "rust" }] };
  const response = {
    output: "Raw backend model output with citations citeturn0search0",
    results: [{ title: "Rust", url: "https://rust-lang.org" }],
  };

  const formatted = formatWebToolResult(cmd, response);
  assert.equal(formatted.content[0].text, "Raw backend model output with citations citeturn0search0");
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
