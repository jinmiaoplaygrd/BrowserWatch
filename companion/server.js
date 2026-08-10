"use strict";

const http = require("node:http");
const path = require("node:path");
const { MemoryStore, processCapture } = require("./lib");

const MAX_BODY_BYTES = 2 * 1024 * 1024;

function loadConfig(env = process.env) {
  const aiProvider = env.BROWSERWATCH_AI_PROVIDER || "openai";
  return {
    host: "127.0.0.1",
    port: Number(env.BROWSERWATCH_PORT || 43110),
    token: env.BROWSERWATCH_TOKEN || "",
    memoryDir:
      env.BROWSERWATCH_MEMORY_DIR ||
      path.join(process.cwd(), "browserwatch-memory"),
    aiProvider,
    aiEndpoint: env.BROWSERWATCH_AI_ENDPOINT || "",
    aiApiKey: env.BROWSERWATCH_AI_API_KEY || "",
    aiModel: env.BROWSERWATCH_AI_MODEL || "",
    aiAuthHeader: env.BROWSERWATCH_AI_AUTH_HEADER || "authorization",
    aiAuthScheme:
      env.BROWSERWATCH_AI_AUTH_SCHEME === undefined
        ? "Bearer"
        : env.BROWSERWATCH_AI_AUTH_SCHEME,
    acpCommand: env.BROWSERWATCH_ACP_COMMAND || "copilot",
    agencyModel: env.BROWSERWATCH_AGENCY_MODEL || "",
    agencyTimeoutMs: Number(env.BROWSERWATCH_AGENCY_TIMEOUT_MS || 120000),
    extraDisabledMcps: (env.BROWSERWATCH_DISABLED_MCPS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  };
}

async function createApp(options = {}) {
  const config = options.config || loadConfig();
  if (config.token.length < 16) {
    throw new Error("BROWSERWATCH_TOKEN must be at least 16 characters.");
  }
  assertAiConfiguration(config);
  const store = options.store || new MemoryStore(config.memoryDir);
  await store.initialize();
  const fetchImpl = options.fetchImpl || fetch;
  const assertPublicUrl = options.assertPublicUrl;
  const acpSummarize = options.acpSummarize;

  return http.createServer(async (request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "no-store");

    if (request.method === "GET" && request.url === "/health") {
      send(response, 200, {
        ok: true,
        aiConfigured: true,
        aiProvider: config.aiProvider
      });
      return;
    }
    if (request.method !== "POST" || request.url !== "/capture") {
      send(response, 404, { error: "Not found." });
      return;
    }
    if (request.headers["x-browserwatch-token"] !== config.token) {
      send(response, 401, { error: "Invalid companion token." });
      return;
    }

    try {
      const payload = await readJson(request);
      const result = await processCapture(payload, {
        config,
        store,
        fetchImpl,
        assertPublicUrl,
        acpSummarize
      });
      send(response, result.duplicate ? 200 : 201, result);
    } catch (error) {
      send(response, 400, { error: error.message });
    }
  });
}

function assertAiConfiguration(config) {
  if (config.aiProvider === "agency-acp") {
    if (
      !Number.isFinite(config.agencyTimeoutMs) ||
      config.agencyTimeoutMs < 1000
    ) {
      throw new Error("BROWSERWATCH_AGENCY_TIMEOUT_MS must be at least 1000.");
    }
    return;
  }
  if (config.aiProvider !== "openai") {
    throw new Error(
      "BROWSERWATCH_AI_PROVIDER must be 'openai' or 'agency-acp'."
    );
  }
  if (!config.aiEndpoint || !config.aiApiKey || !config.aiModel) {
    throw new Error(
      "OpenAI-compatible mode requires BROWSERWATCH_AI_ENDPOINT, BROWSERWATCH_AI_API_KEY, and BROWSERWATCH_AI_MODEL."
    );
  }
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on("data", (chunk) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        reject(new Error("Capture payload exceeds the 2 MB limit."));
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    request.on("error", reject);
  });
}

function send(response, status, body) {
  response.writeHead(status);
  response.end(JSON.stringify(body));
}

async function main() {
  const config = loadConfig();
  const server = await createApp({ config });
  server.listen(config.port, config.host, () => {
    console.log(
      `BrowserWatch companion listening on http://${config.host}:${config.port}`
    );
    console.log(`Memory directory: ${config.memoryDir}`);
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { assertAiConfiguration, createApp, loadConfig, readJson };
