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

test("gpt-search renders successful output through the Pi transcript", async () => {
  let handler: CommandHandler | undefined;
  let renderer: EntryRenderer | undefined;
  const entries: Array<{ type: string; data: unknown }> = [];
  const statuses: Array<string | undefined> = [];

  const pi = {
    registerCommand: (_name: string, command: { handler: CommandHandler }) => {
      handler = command.handler;
    },
    registerEntryRenderer: (_type: string, entryRenderer: EntryRenderer) => {
      renderer = entryRenderer;
    },
    appendEntry: (type: string, data: unknown) => {
      entries.push({ type, data });
    },
  } as unknown as ExtensionAPI;

  const response = {
    output: "Search answer",
    results: [{ title: "Example", url: "https://example.com" }],
  };
  const provider: WebSearchProvider = {
    search: async () => response,
    execute: async () => response,
    getSessionId: () => "test-session",
    setSessionId: () => {},
  };

  registerSearchCommand(pi, provider);
  assert.ok(handler);
  assert.ok(renderer);

  await handler(" Rust ", {
    signal: new AbortController().signal,
    ui: {
      notify: () => {},
      setStatus: (_key, value) => statuses.push(value),
      print: () => {
        throw new Error("must not print outside Pi's render flow");
      },
    },
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].type, SEARCH_OUTPUT_ENTRY_TYPE);
  assert.match((entries[0].data as { text: string }).text, /Search answer/);
  assert.deepEqual(statuses, ['Searching web for "Rust"...', undefined]);

  const component = renderer(
    { data: entries[0].data },
    { expanded: false },
    { fg: (_color, text) => text }
  );
  assert.match(component.render(80).join("\n"), /Search answer/);
});
