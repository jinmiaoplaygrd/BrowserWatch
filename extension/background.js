importScripts("network-policy.js");

const DEFAULT_SERVER_URL = "http://127.0.0.1:43110";
const DOCUMENT_URL = /\.(?:pdf|docx|txt)(?:$|[?#])/i;
let networkPolicyQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get([
    "enabled",
    "blockJsdelivr",
    "serverUrl",
    "token"
  ]);
  await chrome.storage.local.set({
    enabled: current.enabled ?? false,
    blockJsdelivr: current.blockJsdelivr ?? true,
    serverUrl: current.serverUrl || DEFAULT_SERVER_URL,
    token: current.token || "",
    status: {
      state: "idle",
      message: "Monitoring is disabled.",
      at: new Date().toISOString()
    }
  });
  await syncNetworkPolicy();
});

chrome.runtime.onStartup.addListener(() => {
  void syncNetworkPolicy();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (
    area === "local" &&
    (changes.enabled || changes.blockJsdelivr)
  ) {
    void syncNetworkPolicy();
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "capture-page" || sender.tab?.incognito) {
    return;
  }
  void submitCapture(message.payload);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status !== "complete" ||
    tab.incognito ||
    !tab.url ||
    !DOCUMENT_URL.test(tab.url)
  ) {
    return;
  }
  void submitCapture({
    url: tab.url,
    title: tab.title || documentName(tab.url),
    kind: "document"
  });
});

async function submitCapture(payload) {
  const settings = await chrome.storage.local.get([
    "enabled",
    "serverUrl",
    "token"
  ]);
  if (!settings.enabled) {
    return;
  }

  let endpoint;
  try {
    endpoint = captureEndpoint(settings.serverUrl);
    if (!settings.token) {
      throw new Error("Set the companion token in BrowserWatch.");
    }
  } catch (error) {
    await setStatus("error", error.message);
    return;
  }

  await setStatus("working", `Summarizing ${payload.title || payload.url}...`);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-browserwatch-token": settings.token
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Companion returned HTTP ${response.status}.`);
    }
    await setStatus(
      "success",
      body.duplicate
        ? `Already remembered: ${body.title}`
        : `Remembered: ${body.title}`
    );
  } catch (error) {
    await setStatus("error", `Capture failed: ${error.message}`);
  }
}

function captureEndpoint(value) {
  const url = new URL(value || DEFAULT_SERVER_URL);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname)
  ) {
    throw new Error("Companion URL must use http://127.0.0.1 or http://localhost.");
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/capture`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function documentName(value) {
  try {
    return decodeURIComponent(new URL(value).pathname.split("/").pop()) || "Document";
  } catch {
    return "Document";
  }
}

async function setStatus(state, message) {
  await chrome.storage.local.set({
    status: { state, message, at: new Date().toISOString() }
  });
}

function syncNetworkPolicy() {
  const operation = networkPolicyQueue.then(async () => {
    const settings = await chrome.storage.local.get([
      "enabled",
      "blockJsdelivr"
    ]);
    const addRules = BrowserWatchNetworkPolicy.shouldBlockJsdelivr(settings)
      ? [BrowserWatchNetworkPolicy.buildJsdelivrRule()]
      : [];
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [BrowserWatchNetworkPolicy.JSDELIVR_RULE_ID],
      addRules
    });
  });
  networkPolicyQueue = operation.catch(async (error) => {
    await setStatus("error", `Network policy failed: ${error.message}`);
  });
  return networkPolicyQueue;
}
