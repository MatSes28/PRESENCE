# Use Node.js 18 Alpine as base image (using Google mirror to avoid Docker Hub issues)
FROM mirror.gcr.io/library/node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/

# Install dependencies for all workspaces
RUN npm install

# Copy server source code
COPY server/ ./server/
COPY shared/ ./shared/

# Install server dependencies
WORKDIR /app/server
RUN npm install

# Copy shared source files to server (no build needed for TypeScript types)
RUN mkdir -p server/shared && cp -r ../shared/* server/shared/
WORKDIR /app/server

# Copy client source code
COPY client/ ./client/

# Copy database setup script
COPY database_setup.sql ./

# Install PostgreSQL client for database setup
RUN apk add --no-cache postgresql-client

# Setup database schema (skip if already exists)
RUN psql "${DATABASE_URL}" -f database_setup.sql 2>/dev/null || echo "Database setup completed or already exists"

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Build the client
WORKDIR /app/client
RUN npm install
RUN ls -la && npx vite build

# Copy built client to server public directory
RUN mkdir -p ../server/public
RUN cp -r dist/* ../server/public/

# Go back to root directory
WORKDIR /app

# Build the server
WORKDIR /app/server
RUN npm install
RUN npm run build

# Go back to root directory
WORKDIR /app

# Start the application
CMD ["node", "server/dist/src/index.js"]