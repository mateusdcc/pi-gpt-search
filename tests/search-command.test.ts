import { test } from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { WebSearchProvider } from "../src/provider";
import { registerSearchCommand, SEARCH_OUTPUT_ENTRY_TYPE } from "../src/search-command";

type CommandContext = {
  signal: AbortSignal;
  ui: {
    notify: (message: string, level: string) => void;
    setStatus: (key: string, value: string | undefined) => void;
    print: () => never;
  };
};

type CommandHandler = (args: string, ctx: CommandContext) => Promise<void>;
type EntryRenderer = (
  entry: { data: unknown },
  options: { expanded: boolean },
  theme: { fg: (_color: string, text: string) => string }
) => { render: (width: number) => string[] };

function createPi() {
  const handlers = new Map<string, CommandHandler>();
  const entries: Array<{ type: string; data: unknown }> = [];
  let renderer: EntryRenderer | undefined;
  const pi = {
    registerCommand: (name: string, command: { handler: CommandHandler }) => handlers.set(name, command.handler),
    registerEntryRenderer: (_type: string, entryRenderer: EntryRenderer) => {
      renderer = entryRenderer;
    },
    appendEntry: (type: string, data: unknown) => entries.push({ type, data }),
  } as unknown as ExtensionAPI;
  return { pi, handlers, entries, get renderer() { return renderer; } };
}

function createContext(statuses: Array<string | undefined>, notices: string[] = []): CommandContext {
  return {
    signal: new AbortController().signal,
    ui: {
      notify: (message) => notices.push(message),
      setStatus: (_key, value) => statuses.push(value),
      print: () => {
        throw new Error("must not print outside Pi's render flow");
      },
    },
  };
}

test("slash commands render successful output through the Pi transcript", async () => {
  const harness = createPi();
  const { pi, handlers, entries } = harness;
  const statuses: Array<string | undefined> = [];
  const response = { output: "Search answer", results: [{ title: "Example", url: "https://example.com" }] };
  const provider: WebSearchProvider = {
    search: async () => response,
    execute: async () => response,
    getSessionId: () => "test-session",
    setSessionId: () => {},
  };

  registerSearchCommand(pi, provider);
  assert.deepEqual([...handlers.keys()], ["gpt-search", "codex-search", "codex-research"]);
  assert.ok(harness.renderer);

  await handlers.get("gpt-search")!(" Rust ", createContext(statuses));

  assert.equal(entries.length, 1);
  assert.equal(entries[0].type, SEARCH_OUTPUT_ENTRY_TYPE);
  assert.match((entries[0].data as { text: string }).text, /Search answer/);
  assert.deepEqual(statuses, ['Searching web for "Rust"...', undefined]);

  const component = harness.renderer!(
    { data: entries[0].data },
    { expanded: false },
    { fg: (_color, text) => text }
  );
  assert.match(component.render(80).join("\n"), /Search answer/);
});

test("codex-search invokes its tool path with JSON filters", async () => {
  const { pi, handlers, entries } = createPi();
  const requests: unknown[] = [];
  const provider: WebSearchProvider = {
    search: async (request) => {
      requests.push(request);
      return { results: [{ title: "Rust", url: "https://rust-lang.org" }] };
    },
    execute: async () => ({ results: [] }),
    getSessionId: () => "test-session",
    setSessionId: () => {},
  };

  registerSearchCommand(pi, provider);
  await handlers.get("codex-search")!(
    '{"query":" Rust releases ","recency":7,"domains":["rust-lang.org"],"response_length":"medium"}',
    createContext([])
  );

  assert.deepEqual(requests, [{
    query: "Rust releases",
    recency: 7,
    domains: ["rust-lang.org"],
    response_length: "medium",
  }]);
  assert.match((entries[0].data as { text: string }).text, /Search results for: "Rust releases"/);
});

test("codex-research accepts a shorthand query and JSON research commands", async () => {
  const { pi, handlers, entries } = createPi();
  const commands: unknown[] = [];
  const provider: WebSearchProvider = {
    search: async () => ({ results: [] }),
    execute: async (command) => {
      commands.push(command);
      return { output: "Research result", results: [] };
    },
    getSessionId: () => "test-session",
    setSessionId: () => {},
  };

  registerSearchCommand(pi, provider);
  const context = createContext([]);
  await handlers.get("codex-research")!("OpenAI Codex repository", context);
  await handlers.get("codex-research")!('{"open":[{"ref_id":"turn0search0"}]}', context);

  assert.deepEqual(commands, [
    { search_query: [{ q: "OpenAI Codex repository" }], response_length: "long" },
    { open: [{ ref_id: "turn0search0" }], response_length: "long" },
  ]);
  assert.equal(entries.length, 2);
});

test("slash commands report invalid arguments without making a request", async () => {
  const { pi, handlers, entries } = createPi();
  let calls = 0;
  const notices: string[] = [];
  const provider: WebSearchProvider = {
    search: async () => {
      calls++;
      return { results: [] };
    },
    execute: async () => {
      calls++;
      return { results: [] };
    },
    getSessionId: () => "test-session",
    setSessionId: () => {},
  };

  registerSearchCommand(pi, provider);
  await handlers.get("codex-research")!("{not-json}", createContext([], notices));

  assert.equal(calls, 0);
  assert.equal(entries.length, 0);
  assert.deepEqual(notices, ["/codex-research expects valid JSON parameters"]);
});
