"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  MemoryStore,
  assertNoSensitiveQuery,
  createPublicLookup,
  isPrivateAddress,
  normalizeUrl,
  readLimitedBody,
  summarize
} = require("../companion/lib");

test("normalizes URLs and removes common tracking parameters", () => {
  assert.equal(
    normalizeUrl("HTTPS://Example.COM:443/a?utm_source=x&keep=y#part"),
    "https://example.com/a?keep=y"
  );
});

test("recognizes private IPv4 and IPv6 addresses", () => {
  assert.equal(isPrivateAddress("127.0.0.1"), true);
  assert.equal(isPrivateAddress("192.168.1.4"), true);
  assert.equal(isPrivateAddress("100.64.1.4"), true);
  assert.equal(isPrivateAddress("203.0.113.2"), true);
  assert.equal(isPrivateAddress("8.8.8.8"), false);
  assert.equal(isPrivateAddress("::1"), true);
  assert.equal(isPrivateAddress("::ffff:172.20.1.2"), true);
  assert.equal(isPrivateAddress("2001:db8::1"), true);
});

test("rejects URLs containing credentials or signed tokens", () => {
  assert.throws(
    () => assertNoSensitiveQuery("https://example.com/file.pdf?signature=secret"),
    /credentials or signed tokens/
  );
});

test("connection-time DNS lookup rejects private rebinding targets", async () => {
  const lookup = createPublicLookup((hostname, options, callback) => {
    callback(null, [{ address: "127.0.0.1", family: 4 }]);
  });
  await assert.rejects(
    new Promise((resolve, reject) => {
      lookup("example.com", {}, (error, address) =>
        error ? reject(error) : resolve(address)
      );
    }),
    /private network/
  );
});

test("parses a valid OpenAI-compatible summary", async () => {
  const summary = await summarize(
    { title: "Title", url: "https://example.com", text: "content" },
    {
      aiProvider: "openai",
      aiEndpoint: "https://ai.example.com/chat/completions",
      aiApiKey: "key",
      aiModel: "model"
    },
    {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "- Main point" } }]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    }
  );
  assert.equal(summary, "- Main point");
});

test("rejects malformed AI responses", async () => {
  await assert.rejects(
    summarize(
      { title: "Title", url: "https://example.com", text: "content" },
      {
        aiProvider: "openai",
        aiEndpoint: "https://ai.example.com/chat/completions",
        aiApiKey: "key",
        aiModel: "model"
      },
      {
        fetchImpl: async () =>
          new Response(JSON.stringify({ choices: [] }), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
      }
    ),
    /did not contain/
  );
});

test("dispatches summaries through Agency Copilot ACP", async () => {
  const summary = await summarize(
    { title: "Title", url: "https://example.com", text: "content" },
    { aiProvider: "agency-acp" },
    {
      acpSummarize: async (input) => `- ACP summary for ${input.title}`
    }
  );
  assert.equal(summary, "- ACP summary for Title");
});

test("stops reading a document when it crosses the size limit", async () => {
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(6));
        controller.enqueue(new Uint8Array(6));
        controller.close();
      }
    })
  );
  await assert.rejects(readLimitedBody(response, 10), /exceeds/);
});

test("deduplicates identical URL and content hash", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "browserwatch-"));
  const store = new MemoryStore(directory);
  await store.initialize();
  const entry = {
    capturedAt: "2026-01-01T00:00:00.000Z",
    title: "Title",
    url: "https://example.com/",
    summary: "- Summary",
    contentHash: "abc"
  };
  assert.deepEqual(await store.append(entry), { duplicate: false });
  assert.deepEqual(await store.append(entry), { duplicate: true });
  const lines = (await fs.readFile(store.jsonlPath, "utf8")).trim().split("\n");
  assert.equal(lines.length, 1);
});
