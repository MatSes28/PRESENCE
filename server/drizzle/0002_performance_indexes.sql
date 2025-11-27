-- Performance optimization: Add database indexes for frequently queried columns

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_faculty_id ON users(faculty_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
--> statement-breakpoint

-- Students table indexes
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_rfid_uid ON students(rfid_uid);
CREATE INDEX IF NOT EXISTS idx_students_parent_email ON students(parent_email);
CREATE INDEX IF NOT EXISTS idx_students_year_section ON students(year, section);
CREATE INDEX IF NOT EXISTS idx_students_program ON students(program);
CREATE INDEX IF NOT EXISTS idx_students_is_active ON students(is_active);
--> statement-breakpoint

-- Classrooms table indexes
CREATE INDEX IF NOT EXISTS idx_classrooms_name ON classrooms(name);
CREATE INDEX IF NOT EXISTS idx_classrooms_type ON classrooms(type);
CREATE INDEX IF NOT EXISTS idx_classrooms_is_active ON classrooms(is_active);
--> statement-breakpoint

-- Subjects table indexes
CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(code);
CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects(name);
CREATE INDEX IF NOT EXISTS idx_subjects_is_active ON subjects(is_active);
--> statement-breakpoint

-- Schedules table indexes (most critical for performance)
CREATE INDEX IF NOT EXISTS idx_schedules_subject_id ON schedules(subject_id);
CREATE INDEX IF NOT EXISTS idx_schedules_classroom_id ON schedules(classroom_id);
CREATE INDEX IF NOT EXISTS idx_schedules_faculty_id ON schedules(faculty_id);
CREATE INDEX IF NOT EXISTS idx_schedules_day_of_week ON schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_schedules_semester_academic_year ON schedules(semester, academic_year);
CREATE INDEX IF NOT EXISTS idx_schedules_start_time ON schedules(start_time);
CREATE INDEX IF NOT EXISTS idx_schedules_end_time ON schedules(end_time);
CREATE INDEX IF NOT EXISTS idx_schedules_is_active ON schedules(is_active);
-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_schedules_faculty_day ON schedules(faculty_id, day_of_week, is_active);
CREATE INDEX IF NOT EXISTS idx_schedules_classroom_day ON schedules(classroom_id, day_of_week, is_active);
CREATE INDEX IF NOT EXISTS idx_schedules_subject_semester ON schedules(subject_id, semester, academic_year);
--> statement-breakpoint

-- Class Sessions table indexes
CREATE INDEX IF NOT EXISTS idx_class_sessions_schedule_id ON class_sessions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_date ON class_sessions(date);
CREATE INDEX IF NOT EXISTS idx_class_sessions_status ON class_sessions(status);
CREATE INDEX IF NOT EXISTS idx_class_sessions_is_active ON class_sessions(is_active);
-- Composite indexes for attendance queries
CREATE INDEX IF NOT EXISTS idx_class_sessions_date_status ON class_sessions(date, status, is_active);
CREATE INDEX IF NOT EXISTS idx_class_sessions_schedule_date ON class_sessions(schedule_id, date);
--> statement-breakpoint

-- Attendance Records table indexes (most critical for performance)
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_class_session_id ON attendance_records(class_session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_created_at ON attendance_records(created_at);
CREATE INDEX IF NOT EXISTS idx_attendance_records_entry_time ON attendance_records(entry_time);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_attendance_records_is_valid ON attendance_records(is_valid);
CREATE INDEX IF NOT EXISTS idx_attendance_records_discrepancy_flag ON attendance_records(discrepancy_flag);
CREATE INDEX IF NOT EXISTS idx_attendance_records_is_active ON attendance_records(is_active);
-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_session ON attendance_records(student_id, class_session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_status ON attendance_records(class_session_id, status);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_date ON attendance_records(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attendance_records_valid_created ON attendance_records(is_valid, created_at);
--> statement-breakpoint

-- Computers table indexes
CREATE INDEX IF NOT EXISTS idx_computers_classroom_id ON computers(classroom_id);
CREATE INDEX IF NOT EXISTS idx_computers_name ON computers(name);
CREATE INDEX IF NOT EXISTS idx_computers_ip_address ON computers(ip_address);
CREATE INDEX IF NOT EXISTS idx_computers_mac_address ON computers(mac_address);
CREATE INDEX IF NOT EXISTS idx_computers_status ON computers(status);
CREATE INDEX IF NOT EXISTS idx_computers_next_maintenance ON computers(next_maintenance);
CREATE INDEX IF NOT EXISTS idx_computers_is_active ON computers(is_active);
--> statement-breakpoint

-- Computer Assignments table indexes
CREATE INDEX IF NOT EXISTS idx_computer_assignments_computer_id ON computer_assignments(computer_id);
CREATE INDEX IF NOT EXISTS idx_computer_assignments_student_id ON computer_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_computer_assignments_class_session_id ON computer_assignments(class_session_id);
CREATE INDEX IF NOT EXISTS idx_computer_assignments_status ON computer_assignments(status);
CREATE INDEX IF NOT EXISTS idx_computer_assignments_assigned_at ON computer_assignments(assigned_at);
CREATE INDEX IF NOT EXISTS idx_computer_assignments_login_time ON computer_assignments(login_time);
CREATE INDEX IF NOT EXISTS idx_computer_assignments_logout_time ON computer_assignments(logout_time);
CREATE INDEX IF NOT EXISTS idx_computer_assignments_is_active ON computer_assignments(is_active);
-- Composite indexes
CREATE INDEX IF NOT EXISTS idx_computer_assignments_session_student ON computer_assignments(class_session_id, student_id);
CREATE INDEX IF NOT EXISTS idx_computer_assignments_computer_status ON computer_assignments(computer_id, status);
--> statement-breakpoint

-- IoT Devices table indexes
CREATE INDEX IF NOT EXISTS idx_iot_devices_device_id ON iot_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_iot_devices_classroom_id ON iot_devices(classroom_id);
CREATE INDEX IF NOT EXISTS idx_iot_devices_device_type ON iot_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_iot_devices_status ON iot_devices(status);
CREATE INDEX IF NOT EXISTS idx_iot_devices_last_seen ON iot_devices(last_seen);
CREATE INDEX IF NOT EXISTS idx_iot_devices_is_active ON iot_devices(is_active);
--> statement-breakpoint

-- Enrollments table indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_subject_id ON enrollments(subject_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_semester_academic_year ON enrollments(semester, academic_year);
CREATE INDEX IF NOT EXISTS idx_enrollments_enrolled_at ON enrollments(enrolled_at);
CREATE INDEX IF NOT EXISTS idx_enrollments_is_active ON enrollments(is_active);
-- Composite indexes
CREATE INDEX IF NOT EXISTS idx_enrollments_student_subject ON enrollments(student_id, subject_id, semester, academic_year);
--> statement-breakpoint

-- Email Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_email_notifications_student_id ON email_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_class_session_id ON email_notifications(class_session_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_type ON email_notifications(type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_sent_at ON email_notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_notifications_recipient_email ON email_notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_notifications_is_active ON email_notifications(is_active);
--> statement-breakpoint

-- Push Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_push_notifications_user_id ON push_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_type ON push_notifications(type);
CREATE INDEX IF NOT EXISTS idx_push_notifications_read ON push_notifications(read);
CREATE INDEX IF NOT EXISTS idx_push_notifications_created_at ON push_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_push_notifications_is_active ON push_notifications(is_active);
--> statement-breakpoint

-- Push Subscriptions table indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_created_at ON push_subscriptions(created_at);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_is_active ON push_subscriptions(is_active);
--> statement-breakpoint

-- Computer Maintenance table indexes
CREATE INDEX IF NOT EXISTS idx_computer_maintenance_computer_id ON computer_maintenance(computer_id);
CREATE INDEX IF NOT EXISTS idx_computer_maintenance_performed_by ON computer_maintenance(performed_by);
CREATE INDEX IF NOT EXISTS idx_computer_maintenance_maintenance_type ON computer_maintenance(maintenance_type);
CREATE INDEX IF NOT EXISTS idx_computer_maintenance_status ON computer_maintenance(status);
CREATE INDEX IF NOT EXISTS idx_computer_maintenance_scheduled_date ON computer_maintenance(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_computer_maintenance_completed_date ON computer_maintenance(completed_date);
CREATE INDEX IF NOT EXISTS idx_computer_maintenance_is_active ON computer_maintenance(is_active);
--> statement-breakpoint

-- Subject Sessions table indexes
CREATE INDEX IF NOT EXISTS idx_subject_sessions_subject_id ON subject_sessions(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_sessions_classroom_id ON subject_sessions(classroom_id);
CREATE INDEX IF NOT EXISTS idx_subject_sessions_faculty_id ON subject_sessions(faculty_id);
CREATE INDEX IF NOT EXISTS idx_subject_sessions_session_date ON subject_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_subject_sessions_status ON subject_sessions(status);
CREATE INDEX IF NOT EXISTS idx_subject_sessions_is_active ON subject_sessions(is_active);
--> statement-breakpoint

-- Session Assignments table indexes
CREATE INDEX IF NOT EXISTS idx_session_assignments_session_id ON session_assignments(session_id);
CREATE INDEX IF NOT EXISTS idx_session_assignments_computer_id ON session_assignments(computer_id);
CREATE INDEX IF NOT EXISTS idx_session_assignments_student_id ON session_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_session_assignments_status ON session_assignments(status);
CREATE INDEX IF NOT EXISTS idx_session_assignments_assigned_at ON session_assignments(assigned_at);
CREATE INDEX IF NOT EXISTS idx_session_assignments_released_at ON session_assignments(released_at);
CREATE INDEX IF NOT EXISTS idx_session_assignments_is_active ON session_assignments(is_active);
--> statement-breakpoint

-- Partial indexes for active records (significant performance boost)
CREATE INDEX IF NOT EXISTS idx_users_active ON users(email, role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_students_active ON students(student_id, rfid_uid) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_schedules_active ON schedules(subject_id, classroom_id, faculty_id, day_of_week) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_class_sessions_active ON class_sessions(schedule_id, date, status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_attendance_records_active ON attendance_records(student_id, class_session_id, created_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_computers_active ON computers(classroom_id, status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_computer_assignments_active ON computer_assignments(computer_id, student_id, status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_iot_devices_active ON iot_devices(device_id, classroom_id, status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_enrollments_active ON enrollments(student_id, subject_id) WHERE is_active = true;
--> statement-breakpoint

-- Query optimization: Add covering indexes for common query patterns
-- Dashboard statistics queries
CREATE INDEX IF NOT EXISTS idx_dashboard_attendance ON attendance_records(class_session_id, student_id, status, is_valid, created_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_dashboard_sessions ON class_sessions(schedule_id, date, status) WHERE is_active = true;

-- Student attendance history
CREATE INDEX IF NOT EXISTS idx_student_history ON attendance_records(student_id, created_at, status, is_valid) WHERE is_active = true;

-- Faculty class overview
CREATE INDEX IF NOT EXISTS idx_faculty_classes ON schedules(faculty_id, day_of_week, start_time, end_time, is_active);

-- RFID lookup optimization
CREATE INDEX IF NOT EXISTS idx_rfid_lookup ON students(rfid_uid, is_active) WHERE rfid_uid IS NOT NULL;

-- Time-based queries optimization
CREATE INDEX IF NOT EXISTS idx_time_based_queries ON attendance_records(created_at, entry_time, class_session_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_session_time_range ON class_sessions(date, schedule_id) WHERE is_active = true;
--> statement-breakpoint