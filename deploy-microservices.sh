#!/bin/bash

# CLIRDEC:PRESENCE Microservices Deployment Script
# This script deploys the complete microservices architecture

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.microservices.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    log_success "Dependencies check passed"
}

create_backup() {
    log_info "Creating backup of current state..."

    mkdir -p "$BACKUP_DIR"

    # Backup database if running
    if docker ps | grep -q presence_database; then
        log_info "Backing up database..."
        docker exec presence_database pg_dump -U user presence > "$BACKUP_DIR/database_backup.sql"
    fi

    # Backup configuration files
    cp -r monitoring/ "$BACKUP_DIR/" 2>/dev/null || true
    cp nginx.conf "$BACKUP_DIR/" 2>/dev/null || true
    cp haproxy.cfg "$BACKUP_DIR/" 2>/dev/null || true
    cp consul-config.json "$BACKUP_DIR/" 2>/dev/null || true

    log_success "Backup created at $BACKUP_DIR"
}

validate_configuration() {
    log_info "Validating configuration..."

    # Check if required files exist
    required_files=("$COMPOSE_FILE" "$ENV_FILE")
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Required file $file not found"
            exit 1
        fi
    done

    # Validate docker-compose file
    if ! docker-compose -f "$COMPOSE_FILE" config > /dev/null 2>&1; then
        log_error "Invalid docker-compose configuration"
        exit 1
    fi

    # Check environment variables
    if [ ! -f ".env.example" ]; then
        log_warning ".env.example not found, creating template..."
        cat > .env.example << EOF
# Database Configuration
DATABASE_URL=postgresql://user:password@database:5432/presence
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=presence

# Redis Configuration
REDIS_URL=redis://redis:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# CDN Configuration
CDN_PROVIDER=cloudflare
CDN_DOMAIN=cdn.presence.clirdec.edu

# Monitoring
PROMETHEUS_RETENTION=200h
GRAFANA_ADMIN_PASSWORD=admin

# Service Discovery
CONSUL_DATACENTER=clirdec-dc1
EOF
    fi

    log_success "Configuration validation passed"
}

deploy_infrastructure() {
    log_info "Deploying infrastructure services..."

    # Start infrastructure services first
    docker-compose -f "$COMPOSE_FILE" up -d service-registry database redis mqtt

    # Wait for services to be healthy
    log_info "Waiting for infrastructure services to be ready..."
    sleep 30

    # Check service health
    if ! docker-compose -f "$COMPOSE_FILE" ps service-registry | grep -q "Up"; then
        log_error "Service registry failed to start"
        exit 1
    fi

    if ! docker-compose -f "$COMPOSE_FILE" ps database | grep -q "Up"; then
        log_error "Database failed to start"
        exit 1
    fi

    log_success "Infrastructure services deployed"
}

deploy_microservices() {
    log_info "Deploying microservices..."

    # Deploy services in dependency order
    services=(
        "auth-service"
        "attendance-service"
        "student-service"
        "reporting-service"
        "notification-service"
        "iot-service"
        "websocket-service"
    )

    for service in "${services[@]}"; do
        log_info "Deploying $service..."
        docker-compose -f "$COMPOSE_FILE" up -d "$service"

        # Wait for service to be healthy
        sleep 10

        if ! docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
            log_warning "$service failed to start, continuing with other services..."
        else
            log_success "$service deployed successfully"
        fi
    done
}

deploy_frontend_and_gateway() {
    log_info "Deploying frontend and API gateway..."

    # Deploy web application
    docker-compose -f "$COMPOSE_FILE" up -d web-app

    # Deploy API gateway
    docker-compose -f "$COMPOSE_FILE" up -d api-gateway

    # Deploy load balancer
    docker-compose -f "$COMPOSE_FILE" up -d load-balancer

    log_success "Frontend and gateway deployed"
}

deploy_monitoring() {
    log_info "Deploying monitoring stack..."

    # Deploy Prometheus and Grafana
    docker-compose -f "$COMPOSE_FILE" up -d prometheus grafana

    log_success "Monitoring stack deployed"
}

run_health_checks() {
    log_info "Running health checks..."

    # Wait for all services to be ready
    sleep 60

    # Check critical services
    critical_services=("api-gateway" "auth-service" "database" "redis")
    for service in "${critical_services[@]}"; do
        if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
            log_success "$service is healthy"
        else
            log_error "$service is not healthy"
            return 1
        fi
    done

    log_success "All health checks passed"
}

setup_cdn() {
    log_info "Setting up CDN configuration..."

    # This would typically involve API calls to CDN provider
    # For now, we'll just log the configuration
    if [ -f "cdn-config.js" ]; then
        log_info "CDN configuration file found. Please configure your CDN provider manually."
        log_info "Run 'node cdn-config.js' to see CDN configuration options."
    fi

    log_success "CDN setup completed (manual configuration required)"
}

cleanup_old_deployments() {
    log_info "Cleaning up old deployments..."

    # Remove dangling images
    docker image prune -f

    # Remove unused volumes (be careful with this)
    # docker volume prune -f

    log_success "Cleanup completed"
}

show_deployment_info() {
    log_info "Deployment completed successfully!"
    echo ""
    echo "Service URLs:"
    echo "  - Main Application: http://localhost:3000"
    echo "  - API Gateway: http://localhost:80"
    echo "  - Load Balancer: http://localhost:8080"
    echo "  - Service Registry: http://localhost:8500"
    echo "  - Prometheus: http://localhost:9090"
    echo "  - Grafana: http://localhost:3008"
    echo ""
    echo "To view logs:"
    echo "  docker-compose -f $COMPOSE_FILE logs -f [service-name]"
    echo ""
    echo "To scale services:"
    echo "  docker-compose -f $COMPOSE_FILE up -d --scale [service-name]=3"
    echo ""
    echo "To stop all services:"
    echo "  docker-compose -f $COMPOSE_FILE down"
}

main() {
    echo "🚀 CLIRDEC:PRESENCE Microservices Deployment"
    echo "=========================================="

    check_dependencies
    create_backup
    validate_configuration
    deploy_infrastructure
    deploy_microservices
    deploy_frontend_and_gateway
    deploy_monitoring

    if run_health_checks; then
        setup_cdn
        cleanup_old_deployments
        show_deployment_info
        log_success "Deployment completed successfully!"
    else
        log_error "Deployment failed due to health check failures"
        log_info "Check logs with: docker-compose -f $COMPOSE_FILE logs"
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    "backup")
        create_backup
        ;;
    "validate")
        validate_configuration
        ;;
    "infrastructure")
        deploy_infrastructure
        ;;
    "microservices")
        deploy_microservices
        ;;
    "monitoring")
        deploy_monitoring
        ;;
    "health-check")
        run_health_checks
        ;;
    "cleanup")
        cleanup_old_deployments
        ;;
    *)
        main
        ;;
esac