"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createApp } = require("../companion/server");

async function withServer(run) {
  const memoryDir = await fs.mkdtemp(path.join(os.tmpdir(), "browserwatch-"));
  const server = await createApp({
    config: {
      host: "127.0.0.1",
      port: 0,
      token: "test-token-123456",
      memoryDir,
      aiProvider: "openai",
      aiEndpoint: "https://ai.example.com/chat/completions",
      aiApiKey: "key",
      aiModel: "model",
      aiAuthHeader: "authorization",
      aiAuthScheme: "Bearer"
    },
    assertPublicUrl: async (value) => new URL(value),
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "- A concise summary" } }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`, memoryDir);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

test("health endpoint reports AI configuration", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      aiConfigured: true,
      aiProvider: "openai"
    });
  });
});

test("capture endpoint requires the shared token", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/capture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "Invalid companion token."
    });
  });
});

test("captures, writes, and deduplicates an article end to end", async () => {
  await withServer(async (baseUrl, memoryDir) => {
    const payload = {
      kind: "html",
      url: "https://example.com/article?utm_source=test",
      title: "Example article",
      text: Array(60).fill("readable content").join(" ")
    };
    const send = () =>
      fetch(`${baseUrl}/capture`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-browserwatch-token": "test-token-123456"
        },
        body: JSON.stringify(payload)
      });

    const first = await send();
    assert.equal(first.status, 201);
    assert.equal((await first.json()).duplicate, false);

    const second = await send();
    assert.equal(second.status, 200);
    assert.equal((await second.json()).duplicate, true);

    const jsonl = await fs.readFile(path.join(memoryDir, "memory.jsonl"), "utf8");
    const markdown = await fs.readFile(path.join(memoryDir, "memory.md"), "utf8");
    assert.equal(jsonl.trim().split("\n").length, 1);
    assert.match(jsonl, /https:\/\/example\.com\/article/);
    assert.match(markdown, /A concise summary/);
  });
});

test("captures an article through the Agency ACP provider", async () => {
  const memoryDir = await fs.mkdtemp(path.join(os.tmpdir(), "browserwatch-"));
  const server = await createApp({
    config: {
      host: "127.0.0.1",
      port: 0,
      token: "test-token-123456",
      memoryDir,
      aiProvider: "agency-acp",
      agencyTimeoutMs: 120000
    },
    assertPublicUrl: async (value) => new URL(value),
    acpSummarize: async () => "- Agency ACP summary"
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/capture`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-browserwatch-token": "test-token-123456"
      },
      body: JSON.stringify({
        kind: "html",
        url: "https://example.com/acp",
        title: "ACP article",
        text: Array(60).fill("readable content").join(" ")
      })
    });
    assert.equal(response.status, 201);
    assert.match(
      await fs.readFile(path.join(memoryDir, "memory.md"), "utf8"),
      /Agency ACP summary/
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});
