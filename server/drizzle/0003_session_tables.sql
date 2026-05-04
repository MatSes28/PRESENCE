-- Migration: align user_sessions for connect-pg-simple
-- Runtime stores Express sessions in user_sessions, not a separate session table.

ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "sid" varchar;
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "sess" json;
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "expire" timestamp(6);
--> statement-breakpoint

ALTER TABLE "user_sessions" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_sessions" ALTER COLUMN "ip_address" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_sessions" ALTER COLUMN "expires_at" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_sessions" ALTER COLUMN "session_id" DROP NOT NULL;
--> statement-breakpoint

ALTER TABLE "user_sessions" DROP CONSTRAINT IF EXISTS "session_sid_key";
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "session_sid_key" UNIQUE ("sid");
--> statement-breakpoint

DROP INDEX IF EXISTS "user_sessions_expire_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_expire_idx" ON "user_sessions" ("expire");
