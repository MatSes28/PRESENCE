#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const clientDist = join(rootDir, "client", "dist");
const serverPublic = join(rootDir, "server", "public");

if (!existsSync(clientDist)) {
  console.error(
    "client/dist does not exist. Run `npm run build --workspace=client` first.",
  );
  process.exit(1);
}

rmSync(serverPublic, { recursive: true, force: true });
mkdirSync(serverPublic, { recursive: true });
cpSync(clientDist, serverPublic, { recursive: true });

console.log("Copied client/dist to server/public");
