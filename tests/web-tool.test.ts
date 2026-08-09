import { test } from "node:test";
import assert from "node:assert/strict";
import { createWebTool, createWebSearchCompatTool, describeCommandStatus } from "../src/web-tool";

test("web-tool - describeCommandStatus formats readable action summaries", () => {
  assert.equal(
    describeCommandStatus({ search_query: [{ q: "rust" }] }),
    'Searching web for "rust"...'
  );
  assert.equal(
    describeCommandStatus({ open: [{ ref_id: "turn0search0" }] }),
    "Opening document turn0search0..."
  );
  assert.equal(
    describeCommandStatus({ find: [{ ref_id: "turn1view0", pattern: "license" }] }),
    'Finding pattern "license" in turn1view0...'
  );
});

test("web-tool - createWebTool invokes onUpdate progress handler", async () => {
  let executedCommand: unknown = null;
  const updates: any[] = [];

  const fakeProvider = {
    async execute(cmd: unknown) {
      executedCommand = cmd;
      return {
        output: "Backend output for web tool",
        results: [{ title: "Item 1", url: "https://example.com", ref_id: "turn0search0" }],
      };
    },
    async search() {
      return { results: [] };
    },
    getSessionId() {
      return "test_session";
    },
    setSessionId() {},
  };

  const tool = createWebTool(fakeProvider);
  assert.equal(tool.name, "web");

  const res = await tool.execute(
    "call_1",
    { search_query: [{ q: "rust release" }] },
    undefined,
    (update) => {
      updates.push(update);
    },
    {} as any
  );

  assert.equal(updates.length, 1);
  assert.equal(updates[0].content[0].text, 'Searching web for "rust release"...');
  assert.deepEqual(executedCommand, { search_query: [{ q: "rust release" }] });
  assert.equal(res.content[0].text, "Backend output for web tool");
});

test("web-tool - createWebSearchCompatTool translates query into search and calls onUpdate", async () => {
  let searchCalledWith: unknown = null;
  const updates: any[] = [];

  const fakeProvider = {
    async execute() {
      return { results: [] };
    },
    async search(req: { query: string }) {
      searchCalledWith = req;
      return {
        results: [{ title: "Result", url: "https://example.com" }],
      };
    },
    getSessionId() {
      return "test_session";
    },
    setSessionId() {},
  };

  const compatTool = createWebSearchCompatTool(fakeProvider);
  assert.equal(compatTool.name, "web_search");

  const res = await compatTool.execute(
    "call_2",
    { query: "pi agent" },
    undefined,
    (update) => {
      updates.push(update);
    },
    {} as any
  );

  assert.equal(updates.length, 1);
  assert.equal(updates[0].content[0].text, 'Searching web for "pi agent"...');
  assert.deepEqual(searchCalledWith, { query: "pi agent" });
  assert.match(res.content[0].text, /Result/);
});
