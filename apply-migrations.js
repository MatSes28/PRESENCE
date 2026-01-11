#!/usr/bin/env node

import { readFileSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";

// Initialize SQLite database
const dbPath = "./server/presence.db";
const db = new Database(dbPath);

console.log("📦 Applying database migrations...");

try {
  // Read all migration files
  const migrationFiles = [
    "0000_ambitious_junta.sql",
    "0001_clever_nuke.sql",
    "0002_tiresome_timeslip.sql",
    "0003_wide_zodiak.sql",
    "0004_sparkling_tag.sql",
    "0005_deep_wendell_rand.sql",
    "0006_melted_talisman.sql",
    "0007_add_audit_logs.sql",
  ];

  // Enable WAL mode for better performance
  db.pragma("journal_mode = WAL");
  console.log("✅ WAL mode enabled");

  // Enable foreign keys
  db.pragma("foreign_keys = ON");
  console.log("✅ Foreign keys enabled");

  // Apply each migration
  for (const migrationFile of migrationFiles) {
    const filePath = join("./server/drizzle", migrationFile);
    const sqlContent = readFileSync(filePath, "utf-8");

    // Remove statement breakpoints and split into individual statements
    const statements = sqlContent
      .replace(/--> statement-breakpoint/g, "")
      .split(";")
      .filter((stmt) => stmt.trim())
      .map((stmt) => stmt + ";"); // Add back semicolons

    console.log(`📄 Applying migration: ${migrationFile}`);

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          db.exec(statement);
        } catch (error) {
          // Ignore "table already exists" errors
          if (!error.message.includes("already exists")) {
            console.warn(
              `⚠️  Warning in statement: ${statement.substring(0, 50)}...`
            );
            console.warn(`   Error: ${error.message}`);
          }
        }
      }
    }
  }

  console.log("✅ Database migrations applied successfully!");

  // Verify tables were created
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all();
  console.log("📊 Created tables:", tables.map((t) => t.name).join(", "));
} catch (error) {
  console.error("❌ Failed to apply migrations:", error);
  process.exit(1);
} finally {
  db.close();
}
