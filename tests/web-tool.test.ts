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

test("web-tool - tools expose themed renderResult producing structured sections", () => {
  const fakeProvider = {
    async execute() {
      return { results: [] };
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
  const compat = createWebSearchCompatTool(fakeProvider);
  assert.equal(typeof tool.renderResult, "function");
  assert.equal(typeof compat.renderResult, "function");

  const theme = {
    fg: (c: string, t: string) => t,
    bold: (t: string) => t,
    status: { success: "\u2713" },
    tree: { branch: "\u251c", last: "\u2514" },
  } as any;

  const result = {
    details: {
      query: "rust",
      resultCount: 2,
      results: [
        { title: "Rust Blog", url: "https://blog.rust-lang.org/", snippet: "Rust 1.96 release notes" },
        { title: "Rust Docs", url: "https://doc.rust-lang.org/", snippet: "Standard library docs" },
      ],
      output: "Rust 1.96 is the latest stable release.",
    },
    content: [{ type: "text", text: "" }],
    isError: false,
  } as any;

  const rendered = tool.renderResult!(result, { expanded: true, isPartial: false }, theme) as any;
  assert.equal(typeof rendered.render, "function");
  const out = rendered.render(80).join("\n");
  assert.ok(out.includes("codex-research"));
  assert.ok(out.includes("Query:"));
  assert.ok(out.includes("Rust 1.96"));
  assert.ok(out.includes("Sources"));
  assert.ok(out.includes("[1]"));
  assert.ok(out.includes("Rust Blog"));
  assert.ok(out.includes("(blog.rust-lang.org)"));
  assert.ok(out.includes("Rust 1.96 release notes"));

  // Collapsed caps at 6 sources and shows the expand hint.
  const many = {
    details: {
      query: "rust",
      resultCount: 8,
      results: Array.from({ length: 8 }, (_, i) => ({
        title: `Source ${i + 1}`,
        url: `https://example.com/${i}`,
        snippet: `Snippet ${i + 1}`,
      })),
    },
    content: [{ type: "text", text: "" }],
    isError: false,
  } as any;
  const collapsed = tool.renderResult!(many, { expanded: false, isPartial: false }, theme) as any;
  const collapsedOut = collapsed.render(80).join("\n");
  assert.ok(collapsedOut.includes("2 more results"));
  assert.ok(collapsedOut.includes("Ctrl+O to expand"));

  // Error results render without throwing.
  const errorOut = tool.renderResult!(
    { content: [{ type: "text", text: "boom" }], isError: true, details: {} } as any,
    { expanded: true, isPartial: false },
    theme
  ) as any;
  assert.ok(errorOut.render(80).join("\n").includes("boom"));
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
  assert.equal(tool.name, "codex-research");

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
  assert.deepEqual(executedCommand, {
    search_query: [{ q: "rust release" }],
    response_length: "long",
  });
  assert.ok(res.content[0].text.startsWith("Backend output for web tool"));
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
  assert.equal(compatTool.name, "codex-search");

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
  assert.deepEqual(searchCalledWith, {
    query: "pi agent",
    recency: undefined,
    domains: undefined,
    response_length: "short",
  });
  assert.match(res.content[0].text, /Result/);
});
