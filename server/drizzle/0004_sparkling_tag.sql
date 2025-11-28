CREATE TABLE "iot_device_heartbeats" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" varchar(100) NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) NOT NULL,
	"battery_level" integer,
	"signal_strength" integer,
	"temperature" integer,
	"uptime" integer,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true NOT NULL
);
