# CLIRDEC:PRESENCE Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the CLIRDEC:PRESENCE attendance management system in various environments.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Production Deployment](#production-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Cloud Deployment](#cloud-deployment)
6. [Monitoring Setup](#monitoring-setup)
7. [Backup & Recovery](#backup--recovery)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

#### Minimum Hardware

- **CPU**: Quad-core 2.4GHz or higher
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB SSD minimum
- **Network**: 100Mbps broadband

#### Recommended Hardware

- **CPU**: Octa-core 3.0GHz or higher
- **RAM**: 32GB or more
- **Storage**: 200GB NVMe SSD
- **Network**: Gigabit Ethernet

### Software Dependencies

#### Required Software

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y curl wget gnupg2 software-properties-common

# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 13+
sudo apt install -y postgresql postgresql-contrib

# Redis 6+
sudo apt install -y redis-server

# Nginx
sudo apt install -y nginx

# SSL Certificate (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
```

#### Development Tools

```bash
# Git
sudo apt install -y git

# Docker (optional)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Network Configuration

#### Firewall Setup

```bash
# UFW Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow 3000  # Application port
sudo ufw allow 5432  # PostgreSQL (internal only)
sudo ufw allow 6379  # Redis (internal only)
sudo ufw --force enable
```

#### DNS Configuration

```bash
# Add to /etc/hosts or configure DNS
# Production domains
api.clirdec.edu      A     YOUR_SERVER_IP
admin.clirdec.edu    A     YOUR_SERVER_IP
faculty.clirdec.edu  A     YOUR_SERVER_IP
student.clirdec.edu  A     YOUR_SERVER_IP
```

---

## Local Development Setup

### Clone Repository

```bash
# Clone the repository
git clone https://github.com/clirdec/presence.git
cd presence

# Install dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..

# Install shared dependencies
cd shared && npm install && cd ..
```

### Environment Configuration

#### Create Environment Files

```bash
# Root .env
cp .env.example .env
nano .env
```

```bash
# .env configuration
NODE_ENV=development
DATABASE_URL=postgresql://presence_user:secure_password@localhost:5432/clirdec_presence
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_super_secure_jwt_secret_here_min_32_chars
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=admin@clirdec.edu
EMAIL_SMTP_PASS=your_app_password
SESSION_SECRET=another_secure_session_secret
API_PORT=3000
WEBSOCKET_PORT=3001
```

#### Database Setup

```bash
# Create database
sudo -u postgres createdb clirdec_presence

# Create user
sudo -u postgres psql -c "CREATE USER presence_user WITH PASSWORD 'secure_password';"

# Grant permissions
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE clirdec_presence TO presence_user;"

# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

#### Redis Setup

```bash
# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify Redis
redis-cli ping  # Should return PONG
```

### Development Workflow

#### Start Development Server

```bash
# Start all services
npm run dev

# Or start individually
npm run dev:server  # Backend API
npm run dev:client  # Frontend development server
```

#### Development URLs

- **API Server**: `http://localhost:3000`
- **Web Client**: `http://localhost:5173`
- **WebSocket**: `ws://localhost:3001`
- **Database**: `postgresql://localhost:5432/clirdec_presence`
- **Redis**: `redis://localhost:6379`

#### Testing Setup

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit      # Unit tests
npm run test:integration  # Integration tests
npm run test:e2e       # End-to-end tests

# Test coverage
npm run test:coverage
```

---

## Production Deployment

### Server Preparation

#### System Updates

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git htop iotop sysstat

# Configure timezone
sudo timedatectl set-timezone Asia/Manila
```

#### User Setup

```bash
# Create deployment user
sudo useradd -m -s /bin/bash presence
sudo usermod -aG sudo presence

# Switch to deployment user
su - presence

# Generate SSH keys
ssh-keygen -t rsa -b 4096 -C "admin@clirdec.edu"
```

#### Directory Structure

```bash
# Create application directory
sudo mkdir -p /opt/clirdec/presence
sudo chown presence:presence /opt/clirdec/presence

# Application structure
/opt/clirdec/presence/
├── app/           # Application code
├── logs/          # Application logs
├── backups/       # Database backups
├── ssl/           # SSL certificates
└── config/        # Configuration files
```

### Application Deployment

#### Build Application

```bash
# Clone repository
cd /opt/clirdec/presence
git clone https://github.com/clirdec/presence.git app

# Install dependencies
cd app
npm ci --production=false

# Build client
cd client && npm ci && npm run build && cd ..

# Build shared libraries
cd shared && npm ci && npm run build && cd ..
```

#### Environment Configuration

```bash
# Production environment file
nano /opt/clirdec/presence/app/.env
```

```bash
NODE_ENV=production
DATABASE_URL=postgresql://presence_user:SECURE_DB_PASSWORD@localhost:5432/clirdec_presence
REDIS_URL=redis://localhost:6379
JWT_SECRET=VERY_SECURE_JWT_SECRET_MIN_32_CHARS_LONG
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=admin@clirdec.edu
EMAIL_SMTP_PASS=SECURE_APP_PASSWORD
SESSION_SECRET=ANOTHER_VERY_SECURE_SESSION_SECRET
API_PORT=3000
WEBSOCKET_PORT=3001
LOG_LEVEL=info
ENABLE_SSL=true
SSL_CERT_PATH=/opt/clirdec/presence/ssl/cert.pem
SSL_KEY_PATH=/opt/clirdec/presence/ssl/private.key
```

#### Process Management

```bash
# Install PM2
sudo npm install -g pm2

# Create PM2 ecosystem file
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: "presence-api",
      script: "dist/index.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/opt/clirdec/presence/logs/api-error.log",
      out_file: "/opt/clirdec/presence/logs/api-out.log",
      log_file: "/opt/clirdec/presence/logs/api.log",
      time: true,
      watch: false,
      max_memory_restart: "1G",
      restart_delay: 4000,
      autorestart: true,
    },
    {
      name: "presence-websocket",
      script: "dist/websocket-server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      error_file: "/opt/clirdec/presence/logs/ws-error.log",
      out_file: "/opt/clirdec/presence/logs/ws-out.log",
      log_file: "/opt/clirdec/presence/logs/ws.log",
    },
  ],
};
```

```bash
# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Generate startup script
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u presence --hp /home/presence

# Enable PM2 on boot
sudo systemctl enable pm2-presence
```

### Web Server Configuration

#### Nginx Setup

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/clirdec-presence
```

```nginx
# Upstream for load balancing (if multiple instances)
upstream presence_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

# API Server
server {
    listen 80;
    server_name api.clirdec.edu;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.clirdec.edu;

    # SSL Configuration
    ssl_certificate /opt/clirdec/presence/ssl/cert.pem;
    ssl_certificate_key /opt/clirdec/presence/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # API proxy
    location / {
        proxy_pass http://presence_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Web Client
server {
    listen 80;
    server_name admin.clirdec.edu faculty.clirdec.edu student.clirdec.edu;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.clirdec.edu faculty.clirdec.edu student.clirdec.edu;

    # SSL Configuration (same as API)
    ssl_certificate /opt/clirdec/presence/ssl/cert.pem;
    ssl_certificate_key /opt/clirdec/presence/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Security headers (same as API)
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Serve static files
    root /opt/clirdec/presence/app/client/dist;
    index index.html;

    # API proxy for client
    location /api/ {
        proxy_pass http://presence_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Handle client-side routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/clirdec-presence /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### SSL Certificate Setup

```bash
# Obtain Let's Encrypt certificate
sudo certbot --nginx -d api.clirdec.edu -d admin.clirdec.edu -d faculty.clirdec.edu -d student.clirdec.edu

# Set up auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

---

## Docker Deployment

### Docker Compose Setup

#### Create Docker Compose File

```yaml
version: "3.8"

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: presence-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: clirdec_presence
      POSTGRES_USER: presence_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - presence-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U presence_user -d clirdec_presence"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: presence-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - presence-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Application API
  api:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: presence-api
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://presence_user:${DB_PASSWORD}@postgres:5432/clirdec_presence
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      EMAIL_SMTP_HOST: ${EMAIL_SMTP_HOST}
      EMAIL_SMTP_PORT: ${EMAIL_SMTP_PORT}
      EMAIL_SMTP_USER: ${EMAIL_SMTP_USER}
      EMAIL_SMTP_PASS: ${EMAIL_SMTP_PASS}
      API_PORT: 3000
      WEBSOCKET_PORT: 3001
    ports:
      - "127.0.0.1:3000:3000"
      - "127.0.0.1:3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - presence-network
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: presence-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/certs:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      - api
    networks:
      - presence-network

  # Monitoring (Optional)
  prometheus:
    image: prom/prometheus:latest
    container_name: presence-prometheus
    restart: unless-stopped
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--storage.tsdb.path=/prometheus"
      - "--web.console.libraries=/etc/prometheus/console_libraries"
      - "--web.console.templates=/etc/prometheus/consoles"
      - "--storage.tsdb.retention.time=200h"
      - "--web.enable-lifecycle"
    ports:
      - "9090:9090"
    networks:
      - presence-network

  grafana:
    image: grafana/grafana:latest
    container_name: presence-grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: false
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3002:3000"
    networks:
      - presence-network

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
  nginx_logs:

networks:
  presence-network:
    driver: bridge
```

#### Environment Variables

```bash
# .env file for Docker
DB_PASSWORD=very_secure_database_password
REDIS_PASSWORD=very_secure_redis_password
JWT_SECRET=very_secure_jwt_secret_min_32_characters_long
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=admin@clirdec.edu
EMAIL_SMTP_PASS=secure_app_password
GRAFANA_PASSWORD=secure_grafana_password
```

#### Docker Deployment

```bash
# Build and start services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Scale application
docker-compose up -d --scale api=3

# Update application
docker-compose pull && docker-compose up -d

# Backup database
docker exec presence-postgres pg_dump -U presence_user clirdec_presence > backup.sql
```

---

## Cloud Deployment

### AWS Deployment

#### EC2 Setup

```bash
# Launch EC2 instance
aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \
  --count 1 \
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-groups presence-sg \
  --user-data file://cloud-init.sh

# Create security group
aws ec2 create-security-group \
  --group-name presence-sg \
  --description "CLIRDEC Presence Security Group"

# Add rules
aws ec2 authorize-security-group-ingress \
  --group-id sg-12345678 \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-12345678 \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-12345678 \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0
```

#### RDS PostgreSQL

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier presence-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username presence_user \
  --master-user-password secure_password \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-12345678 \
  --db-name clirdec_presence

# Create ElastiCache Redis
aws elasticache create-cache-cluster \
  --cache-cluster-id presence-cache \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --security-group-ids sg-12345678
```

#### Load Balancer

```bash
# Create Application Load Balancer
aws elbv2 create-load-balancer \
  --name presence-alb \
  --subnets subnet-12345678 subnet-87654321 \
  --security-groups sg-12345678

# Create target group
aws elbv2 create-target-group \
  --name presence-targets \
  --protocol HTTP \
  --port 80 \
  --vpc-id vpc-12345678

# Register targets
aws elbv2 register-targets \
  --target-group-arn arn:aws:elasticloadbalancing:... \
  --targets Id=i-1234567890abcdef0
```

### Google Cloud Platform

#### GCE Setup

```bash
# Create VM instance
gcloud compute instances create presence-server \
  --zone=asia-southeast1-a \
  --machine-type=e2-medium \
  --network-tier=PREMIUM \
  --maintenance-policy=MIGRATE \
  --image=ubuntu-2004-focal-v20220101 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-standard \
  --boot-disk-device-name=presence-server \
  --tags=presence-server

# Create firewall rules
gcloud compute firewall-rules create allow-presence \
  --allow tcp:80,tcp:443 \
  --target-tags presence-server \
  --description "Allow HTTP/HTTPS traffic"
```

#### Cloud SQL PostgreSQL

```bash
# Create Cloud SQL instance
gcloud sql instances create presence-db \
  --database-version=POSTGRES_13 \
  --cpu=1 \
  --memory=3840MB \
  --region=asia-southeast1 \
  --root-password=secure_root_password

# Create database
gcloud sql databases create clirdec_presence \
  --instance=presence-db

# Create user
gcloud sql users create presence_user \
  --instance=presence-db \
  --password=secure_password
```

#### Cloud Load Balancing

```bash
# Create backend service
gcloud compute backend-services create presence-backend \
  --protocol HTTP \
  --health-checks presence-health-check \
  --global

# Create URL map
gcloud compute url-maps create presence-url-map \
  --default-service presence-backend

# Create target HTTP proxy
gcloud compute target-http-proxies create presence-http-proxy \
  --url-map presence-url-map

# Create global forwarding rule
gcloud compute forwarding-rules create presence-forwarding-rule \
  --target-http-proxy presence-http-proxy \
  --ports 80 \
  --global
```

---

## Monitoring Setup

### Application Monitoring

#### PM2 Monitoring

```bash
# PM2 monitoring
pm2 monit

# PM2 logs
pm2 logs

# PM2 metrics
pm2 jlist
pm2 show presence-api
```

#### Custom Metrics

```javascript
// Application metrics collection
const metrics = {
  requests: 0,
  errors: 0,
  responseTime: [],
  activeUsers: 0,
  databaseConnections: 0,
};

// Export metrics endpoint
app.get("/metrics", (req, res) => {
  res.json(metrics);
});
```

### System Monitoring

#### Prometheus Configuration

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

scrape_configs:
  - job_name: "presence-api"
    static_configs:
      - targets: ["localhost:3000"]
    metrics_path: "/metrics"
    scrape_interval: 5s

  - job_name: "node-exporter"
    static_configs:
      - targets: ["localhost:9100"]
    scrape_interval: 15s

  - job_name: "postgres-exporter"
    static_configs:
      - targets: ["localhost:9187"]
    scrape_interval: 15s
```

#### Grafana Dashboards

```json
{
  "dashboard": {
    "title": "CLIRDEC Presence Monitoring",
    "tags": ["presence", "clirdec"],
    "timezone": "Asia/Manila",
    "panels": [
      {
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Active Users",
        "type": "singlestat",
        "targets": [
          {
            "expr": "presence_active_users",
            "legendFormat": "Active Users"
          }
        ]
      }
    ]
  }
}
```

### Log Management

#### Log Rotation

```bash
# Logrotate configuration
sudo nano /etc/logrotate.d/presence
```

```
/opt/clirdec/presence/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 presence presence
    postrotate
        pm2 reloadLogs
    endscript
}
```

#### Centralized Logging

```yaml
# Filebeat configuration
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /opt/clirdec/presence/logs/*.log
    fields:
      service: presence
      environment: production

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "presence-%{+yyyy.MM.dd}"
```

---

## Backup & Recovery

### Database Backup

#### Automated Backups

```bash
# Daily backup script
nano /opt/clirdec/presence/backup.sh
```

```bash
#!/bin/bash

# Database backup
BACKUP_DIR="/opt/clirdec/presence/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/clirdec_presence_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform backup
pg_dump -h localhost -U presence_user -d clirdec_presence > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Upload to cloud storage (optional)
# aws s3 cp $BACKUP_FILE.gz s3://clirdec-backups/
# gcloud storage cp $BACKUP_FILE.gz gs://clirdec-backups/

echo "Backup completed: $BACKUP_FILE.gz"
```

```bash
# Make executable and schedule
chmod +x /opt/clirdec/presence/backup.sh

# Add to crontab
crontab -e
# 0 2 * * * /opt/clirdec/presence/backup.sh  # Daily at 2 AM
```

#### Point-in-Time Recovery

```bash
# Restore from backup
gunzip clirdec_presence_20251127_020000.sql.gz
psql -h localhost -U presence_user -d clirdec_presence < clirdec_presence_20251127_020000.sql

# Verify restoration
psql -h localhost -U presence_user -d clirdec_presence -c "SELECT COUNT(*) FROM attendance_records;"
```

### Application Backup

#### Configuration Backup

```bash
# Configuration backup
tar -czf /opt/clirdec/presence/backups/config_$(date +%Y%m%d_%H%M%S).tar.gz \
  /opt/clirdec/presence/app/.env \
  /etc/nginx/sites-available/clirdec-presence \
  /opt/clirdec/presence/ssl/
```

#### Full System Backup

```bash
# System backup script
rsync -av --exclude='node_modules' --exclude='logs' \
  /opt/clirdec/presence/app/ \
  /backup/clirdec_presence_$(date +%Y%m%d_%H%M%S)/
```

### Disaster Recovery

#### Recovery Plan

1. **Assessment**: Determine scope of incident
2. **Isolation**: Stop affected services
3. **Backup**: Ensure recent backups exist
4. **Recovery**: Restore from clean backup
5. **Testing**: Verify system functionality
6. **Monitoring**: Monitor for recurrence

#### Recovery Time Objectives

- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour
- **Maximum Data Loss**: 1 hour of attendance records

---

## Troubleshooting

### Common Issues

#### Application Won't Start

**Symptoms**: PM2 shows errored status
**Solutions**:

```bash
# Check logs
pm2 logs presence-api --lines 100

# Check environment
pm2 show presence-api

# Restart service
pm2 restart presence-api

# Check dependencies
npm list --depth=0
```

#### Database Connection Issues

**Symptoms**: "Connection refused" errors
**Solutions**:

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U presence_user -d clirdec_presence

# Restart database
sudo systemctl restart postgresql

# Check logs
sudo tail -f /var/log/postgresql/postgresql-13-main.log
```

#### High Memory Usage

**Symptoms**: Application consuming excessive memory
**Solutions**:

```bash
# Check memory usage
pm2 monit

# Restart application
pm2 restart presence-api

# Check for memory leaks
pm2 reload presence-api

# Adjust PM2 configuration
pm2 scale presence-api 2  # Reduce instances
```

#### Slow Performance

**Symptoms**: High response times
**Solutions**:

```bash
# Check system resources
htop
iotop

# Check database performance
psql -c "SELECT * FROM pg_stat_activity;"

# Clear caches
redis-cli FLUSHALL

# Restart services
pm2 restart all
```

### Performance Tuning

#### Database Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM attendance_records WHERE date >= '2025-11-01';

-- Update statistics
VACUUM ANALYZE attendance_records;

-- Reindex tables
REINDEX TABLE attendance_records;
```

#### Application Tuning

```javascript
// Optimize Node.js
process.env.UV_THREADPOOL_SIZE = 64;
process.env.NODE_OPTIONS = "--max-old-space-size=4096";

// Connection pooling
const poolConfig = {
  min: 5,
  max: 20,
  idleTimeoutMillis: 60000,
  acquireTimeoutMillis: 60000,
};
```

### Support Resources

#### Getting Help

1. **Documentation**: Check this deployment guide
2. **Logs**: Review application and system logs
3. **Monitoring**: Check Grafana dashboards
4. **Community**: GitHub issues and discussions
5. **Support**: Contact CLIRDEC IT department

#### Emergency Contacts

- **Primary**: it@clirdec.edu
- **Secondary**: admin@clirdec.edu
- **Emergency**: +63-XX-XXX-XXXX

---

## Conclusion

This deployment guide provides comprehensive instructions for deploying CLIRDEC:PRESENCE in various environments. The system is designed for reliability, scalability, and ease of maintenance.

For production deployments, ensure proper security measures, monitoring, and backup strategies are implemented.

**Last Updated**: November 27, 2025
**Version**: 1.0.0
