CREATE TABLE "computer_maintenance" (
	"id" serial PRIMARY KEY NOT NULL,
	"computer_id" integer NOT NULL,
	"maintenance_type" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"performed_by" integer NOT NULL,
	"scheduled_date" timestamp,
	"completed_date" timestamp,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"cost" integer,
	"parts" jsonb,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"data" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"user_id" integer NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"device_fingerprint" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "is_recurring" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "recurrence_pattern" varchar(20);--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "recurrence_end_date" timestamp;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "recurrence_exceptions" jsonb;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "conflict_resolution_priority" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "allow_room_change" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "allow_time_adjustment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "computers" ADD COLUMN "last_maintenance" timestamp;--> statement-breakpoint
ALTER TABLE "computers" ADD COLUMN "next_maintenance" timestamp;--> statement-breakpoint
ALTER TABLE "computers" ADD COLUMN "maintenance_notes" text;--> statement-breakpoint
ALTER TABLE "computer_maintenance" ADD CONSTRAINT "computer_maintenance_computer_id_computers_id_fk" FOREIGN KEY ("computer_id") REFERENCES "public"."computers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "computer_maintenance" ADD CONSTRAINT "computer_maintenance_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_session_id_unique" UNIQUE ("session_id");--> statement-breakpoint
ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;