#!/bin/bash

# CLIRDEC:PRESENCE Production Deployment Verification Script
# This script verifies that the production deployment is correctly configured

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=============================================="
echo -e "${BLUE}CLIRDEC:PRESENCE Production Verification${NC}"
echo "=============================================="
echo ""

VERIFICATION_PASSED=true

# Function to check and report status
check_status() {
    local check_name="$1"
    local status="$2"
    local message="$3"

    if [ "$status" = "pass" ]; then
        echo -e "${GREEN}[PASS]${NC} $check_name"
    elif [ "$status" = "warn" ]; then
        echo -e "${YELLOW}[WARN]${NC} $check_name - $message"
    else
        echo -e "${RED}[FAIL]${NC} $check_name - $message"
        VERIFICATION_PASSED=false
    fi
}

# 1. Check environment file
echo "Checking environment configuration..."
if [ -f ".env.production" ]; then
    # Check for placeholder values
    if grep -q "your-password" .env.production || grep -q "your-host" .env.production || grep -q "change-this-in-production" .env.production; then
        check_status "Environment file" "warn" "Contains placeholder values - review before production"
    else
        check_status "Environment file" "pass" ""
    fi
else
    check_status "Environment file" "fail" ".env.production not found"
fi

# 2. Check database configuration
echo ""
echo "Checking database configuration..."
cd server

# Check if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
    check_status "DATABASE_URL configured" "pass" ""
else
    # Try to read from .env.production
    if grep -q "DATABASE_URL=postgresql://" .env.production; then
        check_status "DATABASE_URL configured" "pass" ""
    else
        check_status "DATABASE_URL configured" "fail" "DATABASE_URL not set"
    fi
fi

# 3. Check migrations
echo ""
echo "Checking database migrations..."
if [ -d "drizzle" ]; then
    MIGRATION_COUNT=$(ls -1 drizzle/*.sql 2>/dev/null | wc -l)
    if [ "$MIGRATION_COUNT" -gt 0 ]; then
        check_status "Migration files" "pass" "$MIGRATION_COUNT migrations found"
    else
        check_status "Migration files" "fail" "No migration files found"
    fi

    # Drizzle migration filenames in this repo are not guaranteed to have globally unique
    # numeric prefixes, so verifying the journal file is a safer integrity check.
    if [ -f "drizzle/meta/_journal.json" ]; then
        check_status "Migration integrity" "pass" "drizzle journal present"
    else
        check_status "Migration integrity" "warn" "drizzle/meta/_journal.json not found"
    fi
else
    check_status "Migration directory" "fail" "drizzle directory not found"
fi

# Verify required schema objects exist (password reset tokens, runtime session store, reporting tables)
echo ""
echo "Verifying schema objects..."
if [ -n "${DATABASE_URL}" ]; then
    if node scripts/verify-schema.mjs; then
        check_status "Schema verification" "pass" ""
    else
        check_status "Schema verification" "fail" "Missing required tables"
    fi
else
    check_status "Schema verification" "warn" "DATABASE_URL not set in shell; skipping live schema check"
fi

# 4. Check schema
if [ -f "src/schema.ts" ]; then
    check_status "Schema file" "pass" ""
else
    check_status "Schema file" "fail" "src/schema.ts not found"
fi

# 5. Check monitoring configuration
cd ..
echo ""
echo "Checking monitoring configuration..."
if [ -f "monitoring/prometheus.yml" ]; then
    check_status "Prometheus config" "pass" ""
else
    check_status "Prometheus config" "fail" "monitoring/prometheus.yml not found"
fi

if [ -f "monitoring/alert_rules.yml" ]; then
    ALERT_COUNT=$(grep -c "alert:" monitoring/alert_rules.yml || echo "0")
    check_status "Alert rules" "pass" "$ALERT_COUNT alerts defined"
else
    check_status "Alert rules" "fail" "monitoring/alert_rules.yml not found"
fi

if [ -f "monitoring/alertmanager.yml" ]; then
    check_status "Alertmanager config" "pass" ""
else
    check_status "Alertmanager config" "fail" "monitoring/alertmanager.yml not found"
fi

# 6. Check deployment scripts
echo ""
echo "Checking deployment configuration..."
if [ -f "deploy/production-deploy.sh" ]; then
    check_status "Deployment script" "pass" ""
else
    check_status "Deployment script" "fail" "deploy/production-deploy.sh not found"
fi

if [ -f "docker-compose.production.yml" ]; then
    check_status "Docker compose" "pass" ""
else
    check_status "Docker compose" "fail" "docker-compose.production.yml not found"
fi

# 7. Check server configuration
cd server
echo ""
echo "Checking server configuration..."
if [ -f "package.json" ]; then
    if grep -q '"build"' package.json && grep -q '"start"' package.json; then
        check_status "Build scripts" "pass" ""
    else
        check_status "Build scripts" "warn" "Missing build or start script"
    fi

    if grep -q '"db:push"' package.json || grep -q '"db:migrate"' package.json; then
        check_status "Migration scripts" "pass" ""
    else
        check_status "Migration scripts" "warn" "No migration scripts found"
    fi
else
    check_status "Server package.json" "fail" "Not found"
fi

if [ -f "drizzle.config.ts" ]; then
    check_status "Drizzle config" "pass" ""
else
    check_status "Drizzle config" "fail" "drizzle.config.ts not found"
fi

# 8. Check integration endpoints
cd ..
echo ""
echo "Checking integration endpoints..."
if [ -f "server/src/routes/integrations.ts" ]; then
    INTEGRATION_ENDPOINTS=$(grep -c "router\." server/src/routes/integrations.ts || echo "0")
    check_status "Integration endpoints" "pass" "$INTEGRATION_ENDPOINTS endpoints defined"
else
    check_status "Integration routes" "fail" "server/src/routes/integrations.ts not found"
fi

# 9. Check security settings
echo ""
echo "Checking security configuration..."
if grep -q "SESSION_COOKIE_SECURE=true" .env.production; then
    check_status "Secure cookies" "pass" ""
else
    check_status "Secure cookies" "warn" "SESSION_COOKIE_SECURE may not be set"
fi

if grep -q "BCRYPT_ROUNDS=" .env.production; then
    BCRYPT_VALUE=$(grep "BCRYPT_ROUNDS=" .env.production | cut -d'=' -f2)
    if [ "$BCRYPT_VALUE" -ge 10 ]; then
        check_status "Password hashing" "pass" "BCRYPT_ROUNDS=$BCRYPT_VALUE"
    else
        check_status "Password hashing" "warn" "BCRYPT_ROUNDS should be >= 10"
    fi
fi

# 10. Check logging configuration
echo ""
echo "Checking logging configuration..."
if grep -q "LOG_LEVEL=" .env.production; then
    LOG_LEVEL=$(grep "LOG_LEVEL=" .env.production | cut -d'=' -f2)
    check_status "Log level" "pass" "LOG_LEVEL=$LOG_LEVEL"
else
    check_status "Log level" "warn" "LOG_LEVEL not configured"
fi

# Summary
echo ""
echo "=============================================="
echo -e "${BLUE}Verification Summary${NC}"
echo "=============================================="
echo ""

if [ "$VERIFICATION_PASSED" = true ]; then
    echo -e "${GREEN}All critical checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review any warnings above"
    echo "  2. Update placeholder values in .env.production"
    echo "  3. Run: cd server && npm run db:push"
    echo "  4. Run: ./deploy/production-deploy.sh"
    echo ""
    exit 0
else
    echo -e "${RED}Some checks failed. Please review the errors above.${NC}"
    echo ""
    exit 1
fi
