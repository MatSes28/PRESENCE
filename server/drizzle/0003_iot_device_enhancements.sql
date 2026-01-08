-- IoT Device Enhancements Migration
-- Migration #0003: Add IoT device performance indexes and optimization fields
-- Created: 2024-01-08

-- =====================================================
-- PERFORMANCE INDEXES FOR IOT DEVICE QUERIES
-- =====================================================

-- Index for faster device status lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iot_devices_status
ON iot_devices (status) WHERE is_active = true;

-- Index for device classroom lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iot_devices_classroom
ON iot_devices (classroom_id) WHERE is_active = true;

-- Index for heartbeat timestamp queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iot_device_heartbeats_timestamp
ON iot_device_heartbeats (timestamp DESC);

-- Index for device heartbeat device_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iot_device_heartbeats_device
ON iot_device_heartbeats (device_id);

-- Composite index for device status by classroom
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iot_devices_classroom_status
ON iot_devices (classroom_id, status) WHERE is_active = true;

-- =====================================================
-- IoT DEVICE STATISTICS TABLE (For analytics)
-- =====================================================

CREATE TABLE IF NOT EXISTS iot_device_stats (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    stat_date DATE NOT NULL,
    rfid_scans INTEGER DEFAULT 0,
    sensor_triggers INTEGER DEFAULT 0,
    online_time_seconds BIGINT DEFAULT 0,
    offline_time_seconds BIGINT DEFAULT 0,
    avg_battery_level DECIMAL(5,2),
    avg_signal_strength INTEGER,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_device FOREIGN KEY (device_id)
        REFERENCES iot_devices(device_id) ON DELETE CASCADE
);

-- Index for device stats queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iot_device_stats_date
ON iot_device_stats (device_id, stat_date DESC);

-- =====================================================
-- IoT COMMAND HISTORY TABLE (For debugging)
-- =====================================================

CREATE TABLE IF NOT EXISTS iot_command_history (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    command VARCHAR(100) NOT NULL,
    params JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, sent, delivered, failed
    sent_by INTEGER REFERENCES users(id),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,
    response JSONB,
    error_message TEXT,

    CONSTRAINT fk_device_command FOREIGN KEY (device_id)
        REFERENCES iot_devices(device_id) ON DELETE CASCADE
);

-- Index for command history queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iot_command_history_device
ON iot_command_history (device_id, sent_at DESC);

-- =====================================================
-- IoT DEVICE FIRMWARE TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS iot_device_firmware (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL UNIQUE,
    current_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    last_update TIMESTAMP WITH TIME ZONE,
    update_status VARCHAR(20) DEFAULT 'idle', -- idle, updating, failed, success
    update_started_at TIMESTAMP WITH TIME ZONE,
    update_completed_at TIMESTAMP WITH TIME ZONE,
    update_error TEXT,

    CONSTRAINT fk_device_firmware FOREIGN KEY (device_id)
        REFERENCES iot_devices(device_id) ON DELETE CASCADE
);

-- =====================================================
-- ATTENDANCE SENSOR DATA TABLE (Raw sensor data for debugging)
-- =====================================================

CREATE TABLE IF NOT EXISTS attendance_sensor_data (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    rfid_uid VARCHAR(50),
    distance INTEGER,
    sensor_type VARCHAR(20) NOT NULL, -- ultrasonic, infrared, pir
    raw_value DECIMAL(10,2),
    confidence_score DECIMAL(5,2) DEFAULT 1.0,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_device_sensor FOREIGN KEY (device_id)
        REFERENCES iot_devices(device_id) ON DELETE CASCADE
);

-- Index for sensor data queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_sensor_data_time
ON attendance_sensor_data (device_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_sensor_data_rfid
ON attendance_sensor_data (rfid_uid) WHERE rfid_uid IS NOT NULL;

-- =====================================================
-- PROCEDURES AND FUNCTIONS
-- =====================================================

-- Function to calculate device uptime percentage
CREATE OR REPLACE FUNCTION calculate_device_uptime(
    p_device_id VARCHAR(100),
    p_start_date DATE,
    p_end_date DATE
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    v_total_seconds BIGINT;
    v_online_seconds BIGINT;
BEGIN
    -- Get total time in period (in seconds)
    v_total_seconds := EXTRACT(EPOCH FROM (p_end_date + 1 - p_start_date))::BIGINT;

    -- Get online time from stats table
    SELECT COALESCE(SUM(online_time_seconds), 0)
    INTO v_online_seconds
    FROM iot_device_stats
    WHERE device_id = p_device_id
    AND stat_date BETWEEN p_start_date AND p_end_date;

    -- Calculate percentage
    IF v_total_seconds > 0 THEN
        RETURN ROUND((v_online_seconds::DECIMAL / v_total_seconds::DECIMAL) * 100, 2);
    END IF;

    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate daily device stats
CREATE OR REPLACE FUNCTION aggregate_device_daily_stats(
    p_device_id VARCHAR(100),
    p_date DATE
) RETURNS VOID AS $$
DECLARE
    v_rfid_scans INTEGER;
    v_sensor_triggers INTEGER;
    v_online_seconds BIGINT;
BEGIN
    -- Count RFID scans from sensor data
    SELECT COUNT(*) INTO v_rfid_scans
    FROM attendance_sensor_data
    WHERE device_id = p_device_id
    AND created_at::DATE = p_date
    AND rfid_uid IS NOT NULL;

    -- Count sensor triggers
    SELECT COUNT(*) INTO v_sensor_triggers
    FROM attendance_sensor_data
    WHERE device_id = p_device_id
    AND created_at::DATE = p_date
    AND sensor_type = 'ultrasonic';

    -- Calculate online time (simplified - from heartbeats)
    SELECT COALESCE(SUM(
        EXTRACT(EPOCH FROM (
            LAG(timestamp) OVER (ORDER BY timestamp) - timestamp
        ))::BIGINT
    ), 0) INTO v_online_seconds
    FROM iot_device_heartbeats
    WHERE device_id = p_device_id
    AND timestamp::DATE = p_date
    AND status = 'online';

    -- Upsert stats
    INSERT INTO iot_device_stats (
        device_id, stat_date, rfid_scans, sensor_triggers, online_time_seconds
    ) VALUES (
        p_device_id, p_date, v_rfid_scans, v_sensor_triggers, v_online_seconds
    )
    ON CONFLICT (device_id, stat_date) DO UPDATE SET
        rfid_scans = EXCLUDED.rfid_scans,
        sensor_triggers = EXCLUDED.sensor_triggers,
        online_time_seconds = EXCLUDED.online_time_seconds;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to create firmware record when device is registered
CREATE OR REPLACE FUNCTION create_firmware_record_on_device_create()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO iot_device_firmware (device_id, current_version)
    VALUES (NEW.device_id, '1.0.0')
    ON CONFLICT (device_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_firmware_record
AFTER INSERT ON iot_devices
FOR EACH ROW
EXECUTE FUNCTION create_firmware_record_on_device_create();

-- =====================================================
-- DATA MIGRATION (Existing data)
-- =====================================================

-- Migrate existing device status to stats table
INSERT INTO iot_device_stats (device_id, stat_date, rfid_scans, sensor_triggers)
SELECT
    device_id,
    CURRENT_DATE,
    0,
    0
FROM iot_devices
ON CONFLICT (device_id, stat_date) DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE iot_device_stats IS 'Daily aggregated statistics for IoT devices';
COMMENT ON TABLE iot_command_history IS 'History of commands sent to IoT devices';
COMMENT ON TABLE iot_device_firmware IS 'Firmware version and update tracking for devices';
COMMENT ON TABLE attendance_sensor_data IS 'Raw sensor data for debugging and analytics';

COMMENT ON FUNCTION calculate_device_uptime IS 'Calculate device uptime percentage for a date range';
COMMENT ON FUNCTION aggregate_device_daily_stats IS 'Aggregate daily statistics for a device';
