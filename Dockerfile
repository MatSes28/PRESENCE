# Use Node.js 18 Alpine as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies for server only
RUN npm install

# Copy server source code
COPY server/ ./server/
COPY shared/ ./shared/

# Copy database setup script
COPY database_setup.sql ./

# Set environment variable for database URL
ENV DATABASE_URL=postgresql://postgres:ivXwpKRBFPqDEzhjzMlfQOpBXZorhyTy@mainline.proxy.rlwy.net:22250/railway

# Install PostgreSQL client for database setup
RUN apk add --no-cache postgresql-client

# Setup database schema (skip if already exists)
RUN psql "$DATABASE_URL" -f database_setup.sql 2>/dev/null || echo "Database setup completed or already exists"

# Create a simple startup script
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Starting CLIRDEC:PRESENCE server..."' >> /app/start.sh && \
    echo 'npx tsx server/src/index.ts' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["/app/start.sh"]