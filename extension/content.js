(async function capturePage() {
  const { enabled = false } = await chrome.storage.local.get("enabled");
  if (!enabled) {
    return;
  }

  const candidate = BrowserWatchPageAnalysis.extractCandidate(document, location.href);
  const result = BrowserWatchPageAnalysis.classifyPage(candidate);
  if (!result.eligible) {
    return;
  }

  chrome.runtime.sendMessage({
    type: "capture-page",
    payload: {
      url: location.href,
      title: result.title,
      text: result.text.slice(0, 500000),
      kind: "html"
    }
  });
})();
