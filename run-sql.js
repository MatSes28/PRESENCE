#!/usr/bin/env node
const { Client } = require("pg");

// Railway PostgreSQL connection URL
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:nnkkpUhOCTGYdSeqDuelllbljwSlLELE@gondola.proxy.rlwy.net:33548/railway";

const client = new Client({
  connectionString: connectionString,
});

async function runSQL() {
  try {
    await client.connect();
    console.log("✅ Connected to PostgreSQL database\n");

    // Create system_settings table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "id" serial PRIMARY KEY NOT NULL,
        "key" varchar(100) NOT NULL,
        "value" jsonb NOT NULL,
        "description" text,
        "category" varchar(50) NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "system_settings_key_unique" UNIQUE("key")
      );
    `;

    console.log("Creating system_settings table...");
    await client.query(createTableSQL);
    console.log("✅ Table created successfully\n");

    // Insert default settings
    const insertSQL = `
      INSERT INTO "system_settings" ("key", "value", "description", "category", "is_active") VALUES
      ('smtpServer', '"smtp.gmail.com"', 'SMTP server for email notifications', 'email', true),
      ('smtpPort', '587', 'SMTP server port', 'email', true),
      ('smtpUser', '""', 'SMTP username', 'email', true),
      ('smtpPassword', '""', 'SMTP password', 'email', true),
      ('lateThreshold', '15', 'Late attendance threshold in minutes', 'attendance', true),
      ('rfidScannerPort', '"/dev/ttyUSB0"', 'RFID scanner serial port', 'hardware', true),
      ('enableEmailNotifications', 'true', 'Enable email notifications', 'notifications', true)
      ON CONFLICT ("key") DO NOTHING;
    `;

    console.log("Inserting default settings...");
    await client.query(insertSQL);
    console.log("✅ Default settings inserted\n");

    // Verify
    const verify = await client.query('SELECT * FROM "system_settings"');
    console.log("Current system_settings:");
    console.table(verify.rows);

    console.log("✅ All done!");
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.end();
  }
}

runSQL();
