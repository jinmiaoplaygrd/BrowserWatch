(function initNetworkPolicy(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.BrowserWatchNetworkPolicy = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createPolicy() {
  const JSDELIVR_RULE_ID = 1;

  function shouldBlockJsdelivr(settings) {
    return Boolean(settings.enabled && settings.blockJsdelivr);
  }

  function buildJsdelivrRule() {
    return {
      id: JSDELIVR_RULE_ID,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: "||cdn.jsdelivr.net^",
        resourceTypes: [
          "script",
          "stylesheet",
          "image",
          "font",
          "xmlhttprequest",
          "sub_frame",
          "other"
        ]
      }
    };
  }

  return { JSDELIVR_RULE_ID, buildJsdelivrRule, shouldBlockJsdelivr };
});
