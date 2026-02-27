-- GDPR / privacy / DSAR tables + audit log archive tier

-- Consent records (explicit; versioned)
CREATE TABLE IF NOT EXISTS "gdpr_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"consent_type" varchar(64) NOT NULL,
	"consented" boolean NOT NULL,
	"consent_version" varchar(32) NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"justification" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp
);
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "gdpr_consents" ADD CONSTRAINT "gdpr_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_gdpr_consents_user_id" ON "gdpr_consents"("user_id");
CREATE INDEX IF NOT EXISTS "idx_gdpr_consents_type" ON "gdpr_consents"("consent_type");
CREATE INDEX IF NOT EXISTS "idx_gdpr_consents_created_at" ON "gdpr_consents"("created_at" DESC);
--> statement-breakpoint

-- Data Subject Requests (access/rectification/erasure/restriction/portability/objection)
CREATE TABLE IF NOT EXISTS "data_subject_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"request_type" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"requested_by" integer NOT NULL,
	"reason" text,
	"corrections" jsonb,
	"reviewed_by" integer,
	"review_notes" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_dsr_user_id" ON "data_subject_requests"("user_id");
CREATE INDEX IF NOT EXISTS "idx_dsr_status" ON "data_subject_requests"("status");
CREATE INDEX IF NOT EXISTS "idx_dsr_type" ON "data_subject_requests"("request_type");
CREATE INDEX IF NOT EXISTS "idx_dsr_created_at" ON "data_subject_requests"("created_at" DESC);
--> statement-breakpoint

-- Privacy audit log (GDPR Article 5(2) accountability)
CREATE TABLE IF NOT EXISTS "privacy_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"action" varchar(64) NOT NULL,
	"data_accessed" text NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"justification" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "privacy_audit_logs" ADD CONSTRAINT "privacy_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_privacy_audit_user_id" ON "privacy_audit_logs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_privacy_audit_action" ON "privacy_audit_logs"("action");
CREATE INDEX IF NOT EXISTS "idx_privacy_audit_created_at" ON "privacy_audit_logs"("created_at" DESC);
--> statement-breakpoint

-- Legal holds (block/limit erasure and certain exports while active)
CREATE TABLE IF NOT EXISTS "legal_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_user_id" integer NOT NULL,
	"scope" varchar(32) DEFAULT 'erasure' NOT NULL,
	"reason" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_legal_holds_subject" ON "legal_holds"("subject_user_id");
CREATE INDEX IF NOT EXISTS "idx_legal_holds_active" ON "legal_holds"("active");
--> statement-breakpoint

-- Audit log archive tier (for retention without losing chain)
CREATE TABLE IF NOT EXISTS "audit_logs_archive" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" integer,
	"action" varchar(100) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"resource_id" varchar(255),
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"session_id" varchar(255),
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"hash" varchar(128),
	"previous_hash" varchar(128),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "audit_logs_archive" ADD CONSTRAINT "audit_logs_archive_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_audit_logs_archive_timestamp" ON "audit_logs_archive"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_archive_user_id" ON "audit_logs_archive"("user_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_archive_action" ON "audit_logs_archive"("action");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_archive_resource" ON "audit_logs_archive"("resource");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_archive_resource_id" ON "audit_logs_archive"("resource_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_archive_success" ON "audit_logs_archive"("success");

