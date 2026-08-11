import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateSearchToolRequest,
  validateWebRunCommand,
  serializeWebRunPayload,
  InvalidCommandError,
} from "../src/commands";

test("commands - validateSearchToolRequest normalizes tool parameters", () => {
  assert.deepEqual(
    validateSearchToolRequest({
      query: "  Rust  ",
      recency: 7,
      domains: [" rust-lang.org "],
      response_length: "medium",
    }),
    {
      query: "Rust",
      recency: 7,
      domains: ["rust-lang.org"],
      response_length: "medium",
    }
  );
  assert.throws(() => validateSearchToolRequest({ query: "", domains: ["example.com"] }));
  assert.throws(() => validateSearchToolRequest({ query: "Rust", domains: ["", 1] }));
});

test("commands - validateWebRunCommand valid search_query", () => {
  const input = {
    search_query: [{ q: "  openai codex  ", recency: 7, domains: ["github.com"] }],
    response_length: "short",
  };
  const validated = validateWebRunCommand(input);
  assert.deepEqual(validated, {
    search_query: [{ q: "openai codex", recency: 7, domains: ["github.com"] }],
    response_length: "short",
  });
});

test("commands - validateWebRunCommand valid open operation", () => {
  const input = {
    open: [{ ref_id: "turn0search0", lineno: 12 }],
  };
  const validated = validateWebRunCommand(input);
  assert.deepEqual(validated, {
    open: [{ ref_id: "turn0search0", lineno: 12 }],
  });
});

test("commands - validateWebRunCommand valid find operation", () => {
  const input = {
    find: [{ ref_id: "turn1view0", pattern: "license" }],
  };
  const validated = validateWebRunCommand(input);
  assert.deepEqual(validated, {
    find: [{ ref_id: "turn1view0", pattern: "license" }],
  });
});

test("commands - validateWebRunCommand valid click operation", () => {
  const input = {
    click: [{ ref_id: "turn1view0", id: 3 }],
  };
  const validated = validateWebRunCommand(input);
  assert.deepEqual(validated, {
    click: [{ ref_id: "turn1view0", id: 3 }],
  });
});

test("commands - validateWebRunCommand empty operations throws", () => {
  assert.throws(
    () => validateWebRunCommand({ response_length: "short" }),
    (err) => err instanceof InvalidCommandError && err.message.includes("at least one operation")
  );
});

test("commands - serializeWebRunPayload formats correct payload structure", () => {
  const cmd = {
    search_query: [{ q: "test" }],
    response_length: "medium" as const,
  };
  const payload = serializeWebRunPayload(cmd, { sessionId: "session_123" });
  assert.deepEqual(payload, {
    id: "session_123",
    model: "gpt-4o",
    commands: {
      search_query: [{ q: "test" }],
      response_length: "medium",
    },
  });
});
