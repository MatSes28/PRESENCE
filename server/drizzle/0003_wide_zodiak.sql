ALTER TABLE "iot_devices" ADD COLUMN "api_key" varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "certificate_fingerprint" varchar(128);--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "certificate_data" text;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_api_key_unique" UNIQUE("api_key");