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
COPY client/ ./client/

# Install server dependencies
WORKDIR /app/server
RUN npm install

# Copy shared source files to server (no build needed for TypeScript types)
WORKDIR /app
RUN mkdir -p server/shared && cp -r shared/* server/shared/
WORKDIR /app/server

# Copy database setup script
COPY database_setup.sql ./server/

# Install PostgreSQL client for database setup
RUN apk add --no-cache postgresql-client

# Setup database schema (skip if already exists)
WORKDIR /app/server
RUN psql "${DATABASE_URL}" -f database_setup.sql 2>/dev/null || echo "Database setup completed or already exists"

# Expose port
EXPOSE 3000

# Build the client
WORKDIR /app/client
RUN npm install
RUN npx vite build

# Copy built client to server public directory
RUN mkdir -p /app/server/public
RUN cp -r dist/* /app/server/public/

# Build the server
WORKDIR /app/server
RUN npm install
RUN npm run build

# Set working directory for runtime
WORKDIR /app/server

# Start the application
CMD ["node", "/app/server/dist/server/src/index.js"]