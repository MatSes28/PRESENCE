# CLIRDEC:PRESENCE Production Deployment Guide

## Overview

This guide outlines the steps to deploy the CLIRDEC:PRESENCE attendance system to production.

## Prerequisites

- Node.js 18+
- PostgreSQL 15+ database
- Docker & Docker Compose (optional)
- Access to Railway or similar hosting platform

## Deployment Steps

### 1. Environment Configuration

```bash
# Copy the example environment file
cp .env.production.example .env.production

# Edit the file with production values
nano .env.production
```

**Required Configuration:**

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `SESSION_SECRET` - Minimum 32 characters
- `BREVO_API_KEY` - Email service API key

### 2. Database Setup

```bash
cd server

# Push schema to database
npm run db:push

# Seed production data (first-time only)
npx tsx src/scripts/seed-production.ts
```

### 3. Build Application

```bash
# Build the server
cd server
npm run build

# Build the client
cd ../client
npm run build
```

### 4. Start Services

**Option A: Using Docker Compose**

```bash
docker-compose -f docker-compose.production.yml up -d
```

**Option B: Using PM2**

```bash
cd server
npm install -g pm2
pm2 start ecosystem.config.js --env production
```

### 5. Verify Deployment

```bash
# Run verification script
./deploy/verify-production.sh

# Test health endpoint
curl http://localhost:3000/health

# Test API endpoints
curl http://localhost:3000/api/integrations/status
```

## Monitoring & Alerts

### Access Monitoring Dashboards

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)
- **Alertmanager**: http://localhost:9093

### Key Metrics to Monitor

1. **System Health**

   - `/health` - Overall system status
   - `/health/live` - Liveness probe
   - `/health/ready` - Readiness probe
   - `/metrics` - Prometheus metrics

2. **Database**

   - Connection pool usage
   - Query performance
   - Active connections

3. **Application**
   - Response times
   - Error rates
   - Memory usage

### Alert Configuration

Alerts are configured in `monitoring/alert_rules.yml`. Key alerts include:

- Service down alerts
- High error rate alerts
- Database connection issues
- IoT device offline alerts

## Backup & Recovery

### Automated Backups

Backups are scheduled via cron in `.env.production`:

```
BACKUP_SCHEDULE=0 2 * * *
```

### Manual Backup

```bash
# Create database backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup-20240101.sql
```

## Rollback Procedure

```bash
# If using Docker
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d previous_version

# If using PM2
pm2 rollback
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS origins
- [ ] Set up rate limiting
- [ ] Enable audit logging
- [ ] Configure backup retention
- [ ] Set up monitoring alerts
- [ ] Enable firewall rules
- [ ] Configure VPN for IoT devices

## Troubleshooting

### Common Issues

1. **Database Connection Failed**

   ```bash
   # Check DATABASE_URL format
   echo $DATABASE_URL

   # Test connection
   psql $DATABASE_URL
   ```

2. **High Memory Usage**

   - Check `/metrics` endpoint
   - Review memory-intensive queries
   - Consider scaling resources

3. **IoT Devices Not Connecting**
   - Verify MQTT broker URL
   - Check device API keys
   - Review firewall rules

### Logs Location

- Application logs: `./logs/`
- Docker logs: `docker logs <container_name>`
- PM2 logs: `pm2 logs`

## Support

- Documentation: `/docs/`
- Runbooks: `/docs/runbooks/`
- Incident Response: `/docs/incident-response-plan.md`

## Quick Reference

| Command                            | Description         |
| ---------------------------------- | ------------------- |
| `./deploy/production-deploy.sh`    | Full deployment     |
| `./deploy/verify-production.sh`    | Verify deployment   |
| `./deploy/scripts/health-check.sh` | Health check        |
| `./deploy/scripts/rollback.sh`     | Rollback deployment |
