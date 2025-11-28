CREATE TABLE "error_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"level" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"category" varchar(50) NOT NULL,
	"endpoint" varchar(255),
	"user_id" integer,
	"session_id" varchar(255),
	"request_id" varchar(255),
	"user_agent" text,
	"ip_address" varchar(45),
	"method" varchar(10),
	"url" text,
	"status_code" integer,
	"response_time" integer,
	"metadata" jsonb,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" integer,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_recovery_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"error_log_id" integer NOT NULL,
	"attempt_number" integer NOT NULL,
	"strategy" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"result" jsonb,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_recovery_attempts" ADD CONSTRAINT "error_recovery_attempts_error_log_id_error_logs_id_fk" FOREIGN KEY ("error_log_id") REFERENCES "public"."error_logs"("id") ON DELETE no action ON UPDATE no action;