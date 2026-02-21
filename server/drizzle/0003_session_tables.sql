-- Migration: Create session table for connect-pg-simple
-- This table is required for express-session storage
-- Run this after the main tables are created

-- Create the session table for connect-pg-simple
-- Using a different name to avoid conflict with user_sessions table
CREATE TABLE IF NOT EXISTS "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    PRIMARY KEY ("sid")
);

-- Create index on expire for faster cleanup of expired sessions
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Add comment for documentation
COMMENT ON TABLE "session" IS 'Express session storage table for connect-pg-simple';

-- Also ensure user_sessions table has the correct structure if it exists
-- This handles the case where the table exists but may have issues

DO $$
BEGIN
    -- Check if user_sessions exists and add any missing columns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sessions' AND table_schema = 'public') THEN
        -- Add user_id column if it doesn't exist (for metrics queries)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'user_id') THEN
            ALTER TABLE user_sessions ADD COLUMN user_id INTEGER REFERENCES users(id);
        END IF;
        
        -- Add is_active column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_sessions' AND column_name = 'is_active') THEN
            ALTER TABLE user_sessions ADD COLUMN is_active BOOLEAN DEFAULT true;
        END IF;
    END IF;
END $$;

-- Enable pg_stat_statements extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON TABLE "session" TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE "user_sessions" TO PUBLIC;
