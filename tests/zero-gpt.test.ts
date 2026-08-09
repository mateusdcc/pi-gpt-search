import { test } from "node:test";
import assert from "node:assert/strict";
import { CodexWebSearchProvider, loadCodexAuth } from "../src/codex-provider";

test("zero-gpt: search succeeds with ZERO GPT/Codex model inference calls", async () => {
  const auth = loadCodexAuth();
  if (!auth) {
    console.log("Skipping zero-gpt test because Codex authentication is not available.");
    return;
  }

  let gptInferenceCallsCount = 0;
  let standaloneSearchCallsCount = 0;

  const FORBIDDEN_MODEL_PATTERNS = [
    /chat\/completions/i,
    /completions/i,
    /responses/i,
    /turn\/start/i,
    /conversation/i,
    /model/i,
  ];

  const proxyFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;

    // Check if request is going to any model inference route
    for (const pattern of FORBIDDEN_MODEL_PATTERNS) {
      if (pattern.test(url) && !url.includes("alpha/search")) {
        gptInferenceCallsCount++;
        throw new Error(`CRITICAL INVARIANT VIOLATION: Attempted to call model inference route: ${url}`);
      }
    }

    if (url.includes("backend-api/codex/alpha/search")) {
      standaloneSearchCallsCount++;
    }

    return globalThis.fetch(input, init);
  };

  const provider = new CodexWebSearchProvider({ customFetch: proxyFetch });
  const res = await provider.search({ query: "OpenAI Codex GitHub repository" });

  assert.ok(res.results.length > 0, "Expected search results");
  assert.equal(standaloneSearchCallsCount, 1, "Expected exactly 1 standalone search HTTP request");
  assert.equal(gptInferenceCallsCount, 0, "CRITICAL: GPT model inference count MUST be 0");

  console.log("Zero-GPT Verification Passed!");
  console.log(`- Standalone search calls: ${standaloneSearchCallsCount}`);
  console.log(`- GPT Model inference calls: ${gptInferenceCallsCount}`);
});
