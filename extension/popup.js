const enabled = document.querySelector("#enabled");
const serverUrl = document.querySelector("#serverUrl");
const token = document.querySelector("#token");
const blockJsdelivr = document.querySelector("#blockJsdelivr");
const save = document.querySelector("#save");
const status = document.querySelector("#status");

void load();

enabled.addEventListener("change", async () => {
  await chrome.storage.local.set({ enabled: enabled.checked });
  await setStatus(
    "idle",
    enabled.checked ? "Monitoring is enabled." : "Monitoring is disabled."
  );
});

save.addEventListener("click", async () => {
  try {
    validateServerUrl(serverUrl.value);
    if (token.value.length < 16) {
      throw new Error("The companion token must be at least 16 characters.");
    }
    await chrome.storage.local.set({
      serverUrl: serverUrl.value.replace(/\/+$/, ""),
      token: token.value,
      blockJsdelivr: blockJsdelivr.checked
    });
    await setStatus("success", "Settings saved.");
  } catch (error) {
    renderStatus({ state: "error", message: error.message });
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.status) {
    renderStatus(changes.status.newValue);
  }
});

async function load() {
  const settings = await chrome.storage.local.get([
    "enabled",
    "serverUrl",
    "token",
    "blockJsdelivr",
    "status"
  ]);
  enabled.checked = settings.enabled ?? false;
  serverUrl.value = settings.serverUrl || "http://127.0.0.1:43110";
  token.value = settings.token || "";
  blockJsdelivr.checked = settings.blockJsdelivr ?? true;
  renderStatus(
    settings.status || { state: "idle", message: "Monitoring is disabled." }
  );
}

function validateServerUrl(value) {
  const parsed = new URL(value);
  if (
    parsed.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(parsed.hostname)
  ) {
    throw new Error("Use a loopback companion URL.");
  }
}

async function setStatus(state, message) {
  const value = { state, message, at: new Date().toISOString() };
  await chrome.storage.local.set({ status: value });
  renderStatus(value);
}

function renderStatus(value) {
  status.dataset.state = value?.state || "idle";
  status.textContent = value?.message || "";
}
