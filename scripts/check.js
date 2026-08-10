"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const files = [
  "extension/page-analysis.js",
  "extension/network-policy.js",
  "extension/content.js",
  "extension/background.js",
  "extension/popup.js",
  "companion/acp.js",
  "companion/lib.js",
  "companion/server.js"
];

JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  new vm.Script(source, { filename: file });
}
console.log(`Checked manifest and ${files.length} JavaScript files.`);
