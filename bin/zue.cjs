#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { dirname, resolve } = require("node:path");

const packageRoot = resolve(dirname(__filename), "..");
const entry = resolve(packageRoot, "src/index.ts");

const result = spawnSync("bun", [entry], {
  cwd: packageRoot,
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error("[zue] Failed to start Bun. Make sure Bun is installed and available in PATH.");
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
