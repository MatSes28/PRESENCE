-- Fix session table for connect-pg-simple
-- Run this SQL directly in Railway PostgreSQL database

-- Make user_id nullable
ALTER TABLE user_sessions ALTER COLUMN user_id DROP NOT NULL;

-- Make ip_address nullable  
ALTER TABLE user_sessions ALTER COLUMN ip_address DROP NOT NULL;

-- Make session_id nullable if it exists
ALTER TABLE user_sessions ALTER COLUMN session_id DROP NOT NULL;

-- Verify the changes
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_sessions';
