-- Add RFID scans table for sensor validation
CREATE TABLE "rfid_scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" varchar(100) NOT NULL,
	"rfid_uid" varchar(50) NOT NULL,
	"timestamp" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint