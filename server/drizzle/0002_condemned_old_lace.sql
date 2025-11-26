ALTER TABLE "iot_devices" ADD COLUMN "failed_login_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "locked_until" timestamp;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "last_failed_login" timestamp;