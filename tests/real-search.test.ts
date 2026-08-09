import { test } from "node:test";
import assert from "node:assert/strict";
import { CodexWebSearchProvider, loadCodexAuth } from "../src/codex-provider";

test("real-search: genuine search via Codex standalone web search endpoint", async () => {
  const auth = loadCodexAuth();
  if (!auth) {
    console.log("Skipping real-search test because Codex authentication is not available.");
    return;
  }

  const provider = new CodexWebSearchProvider();
  const res = await provider.search({ query: "OpenAI Codex GitHub repository" });

  assert.ok(res.results.length > 0, "Expected at least one search result from real Codex search endpoint");
  const hasUrl = res.results.some((item) => typeof item.url === "string" && item.url.startsWith("http"));
  assert.ok(hasUrl, "Expected at least one search result with a valid HTTP(S) URL");

  console.log(`Real search succeeded! Total results returned: ${res.results.length}`);
  console.log(`First result: "${res.results[0].title}" -> ${res.results[0].url}`);
});
