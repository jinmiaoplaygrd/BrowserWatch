"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildJsdelivrRule,
  shouldBlockJsdelivr
} = require("../extension/network-policy");

test("enables jsDelivr blocking only while monitoring and opted in", () => {
  assert.equal(
    shouldBlockJsdelivr({ enabled: true, blockJsdelivr: true }),
    true
  );
  assert.equal(
    shouldBlockJsdelivr({ enabled: false, blockJsdelivr: true }),
    false
  );
  assert.equal(
    shouldBlockJsdelivr({ enabled: true, blockJsdelivr: false }),
    false
  );
});

test("blocks jsDelivr subresources without blocking top-level navigation", () => {
  const rule = buildJsdelivrRule();
  assert.equal(rule.action.type, "block");
  assert.equal(rule.condition.urlFilter, "||cdn.jsdelivr.net^");
  assert.ok(rule.condition.resourceTypes.includes("script"));
  assert.equal(rule.condition.resourceTypes.includes("main_frame"), false);
});
