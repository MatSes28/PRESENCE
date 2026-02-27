-- Enterprise integrations (SIS/LMS/HR/SSO tooling)

CREATE TABLE IF NOT EXISTS "integrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"kind" varchar(50) DEFAULT 'custom' NOT NULL,
	"provider" varchar(100) DEFAULT 'custom' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_integrations_enabled" ON "integrations"("enabled");
CREATE INDEX IF NOT EXISTS "idx_integrations_kind" ON "integrations"("kind");
CREATE INDEX IF NOT EXISTS "idx_integrations_provider" ON "integrations"("provider");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "integration_sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"integration_id" integer NOT NULL,
	"job_type" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"idempotency_key" varchar(128),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "integration_sync_runs" ADD CONSTRAINT "integration_sync_runs_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_integration_sync_runs_integration_id" ON "integration_sync_runs"("integration_id");
CREATE INDEX IF NOT EXISTS "idx_integration_sync_runs_status" ON "integration_sync_runs"("status");
CREATE INDEX IF NOT EXISTS "idx_integration_sync_runs_started_at" ON "integration_sync_runs"("started_at" DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "integration_sync_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"external_id" varchar(255),
	"local_id" varchar(255),
	"status" varchar(20) DEFAULT 'ok' NOT NULL,
	"message" text,
	"diff" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "integration_sync_events" ADD CONSTRAINT "integration_sync_events_run_id_integration_sync_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "integration_sync_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_integration_sync_events_run_id" ON "integration_sync_events"("run_id");
CREATE INDEX IF NOT EXISTS "idx_integration_sync_events_entity_type" ON "integration_sync_events"("entity_type");
CREATE INDEX IF NOT EXISTS "idx_integration_sync_events_status" ON "integration_sync_events"("status");
CREATE INDEX IF NOT EXISTS "idx_integration_sync_events_created_at" ON "integration_sync_events"("created_at" DESC);

