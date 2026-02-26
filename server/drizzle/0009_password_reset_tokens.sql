-- Add password reset tokens table (hashed token + expiry + single-use)
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "requested_ip" varchar(45),
  "requested_user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_unique" ON "password_reset_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "idx_password_reset_tokens_user_id" ON "password_reset_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "idx_password_reset_tokens_expires_at" ON "password_reset_tokens"("expires_at");
CREATE INDEX IF NOT EXISTS "idx_password_reset_tokens_used_at" ON "password_reset_tokens"("used_at");

