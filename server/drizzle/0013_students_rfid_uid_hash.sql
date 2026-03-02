-- Add deterministic RFID UID lookup token (HMAC) to avoid plaintext UID lookups.

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "rfid_uid_hash" varchar(64);
--> statement-breakpoint

-- Enforce uniqueness (NULL allowed)
CREATE UNIQUE INDEX IF NOT EXISTS "students_rfid_uid_hash_unique" ON "students" ("rfid_uid_hash");

