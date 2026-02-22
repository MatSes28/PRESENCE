-- Fix for connect-pg-simple session store
-- Run this in Railway SQL console to fix the session error

-- Add unique constraint on sid for connect-pg-simple
ALTER TABLE user_sessions ADD CONSTRAINT IF NOT EXISTS session_sid_key UNIQUE (sid);

-- Add index on expire for better query performance
CREATE INDEX IF NOT EXISTS user_sessions_expire_idx ON user_sessions (expire);
