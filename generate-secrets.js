#!/usr/bin/env node

/**
 * CLIRDEC:PRESENCE - Secure Secret Generation Utility
 *
 * This script generates cryptographically secure random strings
 * for JWT secrets and other sensitive configuration values.
 *
 * Usage:
 *   node generate-secrets.js
 *   node generate-secrets.js --length 64
 *   node generate-secrets.js --count 3
 */

const crypto = require("crypto");

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString("hex");
}

function generateBase64Secret(length = 32) {
  return crypto.randomBytes(length).toString("base64");
}

function generateUrlSafeSecret(length = 32) {
  return crypto.randomBytes(length).toString("base64url");
}

// Parse command line arguments
const args = process.argv.slice(2);
const length =
  args.find((arg) => arg.startsWith("--length="))?.split("=")[1] || 32;
const count =
  args.find((arg) => arg.startsWith("--count="))?.split("=")[1] || 1;
const format =
  args.find((arg) => arg.startsWith("--format="))?.split("=")[1] || "hex";

console.log("🔐 CLIRDEC:PRESENCE - Secure Secret Generator");
console.log("=".repeat(50));
console.log(
  `Generating ${count} secret(s) with ${length} bytes (${length * 2} hex chars)`
);
console.log("");

for (let i = 0; i < count; i++) {
  let secret;
  switch (format) {
    case "base64":
      secret = generateBase64Secret(parseInt(length));
      break;
    case "base64url":
      secret = generateUrlSafeSecret(parseInt(length));
      break;
    case "hex":
    default:
      secret = generateSecret(parseInt(length));
      break;
  }

  console.log(`JWT_SECRET_${i + 1}=${secret}`);
  console.log(
    `JWT_REFRESH_SECRET_${i + 1}=${generateSecret(parseInt(length))}`
  );
  console.log("");
}

console.log("📋 Copy these values to your .env file");
console.log("⚠️  Never commit secrets to version control");
console.log("🔄 Regenerate secrets for production deployment");
