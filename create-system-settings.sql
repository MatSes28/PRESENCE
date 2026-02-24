-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);

-- Insert default system settings
INSERT INTO "system_settings" ("key", "value", "description", "category", "is_active") VALUES
('smtpServer', '"smtp.gmail.com"', 'SMTP server for email notifications', 'email', true),
('smtpPort', '587', 'SMTP server port', 'email', true),
('smtpUser', '""', 'SMTP username', 'email', true),
('smtpPassword', '""', 'SMTP password', 'email', true),
('lateThreshold', '15', 'Late attendance threshold in minutes', 'attendance', true),
('rfidScannerPort', '"/dev/ttyUSB0"', 'RFID scanner serial port', 'hardware', true),
('enableEmailNotifications', 'true', 'Enable email notifications', 'notifications', true)
ON CONFLICT ("key") DO NOTHING;
