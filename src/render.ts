import { Text } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";
import type { AgentToolResult, Theme, ToolRenderResultOptions } from "@earendil-works/pi-coding-agent";
import type { SearchResult } from "./normalize.js";
import { cleanCitationMarkers } from "./output.js";

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

const MAX_COLLAPSED = 6;

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
      const label = theme.fg("toolTitle", theme.bold ? theme.bold(title) : title);
      const count =
        results.length > 0
          ? theme.fg("muted", `\u00b7 ${results.length} source${results.length === 1 ? "" : "s"}`)
          : "";
      const header = `${theme.fg("accent", icon)} ${label}${count ? " " + count : ""}`;

      const lines: string[] = [header];

      // Query line.
      if (query) {
        lines.push(`${theme.fg("muted", "Query:")} ${theme.fg("text", query)}`);
      }

      // Answer block (free-text output), capped when collapsed.
      const answer = cleanCitationMarkers(details.output?.trim() ?? "", results);
      if (answer) {
        lines.push(theme.fg("toolTitle", "Answer"));
        const answerLines = answer.split("\n").filter((l) => l.trim());
        const shown = expanded ? answerLines : answerLines.slice(0, 3);
        for (const l of shown) {
          lines.push(` ${theme.fg("text", l)}`);
        }
        if (!expanded && answerLines.length > shown.length) {
          const more = answerLines.length - shown.length;
          lines.push(` ${theme.fg("muted", `\u2026 ${more} more lines`)}`);
        }
      }

      // Sources list (numbered tree), capped when collapsed.
      if (results.length > 0) {
        lines.push(theme.fg("toolTitle", "Sources"));
        const shown = expanded ? results : results.slice(0, MAX_COLLAPSED);
        const branch = theme.tree?.branch ?? "\u251c";
        const last = theme.tree?.last ?? "\u2514";
        for (let i = 0; i < shown.length; i++) {
          const r = shown[i];
          const num = theme.fg("accent", `[${i + 1}]`);
          const titleText = r.title ? r.title : r.url ? r.url : "Untitled";
          const title = theme.fg("text", titleText);
          const domain = domainOf(r.url);
          const meta = domain.length > 0 ? ` ${theme.fg("dim", `(${domain})`)}` : "";
          const glyph = i === shown.length - 1 ? last : branch;
          lines.push(` ${theme.fg("dim", glyph)} ${num} ${title}${meta}`);
          const snippet = r.snippet?.trim();
          if (snippet) {
            lines.push(`   ${theme.fg("muted", truncate(snippet, 160))}`);
          }
        }
        if (!expanded && results.length > shown.length) {
          const remaining = results.length - shown.length;
          lines.push(
            ` ${theme.fg("dim", last)} ${theme.fg("muted", `\u2026 ${remaining} more result${remaining === 1 ? "" : "s"} (Ctrl+O to expand)`)}`
          );
        }
      } else if (!answer) {
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
