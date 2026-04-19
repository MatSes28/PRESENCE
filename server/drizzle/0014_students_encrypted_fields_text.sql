-- Encrypted student fields are JSON envelopes, not raw RFID/email/name values.
-- Their ciphertext can exceed the original VARCHAR limits in PostgreSQL.

ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_rfid_uid_unique";
--> statement-breakpoint
ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_rfid_uid_key";
--> statement-breakpoint
DROP INDEX IF EXISTS "students_rfid_uid_unique";
--> statement-breakpoint

ALTER TABLE "students" ALTER COLUMN "rfid_uid" TYPE text;
--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "parent_email" TYPE text;
--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "parent_name" TYPE text;
