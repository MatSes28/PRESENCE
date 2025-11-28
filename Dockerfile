# Multi-stage Dockerfile for production deployment
# Stage 1: Build stage
FROM mirror.gcr.io/library/node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ postgresql-client

# Create app directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/
COPY client/package*.json ./client/

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY server/ ./server/
COPY shared/ ./shared/
COPY client/ ./client/

# Build shared package first
WORKDIR /app/shared
RUN npm run build

# Copy built shared files to server root (so ../../shared/ works from dist/server/src/)
WORKDIR /app
RUN cp -r shared/dist/* shared/

# Build the client
WORKDIR /app/client
RUN npm run build

# Copy built client to server public directory
RUN mkdir -p /app/server/public
RUN cp -r dist/* /app/server/public/

# Build the server
WORKDIR /app/server
RUN npm run build

# Stage 2: Production runtime stage
FROM mirror.gcr.io/library/node:18-alpine AS runtime

# Install runtime dependencies
RUN apk add --no-cache curl postgresql-client redis

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create app directory
WORKDIR /app

# Copy package files
COPY server/package*.json ./
COPY package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/public ./public
COPY --from=builder /app/shared/dist ./shared/dist

# Copy database setup script (for initialization if needed)
COPY database_setup.sql ./

# Create logs directory with proper permissions
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV LOG_LEVEL=info

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/server/src/index.js"]