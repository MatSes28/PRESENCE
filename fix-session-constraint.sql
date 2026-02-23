-- Fix for session creation issue: make user_id nullable in user_sessions table
-- This is needed because connect-pg-simple uses sid/sess/expire columns
-- but the original schema has user_id as NOT NULL
-- Run this SQL in your PostgreSQL database (e.g., via Railway dashboard)

ALTER TABLE user_sessions ALTER COLUMN user_id DROP NOT NULL;

-- Verify the change
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_sessions' AND column_name = 'user_id';
