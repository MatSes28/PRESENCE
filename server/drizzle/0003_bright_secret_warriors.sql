CREATE TABLE "security_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"event_type" varchar(50) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "computers" ADD COLUMN "failed_login_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "computers" ADD COLUMN "locked_until" timestamp;--> statement-breakpoint
ALTER TABLE "computers" ADD COLUMN "last_failed_login" timestamp;--> statement-breakpoint
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_devices" DROP COLUMN "failed_login_attempts";--> statement-breakpoint
ALTER TABLE "iot_devices" DROP COLUMN "locked_until";--> statement-breakpoint
ALTER TABLE "iot_devices" DROP COLUMN "last_failed_login";