#!/bin/bash

# CLIRDEC:PRESENCE Health Check Script
# This script performs comprehensive health checks for the deployed application

set -e

# Configuration
APP_URL="${APP_URL:-http://localhost:3000}"
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-/health}"
TIMEOUT="${TIMEOUT:-30}"
RETRIES="${RETRIES:-3}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Health check functions
check_http_status() {
    local url="$1"
    local expected_status="${2:-200}"

    log_info "Checking HTTP status for $url"

    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url")

    if [ "$response" -eq "$expected_status" ]; then
        log_info "✓ HTTP status check passed ($response)"
        return 0
    else
        log_error "✗ HTTP status check failed (expected: $expected_status, got: $response)"
        return 1
    fi
}

check_application_health() {
    local url="$APP_URL$HEALTH_ENDPOINT"

    log_info "Checking application health endpoint"

    local response
    response=$(curl -s --max-time "$TIMEOUT" "$url")

    if [ $? -eq 0 ]; then
        # Parse JSON response - check for status field or basic response
        local status
        status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "ok")

        if [ "$status" = "ok" ] || [ "$status" = "healthy" ] || [ "$status" = "degraded" ]; then
            log_info "✓ Application health check passed"
            return 0
        else
            log_error "✗ Application health check failed (status: $status)"
            return 1
        fi
    else
        log_error "✗ Application health check failed (connection error)"
        return 1
    fi
}

check_database_connectivity() {
    log_info "Checking database connectivity"

    # This would typically check a database-specific health endpoint
    # For now, we'll check if the app can respond to database-dependent requests
    local db_check_url="$APP_URL/api/dashboard/stats"

    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$db_check_url")

    if [ "$response" -eq 200 ]; then
        log_info "✓ Database connectivity check passed"
        return 0
    else
        log_error "✗ Database connectivity check failed (HTTP $response)"
        return 1
    fi
}

check_websocket_connectivity() {
    log_info "Checking WebSocket connectivity"

    # Use websocat or similar tool to test WebSocket connection
    if command -v websocat &> /dev/null; then
        local ws_url="ws://localhost:5023/ws"

        if timeout 10 websocat -E "$ws_url" <<< '{"type":"ping"}' &>/dev/null; then
            log_info "✓ WebSocket connectivity check passed"
            return 0
        else
            log_error "✗ WebSocket connectivity check failed"
            return 1
        fi
    else
        log_warn "websocat not available, skipping WebSocket check"
        return 0
    fi
}

check_dependencies() {
    log_info "Checking system dependencies"

    local failed_deps=()

    # Check Redis connectivity
    if ! redis-cli ping &>/dev/null; then
        failed_deps+=("redis")
    fi

    # Check PostgreSQL connectivity (if psql is available)
    if command -v psql &> /dev/null; then
        if ! psql -c "SELECT 1;" &>/dev/null; then
            failed_deps+=("postgresql")
        fi
    fi

    if [ ${#failed_deps[@]} -eq 0 ]; then
        log_info "✓ All dependencies are accessible"
        return 0
    else
        log_error "✗ Failed dependencies: ${failed_deps[*]}"
        return 1
    fi
}

check_performance_metrics() {
    log_info "Checking performance metrics"

    local metrics_url="$APP_URL/api/metrics"
    local response
    response=$(curl -s --max-time "$TIMEOUT" "$metrics_url")

    if [ $? -eq 0 ]; then
        # Check if we got Prometheus metrics format
        if echo "$response" | grep -q "presence_system_cpu_usage"; then
            log_info "✓ Performance metrics endpoint accessible"
            return 0
        else
            log_warn "! Metrics endpoint returned unexpected format"
            return 0
        fi
    else
        log_warn "! Could not retrieve performance metrics"
        return 0
    fi
}

# Main health check function
perform_health_checks() {
    local checks_passed=0
    local total_checks=0

    # HTTP Status Check
    ((total_checks++))
    if check_http_status "$APP_URL"; then
        ((checks_passed++))
    fi

    # Application Health Check
    ((total_checks++))
    if check_application_health; then
        ((checks_passed++))
    fi

    # Database Connectivity Check
    ((total_checks++))
    if check_database_connectivity; then
        ((checks_passed++))
    fi

    # WebSocket Connectivity Check
    ((total_checks++))
    if check_websocket_connectivity; then
        ((checks_passed++))
    fi

    # Dependencies Check
    ((total_checks++))
    if check_dependencies; then
        ((checks_passed++))
    fi

    # Performance Metrics Check
    ((total_checks++))
    if check_performance_metrics; then
        ((checks_passed++))
    fi

    # Summary
    echo
    log_info "Health Check Summary: $checks_passed/$total_checks checks passed"

    if [ $checks_passed -eq $total_checks ]; then
        log_info "🎉 All health checks passed!"
        return 0
    else
        log_error "❌ Some health checks failed ($((total_checks - checks_passed)) failed)"
        return 1
    fi
}

# Retry logic
perform_health_checks_with_retries() {
    local attempt=1

    while [ $attempt -le $RETRIES ]; do
        log_info "Health check attempt $attempt/$RETRIES"

        if perform_health_checks; then
            return 0
        fi

        if [ $attempt -lt $RETRIES ]; then
            log_warn "Retrying in 10 seconds..."
            sleep 10
        fi

        ((attempt++))
    done

    log_error "All health check attempts failed"
    return 1
}

# Main execution
main() {
    log_info "Starting CLIRDEC:PRESENCE Health Check"
    log_info "Application URL: $APP_URL"
    log_info "Timeout: ${TIMEOUT}s"
    log_info "Retries: $RETRIES"

    echo

    if perform_health_checks_with_retries; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main "$@"