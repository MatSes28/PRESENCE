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
CREATE TABLE "subject_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" integer NOT NULL,
	"classroom_id" integer NOT NULL,
	"faculty_id" integer NOT NULL,
	"session_date" timestamp NOT NULL,
	"layout_config" jsonb,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"computer_id" integer NOT NULL,
	"student_id" integer,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"released_at" timestamp,
	"status" varchar(20) DEFAULT 'assigned' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "students" ALTER COLUMN "parent_email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "classrooms" ALTER COLUMN "location" SET DEFAULT 'CLIRDEC Building';--> statement-breakpoint
ALTER TABLE "classrooms" ALTER COLUMN "location" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "faculty_id" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "department" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "year" integer;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "section" varchar(50);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "program" varchar(100) DEFAULT 'BSIT' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "department" varchar(100) DEFAULT 'DIT' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "college" varchar(100) DEFAULT 'College of Engineering' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "parent_name" varchar(255);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "type" varchar(50) DEFAULT 'lecture' NOT NULL;--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "status" varchar(20);--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "computers" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "computer_assignments" ADD COLUMN "login_time" timestamp;--> statement-breakpoint
ALTER TABLE "computer_assignments" ADD COLUMN "logout_time" timestamp;--> statement-breakpoint
ALTER TABLE "computer_assignments" ADD COLUMN "session_duration" integer;--> statement-breakpoint
ALTER TABLE "computer_assignments" ADD COLUMN "status" varchar(20) DEFAULT 'assigned' NOT NULL;--> statement-breakpoint
ALTER TABLE "computer_assignments" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_notifications" ADD CONSTRAINT "email_notifications_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_notifications" ADD CONSTRAINT "email_notifications_class_session_id_class_sessions_id_fk" FOREIGN KEY ("class_session_id") REFERENCES "public"."class_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_sessions" ADD CONSTRAINT "subject_sessions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_sessions" ADD CONSTRAINT "subject_sessions_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_sessions" ADD CONSTRAINT "subject_sessions_faculty_id_users_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_assignments" ADD CONSTRAINT "session_assignments_session_id_subject_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."subject_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_assignments" ADD CONSTRAINT "session_assignments_computer_id_computers_id_fk" FOREIGN KEY ("computer_id") REFERENCES "public"."computers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_assignments" ADD CONSTRAINT "session_assignments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;