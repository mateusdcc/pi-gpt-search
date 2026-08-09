import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CodexWebSearchProvider } from "./codex-provider";
import { createWebSearchTool } from "./tool";

export default function (pi: ExtensionAPI) {
  const provider = new CodexWebSearchProvider();
  const tool = createWebSearchTool(provider);
  pi.registerTool(tool);
}
