-- Advanced Database Performance Optimizations
-- Additional indexes, query optimizations, and performance enhancements

-- ===========================================
-- ADDITIONAL INDEXES FOR COMPLEX QUERIES
-- ===========================================

-- Advanced attendance analytics indexes
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_date_range ON attendance_records(student_id, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_time_range ON attendance_records(class_session_id, entry_time, exit_time) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_attendance_records_status_time ON attendance_records(status, created_at) WHERE is_active = true;

-- RFID lookup optimization with additional constraints
CREATE INDEX IF NOT EXISTS idx_students_rfid_active ON students(rfid_uid, is_active, student_id) WHERE rfid_uid IS NOT NULL AND is_active = true;

-- Schedule conflict detection indexes
CREATE INDEX IF NOT EXISTS idx_schedules_room_time_overlap ON schedules(classroom_id, day_of_week, start_time, end_time, is_active);
CREATE INDEX IF NOT EXISTS idx_schedules_faculty_time_overlap ON schedules(faculty_id, day_of_week, start_time, end_time, is_active);

-- Computer usage analytics
CREATE INDEX IF NOT EXISTS idx_computer_assignments_usage_stats ON computer_assignments(computer_id, assigned_at, released_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_computer_assignments_student_usage ON computer_assignments(student_id, assigned_at, session_duration) WHERE is_active = true;

-- IoT device performance monitoring
CREATE INDEX IF NOT EXISTS idx_iot_device_heartbeats_performance ON iot_device_heartbeats(device_id, timestamp DESC, battery_level, signal_strength);
CREATE INDEX IF NOT EXISTS idx_iot_devices_status_performance ON iot_devices(status, last_seen DESC) WHERE is_active = true;

-- Error tracking and analytics
CREATE INDEX IF NOT EXISTS idx_error_logs_analytics ON error_logs(timestamp DESC, level, category, endpoint) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_error_logs_user_context ON error_logs(user_id, timestamp DESC) WHERE user_id IS NOT NULL;

-- Notification delivery optimization
CREATE INDEX IF NOT EXISTS idx_push_notifications_delivery ON push_notifications(user_id, read, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_email_notifications_delivery ON email_notifications(recipient_email, sent_at DESC) WHERE is_active = true;

-- ===========================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ===========================================

-- Daily attendance summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_attendance_summary AS
SELECT
  DATE(cs.date) as attendance_date,
  cs.schedule_id,
  s.subject_id,
  s.classroom_id,
  s.faculty_id,
  COUNT(ar.id) as total_records,
  COUNT(CASE WHEN ar.is_valid = true THEN 1 END) as valid_attendance,
  COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_count,
  COUNT(CASE WHEN ar.status = 'late' THEN 1 END) as late_count,
  COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent_count,
  COUNT(CASE WHEN ar.discrepancy_flag = true THEN 1 END) as discrepancies,
  AVG(EXTRACT(EPOCH FROM (ar.exit_time - ar.entry_time))/3600) as avg_session_hours,
  MIN(ar.entry_time) as first_entry,
  MAX(ar.exit_time) as last_exit
FROM class_sessions cs
JOIN schedules sch ON cs.schedule_id = sch.id
JOIN subjects s ON sch.subject_id = s.id
LEFT JOIN attendance_records ar ON cs.id = ar.class_session_id AND ar.is_active = true
WHERE cs.is_active = true
GROUP BY DATE(cs.date), cs.schedule_id, s.subject_id, s.classroom_id, s.faculty_id;

-- Create indexes on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_attendance_summary_unique ON daily_attendance_summary(attendance_date, schedule_id);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_summary_date ON daily_attendance_summary(attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_summary_subject ON daily_attendance_summary(subject_id, attendance_date DESC);

-- Student performance summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS student_performance_summary AS
SELECT
  st.id as student_id,
  st.student_id as student_number,
  st.name as student_name,
  st.year,
  st.section,
  COUNT(DISTINCT en.subject_id) as enrolled_subjects,
  COUNT(DISTINCT ar.class_session_id) as attended_sessions,
  COUNT(CASE WHEN ar.status = 'present' THEN 1 END) as present_count,
  COUNT(CASE WHEN ar.status = 'late' THEN 1 END) as late_count,
  COUNT(CASE WHEN ar.status = 'absent' THEN 1 END) as absent_count,
  ROUND(
    CASE
      WHEN COUNT(ar.id) > 0
      THEN (COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::decimal / COUNT(ar.id)) * 100
      ELSE 0
    END, 2
  ) as attendance_percentage,
  AVG(EXTRACT(EPOCH FROM (ar.exit_time - ar.entry_time))/3600) as avg_daily_hours,
  MAX(ar.created_at) as last_attendance
FROM students st
LEFT JOIN enrollments en ON st.id = en.student_id AND en.is_active = true
LEFT JOIN attendance_records ar ON st.id = ar.student_id AND ar.is_active = true
WHERE st.is_active = true
GROUP BY st.id, st.student_id, st.name, st.year, st.section;

-- Create indexes on student performance view
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_performance_unique ON student_performance_summary(student_id);
CREATE INDEX IF NOT EXISTS idx_student_performance_year_section ON student_performance_summary(year, section, attendance_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_student_performance_percentage ON student_performance_summary(attendance_percentage DESC);

-- Computer utilization summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS computer_utilization_summary AS
SELECT
  c.id as computer_id,
  c.name as computer_name,
  c.classroom_id,
  cl.name as classroom_name,
  COUNT(ca.id) as total_assignments,
  COUNT(CASE WHEN ca.status = 'completed' THEN 1 END) as completed_sessions,
  SUM(ca.session_duration) as total_usage_minutes,
  AVG(ca.session_duration) as avg_session_duration,
  COUNT(DISTINCT ca.student_id) as unique_users,
  MAX(ca.assigned_at) as last_used,
  ROUND(
    CASE
      WHEN COUNT(ca.id) > 0
      THEN (COUNT(CASE WHEN ca.status = 'completed' THEN 1 END)::decimal / COUNT(ca.id)) * 100
      ELSE 0
    END, 2
  ) as utilization_rate
FROM computers c
JOIN classrooms cl ON c.classroom_id = cl.id
LEFT JOIN computer_assignments ca ON c.id = ca.computer_id AND ca.is_active = true
WHERE c.is_active = true
GROUP BY c.id, c.name, c.classroom_id, cl.name;

-- Create indexes on computer utilization view
CREATE UNIQUE INDEX IF NOT EXISTS idx_computer_utilization_unique ON computer_utilization_summary(computer_id);
CREATE INDEX IF NOT EXISTS idx_computer_utilization_rate ON computer_utilization_summary(utilization_rate DESC);
CREATE INDEX IF NOT EXISTS idx_computer_utilization_classroom ON computer_utilization_summary(classroom_id, utilization_rate DESC);

-- ===========================================
-- QUERY OPTIMIZATION FUNCTIONS
-- ===========================================

-- Function to get attendance statistics for a date range
CREATE OR REPLACE FUNCTION get_attendance_stats(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  date DATE,
  total_sessions BIGINT,
  total_attendance BIGINT,
  attendance_rate DECIMAL(5,2),
  late_count BIGINT,
  discrepancy_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(cs.date) as date,
    COUNT(DISTINCT cs.id) as total_sessions,
    COUNT(ar.id) as total_attendance,
    ROUND(
      CASE
        WHEN COUNT(ar.id) > 0
        THEN (COUNT(CASE WHEN ar.is_valid = true THEN 1 END)::decimal / COUNT(ar.id)) * 100
        ELSE 0
      END, 2
    ) as attendance_rate,
    COUNT(CASE WHEN ar.status = 'late' THEN 1 END) as late_count,
    COUNT(CASE WHEN ar.discrepancy_flag = true THEN 1 END) as discrepancy_count
  FROM class_sessions cs
  LEFT JOIN attendance_records ar ON cs.id = ar.class_session_id AND ar.is_active = true
  WHERE cs.date >= p_start_date
    AND cs.date <= p_end_date
    AND cs.is_active = true
  GROUP BY DATE(cs.date)
  ORDER BY DATE(cs.date) DESC;
END;
$$;

-- Function to get student attendance trend
CREATE OR REPLACE FUNCTION get_student_attendance_trend(
  p_student_id INTEGER,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  date DATE,
  sessions_attended BIGINT,
  total_sessions BIGINT,
  attendance_rate DECIMAL(5,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH student_sessions AS (
    SELECT
      DATE(cs.date) as session_date,
      COUNT(ar.id) as attended_count,
      COUNT(*) as total_count
    FROM class_sessions cs
    JOIN schedules s ON cs.schedule_id = s.id
    JOIN enrollments e ON s.subject_id = e.subject_id
      AND e.student_id = p_student_id
      AND e.is_active = true
    LEFT JOIN attendance_records ar ON cs.id = ar.class_session_id
      AND ar.student_id = p_student_id
      AND ar.is_valid = true
      AND ar.is_active = true
    WHERE cs.date >= NOW() - (p_days || ' days')::INTERVAL
      AND cs.is_active = true
      AND s.is_active = true
    GROUP BY DATE(cs.date)
  )
  SELECT
    ss.session_date as date,
    ss.attended_count as sessions_attended,
    ss.total_count as total_sessions,
    ROUND(
      CASE
        WHEN ss.total_count > 0
        THEN (ss.attended_count::decimal / ss.total_count) * 100
        ELSE 0
      END, 2
    ) as attendance_rate
  FROM student_sessions ss
  ORDER BY ss.session_date DESC;
END;
$$;

-- ===========================================
-- DATABASE MAINTENANCE FUNCTIONS
-- ===========================================

-- Function to clean up old attendance records (archive to separate table)
CREATE OR REPLACE FUNCTION archive_old_attendance_records(
  p_days_old INTEGER DEFAULT 365
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Create archive table if it doesn't exist
  CREATE TABLE IF NOT EXISTS attendance_records_archive (
    LIKE attendance_records INCLUDING ALL
  );

  -- Archive old records
  INSERT INTO attendance_records_archive
  SELECT * FROM attendance_records
  WHERE created_at < NOW() - (p_days_old || ' days')::INTERVAL
    AND is_active = true;

  -- Mark as inactive instead of deleting
  UPDATE attendance_records
  SET is_active = false, updated_at = NOW()
  WHERE created_at < NOW() - (p_days_old || ' days')::INTERVAL
    AND is_active = true;

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$;

-- Function to rebuild indexes for better performance
CREATE OR REPLACE FUNCTION rebuild_performance_indexes()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Reindex critical tables
  REINDEX TABLE CONCURRENTLY attendance_records;
  REINDEX TABLE CONCURRENTLY class_sessions;
  REINDEX TABLE CONCURRENTLY schedules;
  REINDEX TABLE CONCURRENTLY students;

  -- Refresh materialized views
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_attendance_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY student_performance_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY computer_utilization_summary;

  RAISE NOTICE 'Performance indexes rebuilt and materialized views refreshed';
END;
$$;

-- ===========================================
-- PERFORMANCE MONITORING VIEWS
-- ===========================================

-- Query performance monitoring view
CREATE OR REPLACE VIEW query_performance_stats AS
SELECT
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation,
  most_common_vals,
  most_common_freqs,
  histogram_bounds,
  avg_width
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY tablename, attname;

-- Index usage statistics view
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC, indexname;

-- Table bloat analysis view
CREATE OR REPLACE VIEW table_bloat_stats AS
SELECT
  schemaname,
  tablename,
  n_tup_ins,
  n_tup_upd,
  n_tup_del,
  n_live_tup,
  n_dead_tup,
  ROUND(
    CASE
      WHEN n_live_tup > 0
      THEN (n_dead_tup::decimal / n_live_tup) * 100
      ELSE 0
    END, 2
  ) as bloat_ratio,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY bloat_ratio DESC;

-- ===========================================
-- AUTOMATIC STATISTICS UPDATES
-- ===========================================

-- Create function to update statistics on large tables
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE 'sql_%'
  LOOP
    -- Analyze table to update statistics
    EXECUTE 'ANALYZE ' || table_record.tablename;

    -- Log the operation
    RAISE NOTICE 'Updated statistics for table: %', table_record.tablename;
  END LOOP;

  RAISE NOTICE 'Table statistics update completed';
END;
$$;

-- ===========================================
-- REFRESH MATERIALIZED VIEWS FUNCTION
-- ===========================================

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Refresh all materialized views
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_attendance_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY student_performance_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY computer_utilization_summary;

  RAISE NOTICE 'Analytics materialized views refreshed';
END;
$$;

-- ===========================================
-- PERFORMANCE ALERTS
-- ===========================================

-- Function to check for performance issues
CREATE OR REPLACE FUNCTION check_performance_alerts()
RETURNS TABLE (
  alert_type TEXT,
  severity TEXT,
  message TEXT,
  recommendation TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check for table bloat
  RETURN QUERY
  SELECT
    'table_bloat'::TEXT as alert_type,
    CASE
      WHEN bloat_ratio > 50 THEN 'high'
      WHEN bloat_ratio > 20 THEN 'medium'
      ELSE 'low'
    END as severity,
    format('Table %s has %.2f%% bloat', tablename, bloat_ratio) as message,
    'Consider running VACUUM FULL or REINDEX' as recommendation
  FROM table_bloat_stats
  WHERE bloat_ratio > 20;

  -- Check for unused indexes
  RETURN QUERY
  SELECT
    'unused_index'::TEXT as alert_type,
    'medium'::TEXT as severity,
    format('Index %s on table %s is rarely used (%s scans)', indexname, tablename, idx_scan) as message,
    'Consider dropping this index if not needed' as recommendation
  FROM index_usage_stats
  WHERE idx_scan < 100;

  -- Check for missing indexes on foreign keys
  RETURN QUERY
  SELECT
    'missing_fk_index'::TEXT as alert_type,
    'high'::TEXT as severity,
    format('Foreign key %s.%s may need an index', conrelid::regclass, conname) as message,
    'Consider creating an index on this foreign key column' as recommendation
  FROM pg_constraint c
  WHERE contype = 'f'
    AND NOT EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = c.conrelid
        AND i.indkey[0] = c.conkey[0]
    );
END;
$$;

-- ===========================================
-- GRANT PERMISSIONS FOR VIEWS AND FUNCTIONS
-- ===========================================

-- Grant permissions to application user (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'clirdec_app') THEN
    GRANT SELECT ON daily_attendance_summary TO clirdec_app;
    GRANT SELECT ON student_performance_summary TO clirdec_app;
    GRANT SELECT ON computer_utilization_summary TO clirdec_app;
    GRANT SELECT ON query_performance_stats TO clirdec_app;
    GRANT SELECT ON index_usage_stats TO clirdec_app;
    GRANT SELECT ON table_bloat_stats TO clirdec_app;

    GRANT EXECUTE ON FUNCTION get_attendance_stats(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO clirdec_app;
    GRANT EXECUTE ON FUNCTION get_student_attendance_trend(INTEGER, INTEGER) TO clirdec_app;
    GRANT EXECUTE ON FUNCTION archive_old_attendance_records(INTEGER) TO clirdec_app;
    GRANT EXECUTE ON FUNCTION rebuild_performance_indexes() TO clirdec_app;
    GRANT EXECUTE ON FUNCTION update_table_statistics() TO clirdec_app;
    GRANT EXECUTE ON FUNCTION refresh_analytics_views() TO clirdec_app;
    GRANT EXECUTE ON FUNCTION check_performance_alerts() TO clirdec_app;
  END IF;
END $$;

--> statement-breakpoint