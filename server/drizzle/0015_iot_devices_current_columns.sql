-- Bring older Railway iot_devices tables up to the current application schema.
-- Registration returns these columns, so missing columns can break POST /api/iot/devices.

ALTER TABLE "iot_devices" ADD COLUMN IF NOT EXISTS "name" varchar(255);
--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN IF NOT EXISTS "location" varchar(255);
--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN IF NOT EXISTS "sensor_type" varchar(50);
--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN IF NOT EXISTS "mqtt_topic" varchar(255);
--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN IF NOT EXISTS "mac_address" varchar(17);
--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN IF NOT EXISTS "firmware_version" varchar(50);
--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN IF NOT EXISTS "battery_level" integer;
--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN IF NOT EXISTS "signal_strength" integer;
--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
--> statement-breakpoint
UPDATE "iot_devices" SET "is_active" = true WHERE "is_active" IS NULL;
--> statement-breakpoint
ALTER TABLE "iot_devices" ALTER COLUMN "is_active" SET DEFAULT true;
--> statement-breakpoint
ALTER TABLE "iot_devices" ALTER COLUMN "is_active" SET NOT NULL;

