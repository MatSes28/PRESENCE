-- Fix for Railway: Make expires_at column nullable in user_sessions
ALTER TABLE "user_sessions" ALTER COLUMN "expires_at" DROP NOT NULL;
ALTER TABLE "user_sessions" ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "user_sessions" ALTER COLUMN "ip_address" DROP NOT NULL;
ALTER TABLE "user_sessions" ALTER COLUMN "session_id" DROP NOT NULL;

-- Verify
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_sessions' 
ORDER BY ordinal_position;
