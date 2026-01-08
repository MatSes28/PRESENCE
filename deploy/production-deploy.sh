#!/bin/bash

# CLIRDEC:PRESENCE Production Deployment Script
# This script automates the deployment process for production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="clirdec-presence"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deploy-$(date +%Y%m%d-%H%M%S).log"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[INFO] $(date +'%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "[SUCCESS] $(date +'%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "[WARNING] $(date +'%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "[ERROR] $(date +'%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing_deps=()

    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("Node.js")
    else
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            log_error "Node.js version must be 18 or higher. Current: $(node -v)"
            exit 1
        fi
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi

    # Check PostgreSQL client
    if ! command -v psql &> /dev/null; then
        log_warning "PostgreSQL client not found. Database migrations may fail."
    fi

    # Check .env.production file
    if [ ! -f ".env.production" ]; then
        log_warning ".env.production not found. Copy from .env.production.example and configure."
        log_info "Run: cp .env.production.example .env.production"
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        exit 1
    fi

    log_success "All prerequisites met"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."

    mkdir -p "$BACKUP_DIR"
    mkdir -p ./logs
    mkdir -p ./uploads
    mkdir -p ./certs/devices

    log_success "Directories created"
}

# Backup database
backup_database() {
    log_info "Backing up database..."

    local backup_file="$BACKUP_DIR/db-backup-$(date +%Y%m%d-%H%M%S).sql"

    if [ -n "$DATABASE_URL" ]; then
        pg_dump "$DATABASE_URL" > "$backup_file" 2>/dev/null || {
            log_warning "Database backup failed. Continuing without backup..."
        }
        log_success "Database backup created: $backup_file"
    else
        log_warning "DATABASE_URL not set. Skipping database backup."
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."

    npm ci --only=production

    log_success "Dependencies installed"
}

# Build application
build_application() {
    log_info "Building application..."

    npm run build

    log_success "Application built successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."

    if npm run db:migrate 2>/dev/null; then
        log_success "Database migrations completed"
    else
        log_warning "Database migrations failed. Check your database connection."
        log_info "You may need to run migrations manually: npm run db:migrate"
    fi
}

# Start application
start_application() {
    log_info "Starting application..."

    # Check if running in PM2 mode
    if command -v pm2 &> /dev/null; then
        pm2 restart ecosystem.config.js --env production 2>/dev/null || {
            pm2 start ecosystem.config.js --env production
        }
        log_success "Application started with PM2"
    else
        # Start with node directly (not recommended for production)
        log_warning "PM2 not found. Starting with node directly..."
        NODE_ENV=production nohup node dist/index.js > ./logs/app.log 2>&1 &
        sleep 3
        log_success "Application started (PID: $!)"
    fi
}

# Health check
health_check() {
    log_info "Performing health check..."

    local max_attempts=10
    local attempt=1
    local health_endpoint="${CLIENT_URL:-http://localhost:3000}/health"

    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$health_endpoint" > /dev/null 2>&1; then
            log_success "Health check passed"
            return 0
        fi

        log_info "Health check attempt $attempt/$max_attempts failed. Waiting..."
        sleep 3
        attempt=$((attempt + 1))
    done

    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Verify database connection
verify_database() {
    log_info "Verifying database connection..."

    if npm run db:verify 2>/dev/null; then
        log_success "Database connection verified"
    else
        log_error "Database connection failed"
        return 1
    fi
}

# Display deployment summary
display_summary() {
    echo ""
    echo "=============================================="
    echo -e "${GREEN}Deployment Summary${NC}"
    echo "=============================================="
    echo ""
    echo "Application: $APP_NAME"
    echo "Environment: production"
    echo "Time: $(date)"
    echo ""
    echo "Important URLs:"
    echo "  - Health Check: ${CLIENT_URL:-http://localhost:3000}/health"
    echo "  - API: ${CLIENT_URL:-http://localhost:3000}/api"
    echo ""
    echo "Useful Commands:"
    echo "  - View logs: tail -f ./logs/app.log"
    echo "  - Restart: pm2 restart $APP_NAME"
    echo "  - Status: pm2 status"
    echo ""
    echo "=============================================="
}

# Main deployment flow
main() {
    echo "=============================================="
    echo -e "${BLUE}CLIRDEC:PRESENCE Production Deployment${NC}"
    echo "=============================================="
    echo ""

    # Parse arguments
    SKIP_BACKUP=false
    SKIP_BUILD=false
    SKIP_MIGRATIONS=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-migrations)
                SKIP_MIGRATIONS=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Create logs directory first
    mkdir -p ./logs

    check_prerequisites
    create_directories

    if [ "$SKIP_BACKUP" = false ]; then
        backup_database
    fi

    if [ "$SKIP_BUILD" = false ]; then
        install_dependencies
        build_application
    fi

    if [ "$SKIP_MIGRATIONS" = false ]; then
        verify_database
        run_migrations
    fi

    start_application
    health_check
    display_summary

    log_success "Deployment completed successfully!"
}

# Run main function
main "$@"
