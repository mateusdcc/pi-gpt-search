import { test } from "node:test";
import assert from "node:assert/strict";
import { CodexWebSearchProvider } from "../src/codex-provider";
import {
  CodexAuthExpiredError,
  CodexRateLimitError,
  CodexHttpError,
  WebSearchTimeoutError,
  WebSearchCancelledError,
} from "../src/errors";

test("provider-integration: success 200 OK with results", async () => {
  const customFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        results: [
          { title: "Test Result", url: "https://example.com", snippet: "Test snippet" },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const provider = new CodexWebSearchProvider({ customFetch });
  const res = await provider.search({ query: "test" });
  assert.equal(res.results.length, 1);
  assert.equal(res.results[0].title, "Test Result");
  assert.equal(res.results[0].url, "https://example.com");
});

test("provider-integration: 401 returns CodexAuthExpiredError", async () => {
  const customFetch: typeof fetch = async () => {
    return new Response("Unauthorized", { status: 401 });
  };

  const provider = new CodexWebSearchProvider({ customFetch });
  await assert.rejects(
    async () => {
      await provider.search({ query: "test" });
    },
    (err: unknown) => err instanceof CodexAuthExpiredError
  );
});

test("provider-integration: 403 returns CodexAuthExpiredError", async () => {
  const customFetch: typeof fetch = async () => {
    return new Response("Forbidden", { status: 403 });
  };

  const provider = new CodexWebSearchProvider({ customFetch });
  await assert.rejects(
    async () => {
      await provider.search({ query: "test" });
    },
    (err: unknown) => err instanceof CodexAuthExpiredError
  );
});

test("provider-integration: 429 returns CodexRateLimitError", async () => {
  const customFetch: typeof fetch = async () => {
    return new Response("Rate limited", { status: 429 });
  };

  const provider = new CodexWebSearchProvider({ customFetch });
  await assert.rejects(
    async () => {
      await provider.search({ query: "test" });
    },
    (err: unknown) => err instanceof CodexRateLimitError
  );
});

test("provider-integration: 500 returns CodexHttpError", async () => {
  const customFetch: typeof fetch = async () => {
    return new Response("Server error", { status: 500 });
  };

  const provider = new CodexWebSearchProvider({ customFetch });
  await assert.rejects(
    async () => {
      await provider.search({ query: "test" });
    },
    (err: unknown) => err instanceof CodexHttpError && err.statusCode === 500
  );
});

test("provider-integration: timeout throws WebSearchTimeoutError", async () => {
  const customFetch: typeof fetch = async (_url, options) => {
    const signal = options?.signal;
    return new Promise((_resolve, reject) => {
      if (signal) {
        signal.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      }
    });
  };

  const provider = new CodexWebSearchProvider({ customFetch, timeoutMs: 50 });
  await assert.rejects(
    async () => {
      await provider.search({ query: "test" });
    },
    (err: unknown) => err instanceof WebSearchTimeoutError
  );
});

test("provider-integration: manual cancellation throws WebSearchCancelledError", async () => {
  const customFetch: typeof fetch = async () => {
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  };

  const controller = new AbortController();
  controller.abort();

  const provider = new CodexWebSearchProvider({ customFetch });
  await assert.rejects(
    async () => {
      await provider.search({ query: "test" }, controller.signal);
    },
    (err: unknown) => err instanceof WebSearchCancelledError
  );
});
