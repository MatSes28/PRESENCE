#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowedPlaceholders = new Set([
  "",
  "...",
  "YOUR_WIFI_SSID",
  "YOUR_WIFI_PASSWORD",
  "YOUR_DEVICE_API_KEY",
  "PASTE_DEVICE_API_KEY_FROM_WEB_APP",
]);

const trackedFiles = execFileSync("git", ["ls-files"], {
  encoding: "utf8",
})
  .split(/\r?\n/)
  .filter(Boolean)
  .filter(
    (file) =>
      !file.startsWith("server/coverage/") &&
      !file.startsWith("server/public/") &&
      !file.startsWith("server/shared/") &&
      !file.startsWith("node_modules/") &&
      !file.startsWith(".tools/"),
  );

const findings = [];

function addFinding(file, lineNumber, message) {
  findings.push(`${file}:${lineNumber}: ${message}`);
}

function inspectFirmwareConstant(file, line, lineNumber, name) {
  const match = line.match(
    new RegExp(`const\\s+char\\*\\s+${name}\\s*=\\s*"([^"]*)"\\s*;`),
  );
  if (!match) return;

  const value = match[1];
  if (!allowedPlaceholders.has(value)) {
    addFinding(file, lineNumber, `${name} must use a placeholder in git`);
  }
}

for (const file of trackedFiles) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (file.endsWith(".ino")) {
      inspectFirmwareConstant(file, line, lineNumber, "WIFI_SSID");
      inspectFirmwareConstant(file, line, lineNumber, "WIFI_PASSWORD");
      inspectFirmwareConstant(file, line, lineNumber, "DEVICE_API_KEY");
    }

    if (/pk_[a-f0-9]{32,}/i.test(line)) {
      addFinding(file, lineNumber, "real-looking IoT API key pattern found");
    }
  });
}

if (findings.length > 0) {
  console.error("Potential committed secrets found:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("Secret scan passed");
