import { test } from "node:test";
import assert from "node:assert/strict";
import { createResearchTool } from "../src/research-tool";
import { createSearchTool } from "../src/search-tool";
import { createLegacyWebTool, WEB_DEPRECATION_MESSAGE } from "../src/legacy-web-tool";
import { describeCommandStatus } from "../src/web-format";

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

const theme = {
  fg: (c: string, t: string) => t,
  bold: (t: string) => t,
  status: { success: "\u2713" },
  tree: { branch: "\u251c", last: "\u2514" },
} as any;

function renderTool(tool: ReturnType<typeof createResearchTool>, result: any, expanded: boolean) {
  const rendered = tool.renderResult!(result, { expanded, isPartial: false }, theme, {} as any) as any;
  assert.equal(typeof rendered.render, "function");
  return rendered.render(80).join("\n");
}

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
  const tool = createResearchTool(fakeProvider);
  const compat = createSearchTool(fakeProvider);
  assert.equal(typeof tool.renderResult, "function");
  assert.equal(typeof compat.renderResult, "function");

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
    content: [{ type: "text", text: "Rust 1.96 is the latest stable release." }],
    isError: false,
  } as any;

  const out = renderTool(tool, result, true);
  assert.ok(out.includes("codex-research"));
  assert.ok(out.includes("Query:"));
  assert.ok(out.includes("Rust 1.96"));
  assert.ok(out.includes("Results"));
  assert.ok(out.includes("Sources"));
  assert.ok(out.includes("[1]"));
  assert.ok(out.includes("Rust Blog"));
  assert.ok(out.includes("(blog.rust-lang.org)"));

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
  const collapsedOut = renderTool(tool, many, false);
  assert.ok(collapsedOut.includes("2 more results"));
  assert.ok(collapsedOut.includes("Ctrl+O to expand"));

  // Error results render without throwing.
  const errorOut = renderTool(
    tool,
    { content: [{ type: "text", text: "boom" }], isError: true, details: {} } as any,
    true
  );
  assert.ok(errorOut.includes("boom"));
});

test("web-tool - expanded renderer does not duplicate formatted sources", async () => {
  const provider = {
    ...fakeProvider,
    async execute() {
      return {
        output: "Backend answer",
        results: [{ title: "Example", url: "https://example.com", ref_id: "turn0search0" }],
      };
    },
  };
  const tool = createResearchTool(provider);
  const result = await tool.execute(
    "call_sources",
    { search_query: [{ q: "test" }] },
    undefined,
    undefined,
    {} as any
  );

  const output = renderTool(tool, result, true);
  const sourceHeadings = output
    .split("\n")
    .filter((line) => line.trim() === "Sources" || line.trim() === "Sources:");
  assert.equal(sourceHeadings.length, 1);
});

test("web-tool - expanded renderer shows actual open/find/click backend content", () => {
  const tool = createResearchTool(fakeProvider);

  // open: structured snippet is tiny (16 chars), backend output is large — the
  // expanded view must surface the full document content the model received.
  const openResult = {
    details: {
      command: { open: [{ ref_id: "turn0search0" }] },
      results: [{ ref_id: "turn0search0", title: "OpenAI Codex", url: "https://github.com/openai/codex", snippet: "Tiny snippet" }],
    },
    content: [{ type: "text", text: "# OpenAI Codex\n\nOpenAI Codex is a coding agent...\n".repeat(50) }],
    isError: false,
  } as any;

  const collapsedOpen = renderTool(tool, openResult, false);
  assert.ok(collapsedOpen.includes("Tiny snippet") || collapsedOpen.includes("# OpenAI Codex"));
  assert.ok(collapsedOpen.includes("Ctrl+O to expand"));

  const expandedOpen = renderTool(tool, openResult, true);
  assert.ok(expandedOpen.includes("OpenAI Codex is a coding agent..."));
  assert.ok(expandedOpen.length > 1000, "expanded view should surface the full document content");
  assert.ok(expandedOpen.includes("Sources"));

  // find: pattern match results inside a long document.
  const findResult = {
    details: {
      command: { find: [{ ref_id: "turn1view0", pattern: "license" }] },
      results: [{ ref_id: "turn1view0", title: "License section", url: "https://example.com/doc", snippet: "match" }],
    },
    content: [{ type: "text", text: "Lines containing 'license':\nLICENSE: MIT License\nSPDX-License-Identifier: MIT" }],
    isError: false,
  } as any;

  const expandedFind = renderTool(tool, findResult, true);
  assert.ok(expandedFind.includes("SPDX-License-Identifier: MIT"));
  assert.ok(expandedFind.includes("Lines containing 'license':"));

  // click: element content output.
  const clickResult = {
    details: {
      command: { click: [{ ref_id: "turn1view0", id: 0 }] },
      results: [{ ref_id: "turn1view0", title: "Clicked element", url: "https://example.com/elem", snippet: "element" }],
    },
    content: [{ type: "text", text: "Clicked element content:\nRead more about the feature here." }],
    isError: false,
  } as any;

  const expandedClick = renderTool(tool, clickResult, true);
  assert.ok(expandedClick.includes("Read more about the feature here."));
});

test("web-tool - legacy web alias delegates and shows deprecation, codex-research does not", async () => {
  let executedCommand: unknown = null;
  const provider = {
    async execute(cmd: unknown) {
      executedCommand = cmd;
      return {
        output: "Backend output",
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

  const research = createResearchTool(provider);
  const legacy = createLegacyWebTool(provider);
  assert.equal(legacy.name, "web");
  assert.equal(research.name, "codex-research");

  const res = (await research.execute("call_1", { search_query: [{ q: "rust" }] }, undefined, undefined, {} as any)) as any;
  assert.ok(!res.content[0].text.includes(WEB_DEPRECATION_MESSAGE), "codex-research should not show deprecation");
  assert.ok(res.content[0].text.startsWith("Backend output"));

  const legacyRes = (await legacy.execute("call_2", { search_query: [{ q: "rust" }] }, undefined, undefined, {} as any)) as any;
  assert.ok(legacyRes.content[0].text.includes(WEB_DEPRECATION_MESSAGE), "web alias should show deprecation");
  assert.ok(legacyRes.content[0].text.includes("Backend output"), "web alias should delegate to research implementation");
  assert.deepEqual(executedCommand, {
    search_query: [{ q: "rust" }],
    response_length: "long",
  });
});

test("web-tool - createResearchTool invokes onUpdate progress handler", async () => {
  const updates: any[] = [];

  const provider = {
    async execute(cmd: unknown) {
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

  const tool = createResearchTool(provider);
  assert.equal(tool.name, "codex-research");

  const res = (await tool.execute(
    "call_1",
    { search_query: [{ q: "rust release" }] },
    undefined,
    (update) => {
      updates.push(update);
    },
    {} as any
  )) as any;

  assert.equal(updates.length, 1);
  assert.equal(updates[0].content[0].text, 'Searching web for "rust release"...');
  assert.ok(res.content[0].text.startsWith("Backend output for web tool"));
});

test("web-tool - createSearchTool translates query into search and calls onUpdate", async () => {
  let searchCalledWith: unknown = null;
  const updates: any[] = [];

  const provider = {
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

  const compatTool = createSearchTool(provider);
  assert.equal(compatTool.name, "codex-search");

  const res = (await compatTool.execute(
    "call_2",
    { query: "pi agent" },
    undefined,
    (update) => {
      updates.push(update);
    },
    {} as any
  )) as any;

  assert.equal(updates.length, 1);
  assert.equal(updates[0].content[0].text, 'Searching web for "pi agent"...');
  assert.deepEqual(searchCalledWith, {
    query: "pi agent",
    recency: undefined,
    domains: undefined,
    response_length: "short",
  });
  assert.match(res.content[0].text, /Result/);

  await compatTool.execute(
    "call_3",
    {
      query: "release notes",
      recency: 30,
      domains: ["example.com"],
      response_length: "medium",
    },
    undefined,
    undefined,
    {} as any
  );
  assert.deepEqual(searchCalledWith, {
    query: "release notes",
    recency: 30,
    domains: ["example.com"],
    response_length: "medium",
  });
});
