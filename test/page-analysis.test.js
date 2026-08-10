"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyPage } = require("../extension/page-analysis");

const article = {
  url: "https://example.com/article",
  title: "A useful article",
  text: Array(260).fill("word").join(" "),
  hasSemanticRoot: true,
  hasPasswordField: false,
  robotsContent: ""
};

test("classifies a semantic long-form page as eligible", () => {
  const result = classifyPage(article);
  assert.equal(result.eligible, true);
  assert.equal(result.wordCount, 260);
});

test("rejects sensitive and publisher-opted-out pages", () => {
  assert.equal(
    classifyPage({ ...article, url: "https://example.com/login" }).eligible,
    false
  );
  assert.equal(
    classifyPage({ ...article, robotsContent: "noindex, noarchive" }).eligible,
    false
  );
});

test("rejects short or non-semantic pages", () => {
  assert.equal(
    classifyPage({ ...article, text: "too short" }).eligible,
    false
  );
  assert.equal(
    classifyPage({ ...article, hasSemanticRoot: false }).eligible,
    false
  );
});
