#!/bin/sh
# Start Redis in the background
redis-server --daemonize yes --port 6379 --bind 0.0.0.0

# Wait for Redis to be ready
sleep 2

# Start the application
exec node dist/server/src/index.js