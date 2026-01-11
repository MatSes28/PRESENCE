#!/bin/bash

# ============================================================================
# PRESENCE System - Monitoring Configuration Script
# ============================================================================
# This script configures monitoring and alerting for the PRESENCE system
# Usage: ./monitoring-config.sh [setup|update|status]
# ============================================================================

set -e

# Configuration
CONFIG_DIR="/etc/presence/monitoring"
DEPLOYMENT_DIR="/opt/presence"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    log_error "This script must be run as root"
    exit 1
fi

# Create directories
mkdir -p "$CONFIG_DIR"

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring configuration..."
    
    # Copy monitoring configuration files
    cp -r "$DEPLOYMENT_DIR/monitoring" "$CONFIG_DIR/"
    
    # Configure Prometheus
    log_info "Configuring Prometheus..."
    cat > "$CONFIG_DIR/prometheus.yml" << 'EOF'
# Prometheus configuration for PRESENCE system
scrape_configs:
  - job_name: 'presence-server'
    scrape_interval: 15s
    static_configs:
      - targets: ['server:3000']
  
  - job_name: 'node-exporter'
    scrape_interval: 15s
    static_configs:
      - targets: ['node-exporter:9100']
  
  - job_name: 'postgres-exporter'
    scrape_interval: 15s
    static_configs:
      - targets: ['postgres-exporter:9187']
  
  - job_name: 'redis-exporter'
    scrape_interval: 15s
    static_configs:
      - targets: ['redis-exporter:9121']

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - '/etc/prometheus/alert_rules.yml'
EOF

    # Configure alert rules
    log_info "Configuring alert rules..."
    cat > "$CONFIG_DIR/alert_rules.yml" << 'EOF'
# Alert rules for PRESENCE system
groups:
  - name: presence-alerts
    rules:
      # Database alerts
      - alert: DatabaseConnectionIssues
        expr: up{job="presence-server"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Database connection issues"
          description: "No active database connections for {{ $labels.instance }}"

      - alert: HighDatabaseConnectionUsage
        expr: (pg_stat_activity_count{datname="presence_prod"} / pg_settings_max_connections) > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High database connection usage"
          description: "Database connection usage is at {{ $value | printf "%.2f" }}%"

      # Application alerts
      - alert: HighErrorRate
        expr: rate(error_logs_total[5m]) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate"
          description: "Error rate is {{ $value }} errors per second"

      - alert: ApplicationDown
        expr: up{job="presence-server"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Application is down"
          description: "{{ $labels.instance }} has been down for more than 2 minutes"

      # System alerts
      - alert: HighCPUUsage
        expr: (100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage"
          description: "CPU usage is at {{ $value | printf "%.2f" }}%"

      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100 > 85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is at {{ $value | printf "%.2f" }}%"

      # IoT device alerts
      - alert: IoTDeviceOffline
        expr: iot_device_online{status="offline"} == 1
        for: 30m
        labels:
          severity: warning
        annotations:
          summary: "IoT device offline"
          description: "Device {{ $labels.device_id }} has been offline for 30 minutes"

      - alert: MultipleIoTDevicesOffline
        expr: count(iot_device_online{status="offline"}) > 3
        for: 15m
        labels:
          severity: critical
        annotations:
          summary: "Multiple IoT devices offline"
          description: "{{ $value }} IoT devices are offline"
EOF

    # Configure Alertmanager
    log_info "Configuring Alertmanager..."
    cat > "$CONFIG_DIR/alertmanager.yml" << 'EOF'
# Alertmanager configuration for PRESENCE system
route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 3h
  receiver: 'email-notifications'
  
  routes:
    - match:
        severity: 'critical'
      receiver: 'critical-alerts'
      continue: true
    
    - match:
        severity: 'warning'
      receiver: 'warning-alerts'
      continue: true

receivers:
  - name: 'email-notifications'
    email_configs:
      - to: 'admin@yourdomain.com'
        from: 'alerts@yourdomain.com'
        smarthost: 'smtp.yourdomain.com:587'
        auth_username: 'alerts@yourdomain.com'
        auth_password: 'your-email-password'
        require_tls: true

  - name: 'critical-alerts'
    email_configs:
      - to: 'critical-alerts@yourdomain.com'
        from: 'alerts@yourdomain.com'
        smarthost: 'smtp.yourdomain.com:587'
        auth_username: 'alerts@yourdomain.com'
        auth_password: 'your-email-password'
        require_tls: true
    webhook_configs:
      - url: 'https://webhook.site/your-webhook-url'

  - name: 'warning-alerts'
    email_configs:
      - to: 'warnings@yourdomain.com'
        from: 'alerts@yourdomain.com'
        smarthost: 'smtp.yourdomain.com:587'
        auth_username: 'alerts@yourdomain.com'
        auth_password: 'your-email-password'
        require_tls: true

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
EOF

    # Configure Grafana
    log_info "Configuring Grafana..."
    cat > "$CONFIG_DIR/grafana/dashboards/presence-dashboard.json" << 'EOF'
{
  "title": "PRESENCE System Dashboard",
  "panels": [
    {
      "title": "System Overview",
      "type": "row",
      "panels": [
        {
          "title": "CPU Usage",
          "type": "graph",
          "targets": [
            {
              "expr": "100 - (avg by(instance) (rate(node_cpu_seconds_total{mode='idle'}[1m])) * 100)",
              "legendFormat": "{{instance}}"
            }
          ]
        },
        {
          "title": "Memory Usage",
          "type": "graph",
          "targets": [
            {
              "expr": "(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100",
              "legendFormat": "{{instance}}"
            }
          ]
        }
      ]
    },
    {
      "title": "Database Metrics",
      "type": "row",
      "panels": [
        {
          "title": "Database Connections",
          "type": "graph",
          "targets": [
            {
              "expr": "pg_stat_activity_count{datname='presence_prod'}",
              "legendFormat": "Connections"
            }
          ]
        },
        {
          "title": "Query Performance",
          "type": "graph",
          "targets": [
            {
              "expr": "pg_stat_statements_avg_time_sum",
              "legendFormat": "Avg Query Time"
            }
          ]
        }
      ]
    },
    {
      "title": "Application Metrics",
      "type": "row",
      "panels": [
        {
          "title": "HTTP Requests",
          "type": "graph",
          "targets": [
            {
              "expr": "rate(http_requests_total[1m])",
              "legendFormat": "{{method}} {{path}}"
            }
          ]
        },
        {
          "title": "Error Rate",
          "type": "graph",
          "targets": [
            {
              "expr": "rate(error_logs_total[1m])",
              "legendFormat": "Errors"
            }
          ]
        }
      ]
    }
  ]
}
EOF

    log_success "Monitoring configuration created"
}

# Update monitoring configuration
update_monitoring() {
    log_info "Updating monitoring configuration..."
    
    # Restart monitoring services
    docker-compose -f "$DEPLOYMENT_DIR/docker-compose.production.yml" restart prometheus grafana alertmanager
    
    log_success "Monitoring configuration updated"
}

# Check monitoring status
check_status() {
    log_info "Checking monitoring status..."
    
    # Check if monitoring containers are running
    docker ps --filter "name=presence-prometheus" --format "{{.Names}}" | grep -q "presence-prometheus" && 
        log_success "Prometheus is running" || log_error "Prometheus is not running"
    
    docker ps --filter "name=presence-grafana" --format "{{.Names}}" | grep -q "presence-grafana" && 
        log_success "Grafana is running" || log_error "Grafana is not running"
    
    docker ps --filter "name=presence-alertmanager" --format "{{.Names}}" | grep -q "presence-alertmanager" && 
        log_success "Alertmanager is running" || log_error "Alertmanager is not running"
}

# Main script logic
case "$1" in
    setup)
        setup_monitoring
        ;;
    update)
        update_monitoring
        ;;
    status)
        check_status
        ;;
    *)
        echo "Usage: $0 {setup|update|status}"
        exit 1
        ;;
esac

log_success "Monitoring configuration completed!"
echo -e "\n${GREEN}Monitoring Access:${NC}"
echo "===================="
echo "📊 Grafana: http://yourdomain.com:3000"
echo "   Username: admin"
echo "   Password: (check .env.production file)"
echo ""
echo "📈 Prometheus: http://yourdomain.com:9090"
echo "⚠️  Alertmanager: http://yourdomain.com:9093"
