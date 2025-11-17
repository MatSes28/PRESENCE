ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS status varchar(20);
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;