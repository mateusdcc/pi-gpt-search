import { test } from "node:test";
import assert from "node:assert/strict";
import { createWebTool, createWebSearchCompatTool } from "../src/web-tool";

test("web-tool - createWebTool returns valid definition and executes command", async () => {
  let executedCommand: unknown = null;
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
  assert.ok(tool.promptGuidelines && tool.promptGuidelines.length > 5);

  const res = await tool.execute("call_1", { search_query: [{ q: "rust release" }] }, undefined, () => {}, {} as any);
  assert.deepEqual(executedCommand, { search_query: [{ q: "rust release" }] });
  assert.equal(res.content[0].text, "Backend output for web tool");
  assert.equal((res.details as any).resultCount, 1);
});

test("web-tool - createWebSearchCompatTool translates query into search", async () => {
  let searchCalledWith: unknown = null;
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

  const res = await compatTool.execute("call_2", { query: "pi agent" }, undefined, () => {}, {} as any);
  assert.deepEqual(searchCalledWith, { query: "pi agent" });
  assert.match(res.content[0].text, /Result/);
});
