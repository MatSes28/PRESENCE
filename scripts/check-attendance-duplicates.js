#!/usr/bin/env node
/**
 * Check for duplicate (student_id, class_session_id) in attendance_records
 * and apply migration 0012 (unique constraint). For Postgres only.
 * SQLite: unique index is applied by apply-sqlite-migrations.js.
 * Usage: DATABASE_URL=postgresql://... node scripts/check-attendance-duplicates.js
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.startsWith("postgres")) {
    console.log("DATABASE_URL not set or not Postgres. Skipping (SQLite uses apply-sqlite-migrations.js for unique index).");
    return;
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  try {
    const dup = await client.query(`
      SELECT student_id, class_session_id, COUNT(*) AS cnt
      FROM attendance_records
      GROUP BY student_id, class_session_id
      HAVING COUNT(*) > 1
    `);
    if (dup.rows.length > 0) {
      console.error("Found duplicate (student_id, class_session_id). Resolve before applying migration 0012:");
      console.error(dup.rows);
      process.exit(1);
    }
    console.log("No duplicate attendance pairs found. Applying migration 0012...");
    const migrationPath = join(root, "server", "drizzle", "0012_attendance_records_unique_student_session.sql");
    if (existsSync(migrationPath)) {
      const sql = readFileSync(migrationPath, "utf-8").replace(/--> statement-breakpoint\n?/g, "").trim();
      await client.query(sql);
      console.log("Applied 0012_attendance_records_unique_student_session.sql");
    } else {
      console.warn("Migration file not found:", migrationPath);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
