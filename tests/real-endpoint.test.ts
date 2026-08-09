import { test } from "node:test";
import assert from "node:assert/strict";
import { CodexWebSearchProvider, loadCodexAuth } from "../src/codex-provider";

test("real-endpoint Test A: search_query returns valid results and model output", async () => {
  const auth = loadCodexAuth();
  if (!auth) {
    console.log("SKIPPED real-endpoint Test A: Codex auth not available");
    return;
  }

  const provider = new CodexWebSearchProvider();
  const res = await provider.execute({
    search_query: [{ q: "OpenAI Codex GitHub repository" }],
  });

  assert.ok(res.results.length > 0, "Expected search results");
  assert.ok(typeof res.output === "string" && res.output.length > 0, "Expected non-empty model output string");
  const firstRef = res.results.find((r) => r.ref_id || r.refId);
  assert.ok(firstRef, "Expected at least one result with a ref_id");
});

test("real-endpoint Test B: search -> open session continuity preserves reference IDs", async () => {
  const auth = loadCodexAuth();
  if (!auth) {
    console.log("SKIPPED real-endpoint Test B: Codex auth not available");
    return;
  }

  const provider = new CodexWebSearchProvider();

  // Step 1: search
  const searchRes = await provider.execute({
    search_query: [{ q: "OpenAI Codex GitHub repository" }],
  });

  const refItem = searchRes.results.find((r) => r.ref_id || r.refId);
  assert.ok(refItem, "Expected result with ref_id");
  const refId = (refItem.ref_id || refItem.refId)!;

  // Step 2: open using refId in same session
  const openRes = await provider.execute({
    open: [{ ref_id: refId }],
  });

  assert.ok(typeof openRes.output === "string" && openRes.output.length > 0, "Expected page content in open output");
  assert.ok(openRes.output.includes("Source: open") || openRes.output.includes("Crawled") || openRes.output.includes(refId), "Open output should acknowledge page contents");
});

test("real-endpoint Test C: search -> open -> find session continuity", async () => {
  const auth = loadCodexAuth();
  if (!auth) {
    console.log("SKIPPED real-endpoint Test C: Codex auth not available");
    return;
  }

  const provider = new CodexWebSearchProvider();

  // Step 1: search
  const searchRes = await provider.execute({
    search_query: [{ q: "OpenAI Codex GitHub repository" }],
  });
  const refItem = searchRes.results.find((r) => r.ref_id || r.refId);
  assert.ok(refItem, "Expected result with ref_id");
  const searchRef = (refItem.ref_id || refItem.refId)!;

  // Step 2: open
  const openRes = await provider.execute({
    open: [{ ref_id: searchRef }],
  });
  const openRefItem = openRes.results.find((r) => r.ref_id || r.refId);
  const openRef = openRefItem ? (openRefItem.ref_id || openRefItem.refId)! : searchRef;

  // Step 3: find pattern in opened document
  const findRes = await provider.execute({
    find: [{ ref_id: openRef, pattern: "terminal" }],
  });

  assert.ok(typeof findRes.output === "string" && findRes.output.length > 0, "Expected pattern search results output");
});

test("real-endpoint Test D: response_length parameter accepted by endpoint", async () => {
  const auth = loadCodexAuth();
  if (!auth) {
    console.log("SKIPPED real-endpoint Test D: Codex auth not available");
    return;
  }

  const provider = new CodexWebSearchProvider();
  const res = await provider.execute({
    search_query: [{ q: "Rust programming language" }],
    response_length: "short",
  });

  assert.ok(typeof res.output === "string" && res.output.length > 0);
});

test("real-endpoint Test E: domain-filtered query", async () => {
  const auth = loadCodexAuth();
  if (!auth) {
    console.log("SKIPPED real-endpoint Test E: Codex auth not available");
    return;
  }

  const provider = new CodexWebSearchProvider();
  const res = await provider.execute({
    search_query: [{ q: "Rust releases", domains: ["rust-lang.org"] }],
  });

  assert.ok(res.results.length > 0);
  assert.ok(res.results.some((r) => r.domain?.includes("rust-lang.org") || r.url?.includes("rust-lang.org")));
});
