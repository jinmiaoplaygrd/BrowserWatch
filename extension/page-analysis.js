(function initPageAnalysis(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.BrowserWatchPageAnalysis = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createPageAnalysis() {
  const SENSITIVE_PATH =
    /(?:^|\/)(?:login|signin|sign-in|auth|checkout|payment|billing|bank|medical|health|patient|mail|inbox)(?:\/|$)/i;

  function normalizeWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function classifyPage(candidate) {
    let parsed;
    try {
      parsed = new URL(candidate.url);
    } catch {
      return { eligible: false, reason: "invalid URL" };
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { eligible: false, reason: "unsupported URL scheme" };
    }
    if (candidate.hasPasswordField || SENSITIVE_PATH.test(parsed.pathname)) {
      return { eligible: false, reason: "sensitive page" };
    }
    if (/\b(?:noindex|noarchive)\b/i.test(candidate.robotsContent || "")) {
      return { eligible: false, reason: "publisher opted out" };
    }

    const title = normalizeWhitespace(candidate.title);
    const text = normalizeWhitespace(candidate.text);
    const wordCount = text ? text.split(/\s+/).length : 0;
    if (title.length < 3) {
      return { eligible: false, reason: "missing title" };
    }
    if (!candidate.hasSemanticRoot) {
      return { eligible: false, reason: "not an article or document" };
    }
    if (wordCount < 250) {
      return { eligible: false, reason: "not enough readable text" };
    }

    return { eligible: true, title, text, wordCount };
  }

  function extractCandidate(doc, locationHref) {
    const semanticRoot =
      doc.querySelector("article, main, [role='main'], [itemprop='articleBody']") ||
      doc.body;
    const robots = Array.from(
      doc.querySelectorAll("meta[name='robots'], meta[name='googlebot']")
    )
      .map((node) => node.content || "")
      .join(",");

    return {
      url: locationHref,
      title:
        doc.querySelector("meta[property='og:title']")?.content ||
        doc.querySelector("h1")?.textContent ||
        doc.title,
      text: semanticRoot?.innerText || "",
      hasSemanticRoot: semanticRoot !== doc.body,
      hasPasswordField: Boolean(doc.querySelector("input[type='password']")),
      robotsContent: robots
    };
  }

  return { classifyPage, extractCandidate, normalizeWhitespace };
});
