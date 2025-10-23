-- Add missing columns to existing tables
ALTER TABLE "users" ADD COLUMN "first_name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "last_name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "faculty_id" varchar(50);
ALTER TABLE "users" ADD COLUMN "department" varchar(255);
ALTER TABLE "users" ADD COLUMN "gender" varchar(20);
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "year" integer;
ALTER TABLE "students" ADD COLUMN "section" varchar(50);
ALTER TABLE "students" ADD COLUMN "program" varchar(100) DEFAULT 'BSIT' NOT NULL;
ALTER TABLE "students" ADD COLUMN "department" varchar(100) DEFAULT 'DIT' NOT NULL;
ALTER TABLE "students" ADD COLUMN "college" varchar(100) DEFAULT 'College of Engineering' NOT NULL;
ALTER TABLE "students" ADD COLUMN "parent_name" varchar(255);
ALTER TABLE "students" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "type" varchar(50) DEFAULT 'lecture' NOT NULL;
ALTER TABLE "classrooms" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "classrooms" ADD COLUMN "location" varchar(255) DEFAULT 'CLIRDEC Building' NOT NULL;
--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "class_sessions" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "status" varchar(20);
ALTER TABLE "attendance_records" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "computers" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "computer_assignments" ADD COLUMN "login_time" timestamp;
ALTER TABLE "computer_assignments" ADD COLUMN "logout_time" timestamp;
ALTER TABLE "computer_assignments" ADD COLUMN "session_duration" integer;
ALTER TABLE "computer_assignments" ADD COLUMN "status" varchar(20) DEFAULT 'assigned' NOT NULL;
ALTER TABLE "computer_assignments" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
-- Add new tables
CREATE TABLE "enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	"semester" varchar(50) NOT NULL,
	"academic_year" varchar(20) NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"class_session_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"message" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
-- Add foreign keys for new tables
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_notifications" ADD CONSTRAINT "email_notifications_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_notifications" ADD CONSTRAINT "email_notifications_class_session_id_class_sessions_id_fk" FOREIGN KEY ("class_session_id") REFERENCES "public"."class_sessions"("id") ON DELETE no action ON UPDATE no action;