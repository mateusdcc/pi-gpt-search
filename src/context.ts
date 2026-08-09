export type SearchContextMode = "none" | "recent";

export interface ConversationTurn {
  role: "user" | "assistant" | "system" | "tool" | string;
  content: string;
}

export function filterSearchContext(
  turns: ConversationTurn[],
  mode: SearchContextMode = "none",
  maxUserTurns = 2
): Array<{ role: string; content: string }> {
  if (mode === "none" || !Array.isArray(turns) || turns.length === 0) {
    return [];
  }

  // Filter out system prompts, developer instructions, tool execution messages, env vars, etc.
  const eligibleTurns = turns.filter((turn) => {
    if (!turn || typeof turn.content !== "string" || !turn.content.trim()) return false;

    const role = (turn.role || "").toLowerCase();
    // Exclude system and tool messages
    if (role === "system" || role === "tool" || role === "developer") return false;

    const text = turn.content;
    // Exclude sensitive patterns (keys, bearer tokens, env dumps)
    if (/bearer\s+[a-zA-Z0-9\._\-]+/i.test(text)) return false;
    if (/CODEX_ACCESS_TOKEN|OPENAI_API_KEY|GEMINI_API_KEY/i.test(text)) return false;

    return role === "user" || role === "assistant";
  });

  // Extract up to `maxUserTurns` last user turns and intervening assistant turns
  const filtered: Array<{ role: string; content: string }> = [];
  let userCount = 0;

  for (let i = eligibleTurns.length - 1; i >= 0; i--) {
    const turn = eligibleTurns[i];
    if (turn.role === "user") {
      userCount++;
      if (userCount > maxUserTurns) {
        break;
      }
    }

    // Truncate individual assistant messages to avoid token blowup (e.g. 500 chars)
    let content = turn.content.trim();
    if (turn.role === "assistant" && content.length > 500) {
      content = content.slice(0, 500) + "... [truncated]";
    }

    filtered.unshift({
      role: turn.role,
      content,
    });
  }

  return filtered;
}
