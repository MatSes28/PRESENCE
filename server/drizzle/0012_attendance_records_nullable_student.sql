-- Allow discrepancy records without a resolved student (sensor-only / unknown UID)
-- Production hardening: avoid FK violations caused by `student_id = 0` sentinel values.

ALTER TABLE "attendance_records" ALTER COLUMN "student_id" DROP NOT NULL;
--> statement-breakpoint

-- Safety cleanup in case older deployments inserted sentinel values before FK enforcement.
UPDATE "attendance_records" SET "student_id" = NULL WHERE "student_id" = 0;

