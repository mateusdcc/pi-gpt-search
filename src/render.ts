import { Text } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";
import type { AgentToolResult, Theme, ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import type { SearchResult } from "./normalize.js";

/**
 * Host Theme accessors available at render time beyond the legacy `Theme`
 * type (status/tree). Typed loosely here. The whole body is wrapped in one
 * try/catch so a missing token or field degrades to plain text instead of
 * throwing — a throw makes the host fall back to the grey "thinking" render.
 */
interface RichTheme extends Theme {
  status?: Record<string, string>;
  tree?: { branch?: string; last?: string };
}

const MAX_ANSWER = 3; // results shown in the Answer section (top hits)
const MAX_SOURCES = 6; // index rows shown when collapsed

function domainOf(url: string | undefined): string {
  if (!url) return "";
  const m = /^[a-z]+:\/\/([^/?#]+)/i.exec(url);
  return m ? m[1].replace(/^www\./, "") : url.split("/")[0] ?? "";
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "\u2026" : text;
}

interface SearchDetails {
  query?: string;
  resultCount?: number;
  results?: SearchResult[];
  output?: string;
  command?: { search_query?: Array<{ q?: string }> };
}

export function makeWebToolRenderer(title: string) {
  return (
    result: AgentToolResult<unknown> & { isError?: boolean; content: Array<{ type: string; text?: string }> },
    options: ToolRenderResultOptions,
    theme: RichTheme
  ): Component => {
    const details = (result.details ?? {}) as SearchDetails;

    // Error path: show the message in error color, no box content beyond it.
    if (result.isError) {
      const text = result.content?.[0]?.type === "text" ? result.content[0].text : "Web search failed.";
      return new Text(theme.fg("error", text), 0, 0);
    }

    try {
      const expanded = options.expanded;
      const results = details.results ?? [];
      const query =
        details.query ?? (details.command?.search_query && details.command.search_query[0]?.q) ?? "";

      // Header: status icon + bold tool name + result count.
      const icon = theme.status?.success ?? "";
      const label = theme.fg("toolTitle", theme.bold(title));
      const count =
        results.length > 0
          ? theme.fg("muted", `\u00b7 ${results.length} source${results.length === 1 ? "" : "s"}`)
          : "";
      const lines: string[] = [`${theme.fg("accent", icon)} ${label}${count ? " " + count : ""}`];

      // Query line.
      if (query) {
        lines.push(`${theme.fg("muted", "Query:")} ${theme.fg("text", query)}`);
      }

      // Answer: the top hits, with title/domain/URL/snippet — the actual
      // content of the search, from structured results (not the raw
      // transcript, which carries wordlim/Published/Crawled metadata noise).
      const top = results.slice(0, MAX_ANSWER);
      if (top.length > 0) {
        lines.push(theme.fg("toolTitle", "Answer"));
        for (const [i, r] of top.entries()) {
          const num = theme.fg("accent", `[${i + 1}]`);
          const name = r.title ? r.title : r.url ? r.url : "Untitled";
          const domain = domainOf(r.url);
          const meta = domain ? ` ${theme.fg("dim", `(${domain})`)}` : "";
          lines.push(` ${num} ${theme.fg("text", name)}${meta}`);
          if (r.url) {
            lines.push(`   ${theme.fg("dim", truncate(r.url, 100))}`);
          }
          if (r.snippet) {
            lines.push(`   ${theme.fg("muted", truncate(r.snippet, 180))}`);
          }
        }
      }

      // Sources: the full index. Collapsed shows MAX_SOURCES rows + hint;
      // expanded shows everything. Index rows carry no snippet so the
      // expanded view stays scannable at 42+ results.
      if (results.length > 0) {
        lines.push(theme.fg("toolTitle", "Sources"));
        const shown = expanded ? results : results.slice(0, MAX_SOURCES);
        const branch = theme.tree?.branch ?? "\u251c\u2500";
        const last = theme.tree?.last ?? "\u2514\u2500";
        for (let i = 0; i < shown.length; i++) {
          const r = shown[i];
          const num = theme.fg("accent", `[${i + 1}]`);
          const name = r.title ? r.title : r.url ? r.url : "Untitled";
          const domain = domainOf(r.url);
          const meta = domain ? ` ${theme.fg("dim", `(${domain})`)}` : "";
          // Last shown row uses the last glyph only when the tree really ends
          // there; with more results collapsed below, it's a branch so the
          // expand hint continues the tree.
          const hasMore = !expanded && results.length > shown.length;
          const glyph = i === shown.length - 1 && !hasMore ? last : branch;
          lines.push(` ${theme.fg("dim", glyph)} ${num} ${theme.fg("text", name)}${meta}`);
        }
        if (!expanded && results.length > shown.length) {
          const remaining = results.length - shown.length;
          lines.push(
            ` ${theme.fg("dim", last)} ${theme.fg("muted", `\u2026 ${remaining} more result${remaining === 1 ? "" : "s"} (Ctrl+O to expand)`)}`
          );
        }
      } else if (top.length === 0) {
        lines.push(theme.fg("muted", "No sources returned"));
      }

      return new Text(lines.join("\n"), 0, 0);
    } catch {
      // Fall back to the raw content text rather than throwing (which would
      // trigger the host's grey fallback renderer).
      const text = result.content?.[0]?.type === "text" ? result.content[0].text : "";
      return new Text(text, 0, 0);
    }
  };
}
