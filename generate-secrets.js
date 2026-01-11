#!/usr/bin/env node

/**
 * Generate secure secrets for production environment
 * Usage: node generate-secrets.js
 */

import crypto from "crypto";

console.log("🔐 Generating secure secrets for production...\n");

// Generate JWT secrets (64 characters hex)
const jwtSecret = crypto.randomBytes(32).toString("hex");
const jwtRefreshSecret = crypto.randomBytes(32).toString("hex");

// Generate session secret (32+ characters)
const sessionSecret = crypto.randomBytes(32).toString("base64");

// Generate IoT API key (32+ characters)
const iotApiKey = crypto.randomBytes(32).toString("hex");

// Generate database password (16+ characters)
const dbPassword = crypto.randomBytes(16).toString("base64");

console.log("📋 Generated Secrets:");
console.log("===================");
console.log(`JWT_SECRET="${jwtSecret}"`);
console.log(`JWT_REFRESH_SECRET="${jwtRefreshSecret}"`);
console.log(`SESSION_SECRET="${sessionSecret}"`);
console.log(`IOT_API_KEY="${iotApiKey}"`);
console.log(`DB_PASSWORD="${dbPassword}"`);

console.log("\n💡 Copy these values to your .env.production file");
console.log("🔒 Keep these secrets secure - do not commit to version control!");
