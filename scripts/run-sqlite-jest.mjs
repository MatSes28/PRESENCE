#!/usr/bin/env node
import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const [pattern, ...jestArgs] = process.argv.slice(2);

if (!pattern) {
  console.error(
    "Usage: node scripts/run-sqlite-jest.mjs <testPathPattern> [jest args...]",
  );
  process.exit(1);
}

const serverDir = join(process.cwd());
const testDbPath = join(serverDir, "presence.test.db");

if (existsSync(testDbPath)) {
  rmSync(testDbPath, { force: true });
}

const env = {
  ...process.env,
  USE_SQLITE: "true",
  SQLITE_PATH: "./presence.test.db",
};

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: serverDir,
    env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, ["../apply-sqlite-migrations.js"]);
run(process.execPath, [
  "--experimental-vm-modules",
  "../node_modules/jest/bin/jest.js",
  `--testPathPattern=${pattern}`,
  ...jestArgs,
]);
