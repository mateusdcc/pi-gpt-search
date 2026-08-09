import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import * as path from "node:path";
import { loadCodexAuth } from "../src/codex-provider";

interface RunPiResult {
  code: number;
  stdout: string;
  stderr: string;
  debugLogs: string[];
}

function runPiAgent(prompt: string, timeoutMs = 45000): Promise<RunPiResult> {
  return new Promise((resolve, reject) => {
    const extensionPath = path.join(process.cwd(), "src", "index.ts");
    const proc = spawn(
      "/opt/homebrew/bin/pi",
      ["-ne", "-e", extensionPath, "--no-context-files", "-p", prompt],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          PI_WEB_SEARCH_DEBUG: "1",
        },
      }
    );

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`runPiAgent timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      const debugLogs = stderr
        .split("\n")
        .filter((line) => line.includes("[PI_WEB_SEARCH_DEBUG]"));
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
        debugLogs,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

test("E2E Test 1: Single-step Pi + Gemini search", async () => {
  const auth = loadCodexAuth();
  if (!auth) {
    console.log("SKIPPED E2E Test 1: Codex auth not available");
    return;
  }

  const res = await runPiAgent("Use the web tool to search for OpenAI Codex GitHub repository.");
  assert.equal(res.code, 0, "Expected exit code 0");
  assert.ok(res.debugLogs.length >= 1, "Expected at least 1 debug log entry for web action");
  assert.ok(
    res.debugLogs.some((l) => l.includes("cmd=") && l.includes("search_query")),
    "Expected search_query command in debug log"
  );
  assert.ok(res.stdout.toLowerCase().includes("github.com/openai/codex"), "Expected response to mention repo URL");
});

test("E2E Test 2: Multi-step Pi + Gemini search -> open research flow", async () => {
  const auth = loadCodexAuth();
  if (!auth) {
    console.log("SKIPPED E2E Test 2: Codex auth not available");
    return;
  }

  const prompt =
    "Use web research to determine the current OpenAI Codex GitHub repository. Do not answer from memory. Open the main result before answering.";
  const res = await runPiAgent(prompt);

  assert.equal(res.code, 0, "Expected exit code 0");

  const searchLogs = res.debugLogs.filter((l) => l.includes("search_query"));
  const openLogs = res.debugLogs.filter((l) => l.includes('"open"'));

  assert.ok(searchLogs.length >= 1, "Expected search_query call >= 1");
  assert.ok(openLogs.length >= 1, "Expected open call >= 1");

  // Verify zero extra GPT/Codex model inference calls
  const forbiddenRouteCalled = res.stderr.includes("chat/completions") || res.stderr.includes("responses");
  assert.equal(forbiddenRouteCalled, false, "CRITICAL: Additional GPT/Codex agent turns MUST be 0");

  assert.ok(res.stdout.length > 0, "Expected final Gemini response text");
});

test("E2E Test 3: Multi-step Pi + Gemini search -> open -> find research sequence", async () => {
  const auth = loadCodexAuth();
  if (!auth) {
    console.log("SKIPPED E2E Test 3: Codex auth not available");
    return;
  }

  const prompt =
    "Find the OpenAI Codex repository on GitHub using the web research tool. Search for it, open the main repo result, and use find to look for 'terminal' in the opened document.";
  const res = await runPiAgent(prompt);

  assert.equal(res.code, 0, "Expected exit code 0");
  assert.ok(res.debugLogs.length >= 2, "Expected multiple web tool actions");
  assert.ok(res.stdout.length > 0, "Expected Gemini response");
});

test("E2E Test 4: Fresh information search with primary source verification", async () => {
  const auth = loadCodexAuth();
  if (!auth) {
    console.log("SKIPPED E2E Test 4: Codex auth not available");
    return;
  }

  const prompt = "Find the latest release version of the Rust programming language using the web tool and cite the official URL.";
  const res = await runPiAgent(prompt);

  assert.equal(res.code, 0, "Expected exit code 0");
  assert.ok(res.debugLogs.length >= 1, "Expected web search to be used");
  assert.ok(res.stdout.toLowerCase().includes("rust") || res.stdout.includes("http"), "Expected response with release info and URL");
});

test("E2E Test 5: Failure path when tool error occurs", async () => {
  const auth = loadCodexAuth();
  if (!auth) {
    console.log("SKIPPED E2E Test 5: Codex auth not available");
    return;
  }

  const prompt = "Use the web tool with open command on non-existent ref_id 'invalid_ref_12345' and report what happens.";
  const res = await runPiAgent(prompt);

  assert.equal(res.code, 0, "Expected process to handle tool response gracefully");
  assert.ok(res.stdout.length > 0, "Expected model explanation of output or error");
});
