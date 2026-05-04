-- Reporting tables missing from the checked-in migration history.
-- These back the reporting UI and scheduled report cleanup paths.

CREATE TABLE IF NOT EXISTS "report_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_type" varchar(50) NOT NULL,
	"generated_by" integer,
	"file_path" varchar(500),
	"parameters" jsonb,
	"record_count" integer,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"error_message" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "report_history" ADD CONSTRAINT "report_history_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "report_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"created_by" integer,
	"visibility" varchar(20) DEFAULT 'personal' NOT NULL,
	"parameters" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "report_presets" ADD CONSTRAINT "report_presets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "report_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"preset_id" varchar(80) NOT NULL,
	"preset_name" varchar(160) NOT NULL,
	"created_by" integer,
	"frequency" varchar(20) NOT NULL,
	"day_of_week" integer,
	"day_of_month" integer,
	"time_of_day" varchar(10) NOT NULL,
	"format" varchar(10) NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"next_run_at" timestamp NOT NULL,
	"last_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_report_history_generated_at" ON "report_history"("generated_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_report_history_generated_by" ON "report_history"("generated_by");
CREATE INDEX IF NOT EXISTS "idx_report_presets_created_by" ON "report_presets"("created_by");
CREATE INDEX IF NOT EXISTS "idx_report_presets_visibility" ON "report_presets"("visibility");
CREATE INDEX IF NOT EXISTS "idx_report_schedules_created_by" ON "report_schedules"("created_by");
CREATE INDEX IF NOT EXISTS "idx_report_schedules_next_run_at" ON "report_schedules"("next_run_at");
CREATE INDEX IF NOT EXISTS "idx_report_schedules_is_active" ON "report_schedules"("is_active");
