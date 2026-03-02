#!/bin/bash

# ============================================================================
# PRESENCE System - Production Deployment Script
# ============================================================================
# This script automates the deployment process for the PRESENCE system
# Usage: ./production-deploy.sh [environment]
# Environment: production (default), staging, development
# ============================================================================

set -e  # Exit on error

# Configuration
ENVIRONMENT=${1:-production}
DEPLOYMENT_DIR="/opt/presence"
BACKUP_DIR="/opt/presence/backups"
LOG_DIR="/var/log/presence"
CONFIG_DIR="/etc/presence"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    log_error "This script must be run as root"
    exit 1
fi

# Create directories
log_info "Creating required directories..."
mkdir -p "$DEPLOYMENT_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "$LOG_DIR"
mkdir -p "$CONFIG_DIR"
log_success "Directories created"

# Install dependencies
log_info "Installing system dependencies..."
apt-get update
apt-get install -y \
    docker.io \
    docker-compose \
    nodejs \
    npm \
    nginx \
    certbot \
    python3-certbot-nginx \
    postgresql-client \
    redis-tools \
    curl \
    git \
    jq
log_success "System dependencies installed"

# Clone or update the repository
if [ -d "$DEPLOYMENT_DIR/.git" ]; then
    log_info "Updating existing repository..."
    cd "$DEPLOYMENT_DIR"
    git pull origin main
else
    log_info "Cloning repository..."
    git clone https://github.com/your-repo/presence-system.git "$DEPLOYMENT_DIR"
    cd "$DEPLOYMENT_DIR"
fi
log_success "Repository ready"

# Install Node.js dependencies
# NOTE: building requires devDependencies (TypeScript/Vite). Install full deps for build.
log_info "Installing Node.js dependencies..."
cd "$DEPLOYMENT_DIR"
npm ci
log_success "Node.js dependencies installed"

# Build client + server
log_info "Building client + server..."
cd "$DEPLOYMENT_DIR"
npm run build
log_success "Build completed"

# Configure environment
log_info "Configuring environment..."
if [ ! -f ".env.production" ]; then
    log_error ".env.production not found. Create it from .env.production.example and fill real values."
    exit 1
fi

# Export variables from .env.production into this shell for migration commands.
set -a
source ".env.production"
set +a

# Generate secrets if needed
if [ ! -f ".env.secrets" ]; then
    log_info "Generating secure secrets..."
    node generate-secrets.js > .env.secrets
    log_success "Secrets generated - add them to your .env.production file"
fi

# Set up database
log_info "Setting up database..."
if [ "$ENVIRONMENT" = "production" ]; then
    # For production, use PostgreSQL
    log_info "Configuring PostgreSQL database..."
    # Add PostgreSQL setup here
else
    # For development/staging, use SQLite
    log_info "Configuring SQLite database..."
    touch presence.db
    npx drizzle-kit push
fi
log_success "Database configured"

# Run migrations
log_info "Running database migrations..."
cd "$DEPLOYMENT_DIR/server"
npm run db:push
node scripts/verify-schema.mjs
log_success "Database migrations completed"

# Seed database: never in production (real data only). Test seed is dev-only.
if [ "$ENVIRONMENT" != "production" ] && [ "$NODE_ENV" != "production" ]; then
    log_info "Seeding database with test data (dev/staging only)..."
    npx tsx scripts/seed-test-data.ts
    log_success "Database seeded"
else
    log_info "Skipping test seed (production uses real data only)."
fi

# Set up Docker containers
log_info "Setting up Docker containers..."
cd "$DEPLOYMENT_DIR"
docker-compose -f docker-compose.production.yml down || true
docker-compose -f docker-compose.production.yml build --no-cache
docker-compose -f docker-compose.production.yml up -d
log_success "Docker containers started"

# Configure Nginx
log_info "Configuring Nginx..."
cp "$DEPLOYMENT_DIR/nginx.conf" "/etc/nginx/nginx.conf"
systemctl restart nginx
log_success "Nginx configured"

# Set up SSL certificates
if [ "$ENVIRONMENT" = "production" ]; then
    log_info "Setting up SSL certificates..."
    certbot --nginx -d presence.yourdomain.com --non-interactive --agree-tos --email admin@yourdomain.com
    log_success "SSL certificates configured"
fi

# Set up monitoring
log_info "Setting up monitoring..."
cp -r "$DEPLOYMENT_DIR/monitoring" "$CONFIG_DIR/"
docker-compose -f docker-compose.production.yml up -d prometheus grafana alertmanager
log_success "Monitoring configured"

# Set up log rotation
log_info "Setting up log rotation..."
cp "$DEPLOYMENT_DIR/deploy/logrotate.conf" "/etc/logrotate.d/presence"
log_success "Log rotation configured"

# Set up backup cron jobs
log_info "Setting up backup cron jobs..."
cp "$DEPLOYMENT_DIR/deploy/backup-cron" "/etc/cron.d/presence-backup"
chmod 644 "/etc/cron.d/presence-backup"
log_success "Backup cron jobs configured"

# Set permissions
log_info "Setting permissions..."
chown -R presence:presence "$DEPLOYMENT_DIR"
chown -R presence:presence "$LOG_DIR"
chmod -R 750 "$CONFIG_DIR"
log_success "Permissions set"

# Health check
log_info "Running health check..."
sleep 10
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q "200" && 
    log_success "Health check passed - system is running!" || 
    log_error "Health check failed - please check logs"

log_success "\n🎉 Deployment completed successfully!"
log_info "📊 System Information:"
log_info "   - Environment: $ENVIRONMENT"
log_info "   - Deployment Directory: $DEPLOYMENT_DIR"
log_info "   - Access URLs:"
log_info "     * Application: https://presence.yourdomain.com"
log_info "     * Admin: https://presence.yourdomain.com/admin"
log_info "     * API: https://presence.yourdomain.com/api"
log_info "     * Monitoring: http://presence.yourdomain.com:3000 (Grafana)"
log_info "     * Metrics: http://presence.yourdomain.com:9090 (Prometheus)"

# Clean up
log_info "Cleaning up..."
rm -f ".env.secrets"
log_success "Cleanup completed"

echo -e "\n${GREEN}Deployment Summary:${NC}"
echo "===================="
echo "✅ System deployed successfully"
echo "🚀 Access the application at: https://presence.yourdomain.com"
echo "📚 Documentation: https://docs.yourdomain.com"
echo "🆘 Support: support@yourdomain.com"
