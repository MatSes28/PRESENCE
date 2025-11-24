-- Add sensor calibration columns to iot_devices table
ALTER TABLE "iot_devices" ADD COLUMN "sensor_calibration" jsonb;
ALTER TABLE "iot_devices" ADD COLUMN "calibration_status" varchar(20) DEFAULT 'uncalibrated' NOT NULL;
--> statement-breakpoint