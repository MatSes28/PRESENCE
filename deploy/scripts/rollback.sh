#!/bin/bash

# CLIRDEC:PRESENCE Rollback Script
# This script provides automated rollback capabilities for deployment failures

set -e

# Configuration
DEPLOYMENT_DIR="${DEPLOYMENT_DIR:-/opt/clirdec-presence}"
BACKUP_DIR="${BACKUP_DIR:-/opt/clirdec-presence/backups}"
ROLLBACK_TIMEOUT="${ROLLBACK_TIMEOUT:-300}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-5}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Function to find latest backup
find_latest_backup() {
    local backup_type="$1"

    # Find the most recent backup of the specified type
    find "$BACKUP_DIR" -name "*${backup_type}*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null |
    sort -n |
    tail -1 |
    cut -d' ' -f2-
}

# Function to stop application
stop_application() {
    log_step "Stopping application services"

    # Stop using PM2 if available
    if command -v pm2 &> /dev/null; then
        pm2 stop all 2>/dev/null || true
        pm2 delete all 2>/dev/null || true
    fi

    # Stop using systemctl if available
    if command -v systemctl &> /dev/null; then
        systemctl stop clirdec-presence 2>/dev/null || true
    fi

    # Kill any remaining processes
    pkill -f "node.*clirdec-presence" 2>/dev/null || true

    log_info "Application services stopped"
}

# Function to start application
start_application() {
    log_step "Starting application services"

    cd "$DEPLOYMENT_DIR"

    # Start using PM2 if ecosystem file exists
    if [ -f "ecosystem.config.js" ] && command -v pm2 &> /dev/null; then
        pm2 start ecosystem.config.js
        pm2 save
    elif command -v systemctl &> /dev/null; then
        systemctl start clirdec-presence
    else
        # Fallback: start directly
        npm start &
        echo $! > app.pid
    fi

    log_info "Application services started"
}

# Function to restore application code
rollback_application() {
    local backup_file="$1"

    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        log_error "Application backup file not found: $backup_file"
        return 1
    fi

    log_step "Restoring application code from backup: $backup_file"

    # Create temporary directory for extraction
    local temp_dir
    temp_dir=$(mktemp -d)

    # Extract backup
    if ! tar -xzf "$backup_file" -C "$temp_dir"; then
        log_error "Failed to extract backup archive"
        rm -rf "$temp_dir"
        return 1
    fi

    # Stop application before rollback
    stop_application

    # Backup current state (just in case)
    local current_backup="$BACKUP_DIR/pre-rollback-$(date +%Y%m%d-%H%M%S).tar.gz"
    log_info "Creating pre-rollback backup: $current_backup"
    tar -czf "$current_backup" -C "$DEPLOYMENT_DIR" . 2>/dev/null || true

    # Restore from backup
    log_info "Restoring application files"
    cp -r "$temp_dir"/* "$DEPLOYMENT_DIR"/ 2>/dev/null || true

    # Restore permissions
    chown -R www-data:www-data "$DEPLOYMENT_DIR" 2>/dev/null || true

    # Clean up
    rm -rf "$temp_dir"

    log_info "Application code restored successfully"
}

# Function to rollback database
rollback_database() {
    local backup_file="$1"

    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        log_error "Database backup file not found: $backup_file"
        return 1
    fi

    log_step "Restoring database from backup: $backup_file"

    # Extract and restore database dump
    local db_dump_file="$BACKUP_DIR/temp_db_restore.sql"

    if ! tar -xzf "$backup_file" -C "$BACKUP_DIR" "database.sql"; then
        log_error "Failed to extract database backup"
        return 1
    fi

    # Restore database (adjust command based on your database)
    if command -v psql &> /dev/null; then
        log_info "Restoring PostgreSQL database"
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_DIR/database.sql"
    else
        log_error "PostgreSQL client not available"
        return 1
    fi

    # Clean up
    rm -f "$db_dump_file"

    log_info "Database restored successfully"
}

# Function to perform health check
perform_health_check() {
    local max_attempts="$HEALTH_CHECK_RETRIES"
    local attempt=1

    log_step "Performing health checks"

    while [ $attempt -le $max_attempts ]; do
        log_info "Health check attempt $attempt/$max_attempts"

        # Use the health check script if available
        if [ -f "$DEPLOYMENT_DIR/deploy/scripts/health-check.sh" ]; then
            if "$DEPLOYMENT_DIR/deploy/scripts/health-check.sh"; then
                log_info "✓ Health check passed"
                return 0
            fi
        else
            # Basic health check
            if curl -f -s --max-time 30 "http://localhost:3000/health" > /dev/null; then
                log_info "✓ Basic health check passed"
                return 0
            fi
        fi

        log_warn "Health check failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done

    log_error "All health checks failed"
    return 1
}

# Function to send notifications
send_notification() {
    local message="$1"
    local level="${2:-info}"

    log_info "Sending $level notification: $message"

    # Send to Slack if webhook is configured
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
             --data "{\"text\":\"[$level] CLIRDEC:PRESENCE Rollback: $message\"}" \
             "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi

    # Send email if configured
    if [ -n "$ALERT_EMAIL" ] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "CLIRDEC:PRESENCE Rollback [$level]" "$ALERT_EMAIL" 2>/dev/null || true
    fi
}

# Function to cleanup old backups
cleanup_old_backups() {
    log_step "Cleaning up old rollback backups"

    # Keep only last 5 rollback backups
    find "$BACKUP_DIR" -name "pre-rollback-*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null |
    sort -n |
    head -n -5 |
    cut -d' ' -f2- |
    xargs -r rm -f

    log_info "Old rollback backups cleaned up"
}

# Main rollback function
perform_rollback() {
    local rollback_type="${1:-full}"
    local start_time
    start_time=$(date +%s)

    log_info "Starting rollback procedure (type: $rollback_type)"
    send_notification "Rollback started (type: $rollback_type)" "warn"

    # Set up error handling
    trap 'send_notification "Rollback failed with error" "error"' ERR

    case "$rollback_type" in
        "application")
            # Find latest application backup
            local app_backup
            app_backup=$(find_latest_backup "application")

            if [ -n "$app_backup" ]; then
                rollback_application "$app_backup"
            else
                log_error "No application backup found"
                return 1
            fi
            ;;

        "database")
            # Find latest database backup
            local db_backup
            db_backup=$(find_latest_backup "database")

            if [ -n "$db_backup" ]; then
                rollback_database "$db_backup"
            else
                log_error "No database backup found"
                return 1
            fi
            ;;

        "full")
            # Rollback both application and database
            local app_backup db_backup

            app_backup=$(find_latest_backup "application")
            db_backup=$(find_latest_backup "database")

            if [ -n "$db_backup" ]; then
                rollback_database "$db_backup"
            fi

            if [ -n "$app_backup" ]; then
                rollback_application "$app_backup"
            fi

            if [ -z "$app_backup" ] && [ -z "$db_backup" ]; then
                log_error "No backups found for full rollback"
                return 1
            fi
            ;;

        *)
            log_error "Invalid rollback type: $rollback_type"
            echo "Usage: $0 {application|database|full}"
            return 1
            ;;
    esac

    # Start application
    start_application

    # Perform health checks
    if perform_health_check; then
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - start_time))

        log_info "Rollback completed successfully in ${duration}s"
        send_notification "Rollback completed successfully in ${duration}s" "info"

        # Cleanup old backups
        cleanup_old_backups

        return 0
    else
        log_error "Rollback completed but health checks failed"
        send_notification "Rollback completed but application is unhealthy" "error"
        return 1
    fi
}

# Function to show rollback status
show_rollback_status() {
    log_info "Rollback Status Information"
    echo

    echo "Available backups:"
    echo "=================="

    echo "Application backups:"
    find "$BACKUP_DIR" -name "*application*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null |
    sort -n |
    while read -r line; do
        timestamp=$(echo "$line" | cut -d' ' -f1)
        filepath=$(echo "$line" | cut -d' ' -f2-)
        date_str=$(date -d "@$timestamp" '+%Y-%m-%d %H:%M:%S')
        size=$(du -h "$filepath" | cut -f1)
        echo "  $date_str - $size - $(basename "$filepath")"
    done

    echo
    echo "Database backups:"
    find "$BACKUP_DIR" -name "*database*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null |
    sort -n |
    while read -r line; do
        timestamp=$(echo "$line" | cut -d' ' -f1)
        filepath=$(echo "$line" | cut -d' ' -f2-)
        date_str=$(date -d "@$timestamp" '+%Y-%m-%d %H:%M:%S')
        size=$(du -h "$filepath" | cut -f1)
        echo "  $date_str - $size - $(basename "$filepath")"
    done

    echo
    echo "Application status:"
    if pgrep -f "node.*clirdec-presence" > /dev/null; then
        echo "  ✓ Application is running"
    else
        echo "  ✗ Application is not running"
    fi

    echo
    echo "Recent logs:"
    if [ -f "$DEPLOYMENT_DIR/logs/combined.log" ]; then
        tail -10 "$DEPLOYMENT_DIR/logs/combined.log" | while read -r line; do
            echo "  $line"
        done
    fi
}

# Main execution
main() {
    local action="${1:-rollback}"
    local rollback_type="${2:-full}"

    log_info "CLIRDEC:PRESENCE Rollback Script"
    log_info "Action: $action"
    log_info "Type: $rollback_type"
    log_info "Deployment Directory: $DEPLOYMENT_DIR"
    log_info "Backup Directory: $BACKUP_DIR"

    case "$action" in
        "rollback")
            perform_rollback "$rollback_type"
            ;;
        "status")
            show_rollback_status
            ;;
        *)
            echo "Usage: $0 {rollback|status} [rollback_type]"
            echo "  rollback_type: application, database, or full (default: full)"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"