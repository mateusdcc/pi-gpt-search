import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRawSearchResult, normalizeSearchResponseBody } from "../src/normalize";
import {
  CodexAuthMissingError,
  CodexAuthExpiredError,
  CodexRateLimitError,
  CodexHttpError,
  WebSearchTimeoutError,
  WebSearchCancelledError,
} from "../src/errors";
import { formatSearchResponseText } from "../src/web-tool";

test("normalizeRawSearchResult - valid item", () => {
  const item = {
    title: "Rust Language",
    url: "https://www.rust-lang.org",
    snippet: "Empowering everyone to build reliable and efficient software.",
    domain: "rust-lang.org",
    ref_id: "turn1search0",
    unknown_field: 123,
  };
  const normalized = normalizeRawSearchResult(item);
  assert.equal(normalized?.title, "Rust Language");
  assert.equal(normalized?.url, "https://www.rust-lang.org");
  assert.equal(normalized?.snippet, "Empowering everyone to build reliable and efficient software.");
  assert.equal(normalized?.domain, "rust-lang.org");
  assert.equal(normalized?.ref_id, "turn1search0");
});

test("normalizeRawSearchResult - empty item returns null", () => {
  const item = { invalid: true };
  assert.equal(normalizeRawSearchResult(item), null);
});

test("normalizeSearchResponseBody - handles raw results and preserves output", () => {
  const body = {
    output: "Cleaned model text",
    results: [
      { title: "Item 1", url: "https://example.com/1" },
      { invalid: true },
      { url: "https://example.com/2", snippet: "Snippet 2" },
    ],
    extra_field: "ignored",
  };
  const normalized = normalizeSearchResponseBody(body);
  assert.equal(normalized.output, "Cleaned model text");
  assert.equal(normalized.results.length, 2);
  assert.equal(normalized.results[0].url, "https://example.com/1");
  assert.equal(normalized.results[1].url, "https://example.com/2");
});

test("formatSearchResponseText - empty results", () => {
  const formatted = formatSearchResponseText("rust", { results: [] });
  assert.equal(formatted, 'No web search results found for: "rust".');
});

test("formatSearchResponseText - non-empty results", () => {
  const formatted = formatSearchResponseText("rust", {
    results: [
      { title: "Rust Org", url: "https://rust-lang.org", snippet: "Rust home" },
    ],
  });
  assert.match(formatted, /Search results for: "rust"/);
  assert.match(formatted, /1\. Rust Org/);
  assert.match(formatted, /URL: https:\/\/rust-lang\.org/);
  assert.match(formatted, /Rust home/);
});

test("WebSearchError factories have correct codes", () => {
  assert.equal(CodexAuthMissingError().code, "CODEX_AUTH_MISSING");
  assert.equal(CodexAuthExpiredError().code, "CODEX_AUTH_EXPIRED");
  assert.equal(CodexRateLimitError().code, "CODEX_RATE_LIMIT");
  assert.equal(CodexHttpError(500, "Internal Server Error").code, "CODEX_HTTP_ERROR");
  assert.equal(WebSearchTimeoutError(5000).code, "WEB_SEARCH_TIMEOUT");
  assert.equal(WebSearchCancelledError().code, "WEB_SEARCH_CANCELLED");
});
