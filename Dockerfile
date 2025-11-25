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

# Copy shared source files to root (needed for imports)
COPY shared/ ./shared/

# Copy client source code
COPY client/ ./client/

# Copy database setup script
COPY database_setup.sql ./

# Copy simple Railway-compatible server
COPY simple-railway-server.js ./

# Copy main server files
COPY server/src/index.ts ./server/src/
COPY server/src/routes.ts ./server/src/
COPY server/src/storage.ts ./server/src/

# Install PostgreSQL client for database setup
RUN apk add --no-cache postgresql-client curl

# Skip database setup during build - will be handled at runtime
# RUN psql "${DATABASE_URL}" -f database_setup.sql 2>/dev/null || echo "Database setup completed or already exists"

# Set default port (Railway will override this)
ENV PORT=3000

# Expose port
EXPOSE 3000

# Railway handles healthchecks automatically - no need for HEALTHCHECK directive

# Build the client
WORKDIR /app/server/client
RUN npm install
RUN npx vite build

# Copy built client to server public directory
RUN mkdir -p ../public
RUN cp -r dist/* ../public/

# Go back to root directory
WORKDIR /app

# Build the server
WORKDIR /app/server
RUN npm install
RUN npm run build

# Copy shared directory to server for runtime imports
RUN cp -r ../shared ./

# Go back to server directory for startup
WORKDIR /app/server

# Start the main Express server
CMD ["npm", "start"]