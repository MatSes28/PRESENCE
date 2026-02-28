-- Ensure at most one attendance record per (student, class session).
-- Run after resolving any existing duplicate (student_id, class_session_id) pairs if present.
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_records_student_session_unique"
  ON "attendance_records" ("student_id", "class_session_id");
