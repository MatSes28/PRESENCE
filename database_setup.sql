-- CLIRDEC:PRESENCE Database Setup
-- PostgreSQL Database Schema for Attendance Monitoring System

-- Create database (run this separately if needed)
-- CREATE DATABASE clirdec_presence;

-- Use the database
-- \c clirdec_presence;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- USERS TABLE - Faculty and Admin accounts
-- ===========================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    faculty_id VARCHAR(50),
    department VARCHAR(255),
    gender VARCHAR(20),
    role VARCHAR(50) NOT NULL DEFAULT 'faculty' CHECK (role IN ('admin', 'faculty')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- STUDENTS TABLE - Student records
-- ===========================================
CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    year INTEGER,
    section VARCHAR(50),
    program VARCHAR(100) NOT NULL DEFAULT 'BSIT',
    department VARCHAR(100) NOT NULL DEFAULT 'DIT',
    college VARCHAR(100) NOT NULL DEFAULT 'College of Engineering',
    rfid_uid VARCHAR(50) UNIQUE,
    parent_email VARCHAR(255) NOT NULL,
    parent_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- CLASSROOMS TABLE - Lab rooms and facilities
-- ===========================================
CREATE TABLE classrooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL DEFAULT 'CLIRDEC Building',
    type VARCHAR(50) NOT NULL DEFAULT 'lecture',
    capacity INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- SUBJECTS TABLE - Course information
-- ===========================================
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- SCHEDULES TABLE - Recurring class schedules
-- ===========================================
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    faculty_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time VARCHAR(10) NOT NULL, -- HH:MM format
    end_time VARCHAR(10) NOT NULL,
    semester VARCHAR(50) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- CLASS SESSIONS TABLE - Auto-generated from schedules
-- ===========================================
CREATE TABLE class_sessions (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- ATTENDANCE RECORDS TABLE - Entry/exit logs with validation
-- ===========================================
CREATE TABLE attendance_records (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    entry_time TIMESTAMP WITH TIME ZONE,
    exit_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20),
    rfid_detected BOOLEAN NOT NULL DEFAULT FALSE,
    sensor_detected BOOLEAN NOT NULL DEFAULT FALSE,
    is_valid BOOLEAN NOT NULL DEFAULT FALSE,
    discrepancy_flag BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- COMPUTERS TABLE - Lab computer tracking
-- ===========================================
CREATE TABLE computers (
    id SERIAL PRIMARY KEY,
    classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    mac_address VARCHAR(17),
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- COMPUTER ASSIGNMENTS TABLE - Student-computer assignments
-- ===========================================
CREATE TABLE computer_assignments (
    id SERIAL PRIMARY KEY,
    computer_id INTEGER NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    login_time TIMESTAMP WITH TIME ZONE,
    logout_time TIMESTAMP WITH TIME ZONE,
    session_duration INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'active', 'completed')),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    released_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(computer_id, class_session_id) -- One computer per session
);

-- ===========================================
-- ENROLLMENTS TABLE - Student-subject enrollments
-- ===========================================
CREATE TABLE enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    semester VARCHAR(50) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- ===========================================
-- EMAIL NOTIFICATIONS TABLE - Notification history
-- ===========================================
CREATE TABLE email_notifications (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recipient_email VARCHAR(255) NOT NULL,
    message TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- ===========================================
-- IOT DEVICES TABLE - ESP32 device management
-- ===========================================
CREATE TABLE iot_devices (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL UNIQUE,
    classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    device_type VARCHAR(50) NOT NULL DEFAULT 'esp32_s3',
    status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
    last_seen TIMESTAMP WITH TIME ZONE,
    config JSONB,
    sensor_calibration JSONB,
    calibration_status VARCHAR(20) NOT NULL DEFAULT 'uncalibrated',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- INDEXES for better performance
-- ===========================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Students indexes
CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_students_rfid_uid ON students(rfid_uid);
CREATE INDEX idx_students_email ON students(email);

-- Schedules indexes
CREATE INDEX idx_schedules_subject_id ON schedules(subject_id);
CREATE INDEX idx_schedules_classroom_id ON schedules(classroom_id);
CREATE INDEX idx_schedules_faculty_id ON schedules(faculty_id);
CREATE INDEX idx_schedules_day_time ON schedules(day_of_week, start_time, end_time);

-- Class sessions indexes
CREATE INDEX idx_class_sessions_schedule_id ON class_sessions(schedule_id);
CREATE INDEX idx_class_sessions_date ON class_sessions(date);
CREATE INDEX idx_class_sessions_status ON class_sessions(status);

-- Attendance records indexes
CREATE INDEX idx_attendance_student_session ON attendance_records(student_id, class_session_id);
CREATE INDEX idx_attendance_session_time ON attendance_records(class_session_id, created_at);
CREATE INDEX idx_attendance_valid ON attendance_records(is_valid);
CREATE INDEX idx_attendance_discrepancy ON attendance_records(discrepancy_flag);

-- Computers indexes
CREATE INDEX idx_computers_classroom ON computers(classroom_id);
CREATE INDEX idx_computers_status ON computers(status);

-- Computer assignments indexes
CREATE INDEX idx_assignments_computer_session ON computer_assignments(computer_id, class_session_id);
CREATE INDEX idx_assignments_student_session ON computer_assignments(student_id, class_session_id);

-- RFID scans table for sensor validation
CREATE TABLE rfid_scans (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    rfid_uid VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add sensor calibration columns to iot_devices
ALTER TABLE iot_devices ADD COLUMN sensor_calibration JSONB;
ALTER TABLE iot_devices ADD COLUMN calibration_status VARCHAR(20) DEFAULT 'uncalibrated' NOT NULL;
ALTER TABLE iot_devices ADD COLUMN is_active BOOLEAN DEFAULT TRUE NOT NULL;

-- Enrollments indexes
CREATE INDEX idx_enrollments_student_subject ON enrollments(student_id, subject_id);
CREATE INDEX idx_enrollments_semester_year ON enrollments(semester, academic_year);

-- Email notifications indexes
CREATE INDEX idx_email_notifications_student ON email_notifications(student_id);
CREATE INDEX idx_email_notifications_session ON email_notifications(class_session_id);
CREATE INDEX idx_email_notifications_sent_at ON email_notifications(sent_at);

-- IoT devices indexes
CREATE INDEX idx_iot_devices_device_id ON iot_devices(device_id);
CREATE INDEX idx_iot_devices_classroom ON iot_devices(classroom_id);
CREATE INDEX idx_iot_devices_status ON iot_devices(status);
CREATE INDEX idx_rfid_scans_device_timestamp ON rfid_scans(device_id, timestamp);

-- ===========================================
-- TRIGGERS for updated_at timestamps
-- ===========================================

-- Users updated_at trigger
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- Students updated_at trigger
CREATE OR REPLACE FUNCTION update_students_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_students_updated_at();

-- Attendance records updated_at trigger
CREATE OR REPLACE FUNCTION update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_attendance_updated_at
    BEFORE UPDATE ON attendance_records
    FOR EACH ROW
    EXECUTE FUNCTION update_attendance_updated_at();

-- Computers updated_at trigger
CREATE OR REPLACE FUNCTION update_computers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_computers_updated_at
    BEFORE UPDATE ON computers
    FOR EACH ROW
    EXECUTE FUNCTION update_computers_updated_at();

-- IoT devices updated_at trigger
CREATE OR REPLACE FUNCTION update_iot_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_iot_devices_updated_at
    BEFORE UPDATE ON iot_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_iot_devices_updated_at();

-- ===========================================
-- SAMPLE DATA (Optional - for testing)
-- ===========================================

-- Insert sample admin user (password should be hashed in production)
-- Password: admin123 (hashed)
INSERT INTO users (email, password, first_name, last_name, role) VALUES
('admin@clsu.edu.ph', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeCt1uB0Y/CjVzQy', 'System', 'Administrator', 'admin');

-- Insert sample faculty
INSERT INTO users (email, password, first_name, last_name, role) VALUES
('faculty@clsu.edu.ph', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeCt1uB0Y/CjVzQy', 'Maria', 'Santos', 'faculty');

-- Insert sample classrooms
INSERT INTO classrooms (name, location, capacity) VALUES
('Computer Lab 1', 'Building A, Room 101', 30),
('Computer Lab 2', 'Building A, Room 102', 25),
('Programming Lab', 'Building B, Room 201', 20);

-- Insert sample subjects
INSERT INTO subjects (code, name, description) VALUES
('CS101', 'Introduction to Computer Science', 'Basic programming concepts'),
('CS201', 'Data Structures and Algorithms', 'Advanced programming concepts'),
('IT301', 'Database Systems', 'Relational database design and SQL');

-- Insert sample students
INSERT INTO students (student_id, name, email, rfid_uid, parent_email) VALUES
('2021001', 'Juan Dela Cruz', 'juan.delacruz@clsu.edu.ph', 'ABC123456789', 'parent1@email.com'),
('2021002', 'Maria Garcia', 'maria.garcia@clsu.edu.ph', 'DEF987654321', 'parent2@email.com'),
('2021003', 'Pedro Reyes', 'pedro.reyes@clsu.edu.ph', 'GHI456789123', 'parent3@email.com');

-- Insert sample computers
INSERT INTO computers (classroom_id, name, ip_address, mac_address) VALUES
(1, 'PC-001', '192.168.1.101', '00:11:22:33:44:55'),
(1, 'PC-002', '192.168.1.102', '00:11:22:33:44:56'),
(1, 'PC-003', '192.168.1.103', '00:11:22:33:44:57'),
(2, 'PC-201', '192.168.1.201', '00:11:22:33:44:58'),
(2, 'PC-202', '192.168.1.202', '00:11:22:33:44:59');

-- Insert sample IoT devices
INSERT INTO iot_devices (device_id, classroom_id, device_type, status) VALUES
('ESP32_S3_001', 1, 'esp32_s3', 'offline'),
('ESP32_S3_002', 2, 'esp32_s3', 'offline'),
('ESP32_S3_003', 3, 'esp32_s3', 'offline');

-- ===========================================
-- USEFUL QUERIES
-- ===========================================

-- Get attendance summary for a class session
-- SELECT
--     cs.id as session_id,
--     cs.date,
--     s.name as subject_name,
--     c.name as classroom_name,
--     COUNT(ar.id) as total_records,
--     COUNT(CASE WHEN ar.is_valid THEN 1 END) as valid_attendance,
--     COUNT(CASE WHEN ar.discrepancy_flag THEN 1 END) as discrepancies
-- FROM class_sessions cs
-- JOIN schedules sch ON cs.schedule_id = sch.id
-- JOIN subjects s ON sch.subject_id = s.id
-- JOIN classrooms c ON sch.classroom_id = c.id
-- LEFT JOIN attendance_records ar ON cs.id = ar.class_session_id
-- WHERE cs.id = :session_id
-- GROUP BY cs.id, cs.date, s.name, c.name;

-- Get student attendance history
-- SELECT
--     st.name as student_name,
--     st.student_id,
--     cs.date,
--     s.name as subject_name,
--     ar.entry_time,
--     ar.exit_time,
--     ar.is_valid,
--     ar.discrepancy_flag
-- FROM attendance_records ar
-- JOIN students st ON ar.student_id = st.id
-- JOIN class_sessions cs ON ar.class_session_id = cs.id
-- JOIN schedules sch ON cs.schedule_id = sch.id
-- JOIN subjects s ON sch.subject_id = s.id
-- WHERE st.id = :student_id
-- ORDER BY cs.date DESC;

-- Get computer usage statistics
-- SELECT
--     comp.name as computer_name,
--     COUNT(ca.id) as total_assignments,
--     AVG(EXTRACT(EPOCH FROM (ca.released_at - ca.assigned_at))/3600) as avg_usage_hours
-- FROM computers comp
-- LEFT JOIN computer_assignments ca ON comp.id = ca.computer_id
-- WHERE comp.classroom_id = :classroom_id
-- GROUP BY comp.id, comp.name
-- ORDER BY total_assignments DESC;

-- ===========================================
-- PERMISSIONS (Optional - for production)
-- ===========================================

-- Create a read-only user for reporting
-- CREATE USER clirdec_readonly WITH PASSWORD 'readonly_password';
-- GRANT CONNECT ON DATABASE clirdec_presence TO clirdec_readonly;
-- GRANT USAGE ON SCHEMA public TO clirdec_readonly;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO clirdec_readonly;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO clirdec_readonly;

-- Create application user with full access
-- CREATE USER clirdec_app WITH PASSWORD 'app_password';
-- GRANT ALL PRIVILEGES ON DATABASE clirdec_presence TO clirdec_app;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO clirdec_app;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO clirdec_app;