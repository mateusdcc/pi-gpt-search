import { test } from "node:test";
import assert from "node:assert/strict";
import { filterSearchContext } from "../src/context";

test("context - mode='none' returns empty array", () => {
  const turns = [{ role: "user", content: "hello" }];
  const res = filterSearchContext(turns, "none");
  assert.deepEqual(res, []);
});

test("context - filters out system, tool, and sensitive turns", () => {
  const turns = [
    { role: "system", content: "You are an AI assistant." },
    { role: "user", content: "What is Rust?" },
    { role: "tool", content: "Tool output data" },
    { role: "assistant", content: "Rust is a systems programming language." },
    { role: "user", content: "My token is CODEX_ACCESS_TOKEN=secret" },
    { role: "user", content: "Latest Rust release?" },
  ];

  const res = filterSearchContext(turns, "recent");
  assert.equal(res.length, 3);
  assert.deepEqual(res[0], { role: "user", content: "What is Rust?" });
  assert.deepEqual(res[1], { role: "assistant", content: "Rust is a systems programming language." });
  assert.deepEqual(res[2], { role: "user", content: "Latest Rust release?" });
});

test("context - truncates long assistant turns", () => {
  const turns = [
    { role: "user", content: "Tell me about TypeScript" },
    { role: "assistant", content: "A".repeat(1000) },
  ];

  const res = filterSearchContext(turns, "recent");
  assert.equal(res.length, 2);
  assert.ok(res[1].content.endsWith("... [truncated]"));
  assert.ok(res[1].content.length < 600);
});
