# CLIRDEC:PRESENCE - Deployment Guide

## Overview

This guide covers the complete deployment process for the CLIRDEC:PRESENCE attendance monitoring system.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Railway account (recommended) or alternative hosting
- Brevo account for email notifications
- Domain name (optional)

## Quick Deploy (Railway - Recommended)

### 1. Prepare Your Repository

```bash
# Clone or push your code to GitHub
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/presence.git
git push -u origin main
```

### 2. Create Railway Project

1. Go to [Railway.app](https://railway.app) and sign in
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Choose the `main` branch

### 3. Add PostgreSQL Database

1. In your Railway project, click "Add Plugin"
2. Select "PostgreSQL"
3. Database will be automatically configured

### 4. Set Environment Variables

In Railway dashboard, go to "Variables" and add:

```env
DATABASE_URL=${{ RAILWAY_POSTGRESQL_URL }}
BREVO_API_KEY=your_brevo_api_key
FROM_EMAIL=clirdecpresence@gmail.com
NODE_ENV=production
SESSION_SECRET=your-32-character-secret-here
JWT_SECRET=your-jwt-secret-key-change-in-production-min-32-chars-long
JWT_REFRESH_SECRET=your-jwt-refresh-secret-key-change-in-production-min-32-chars-long
# 32-byte master key (base64 recommended) or 64-char hex
# node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_MASTER_KEY=your-32-byte-base64-or-64-char-hex
```

### 5. Deploy

Railway will automatically build and deploy your application.

## Manual Deployment

### Local Development Setup

```bash
# Install dependencies
npm install

# Generate secure JWT secrets
node generate-secrets.js

# Copy environment file
cp .env.example .env

# Edit .env with your generated secrets and configuration
nano .env

# Push database schema
npm run db:push --workspace=server
npm run db:verify-schema --workspace=server

# Start development server
npm run dev
```

### Production Server Setup

#### Option 1: VPS/Cloud Server

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Clone repository
git clone https://github.com/yourusername/clirdec-presence.git
cd clirdec-presence

# Install dependencies
npm install

# Build application
npm run build

# Configure environment
cp .env.example .env
# Edit .env with production values

# Setup database
sudo -u postgres createdb clirdec_presence
npm run db:push --workspace=server
npm run db:verify-schema --workspace=server

# Install PM2 for process management
sudo npm install -g pm2

# Start application
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

#### Option 2: Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t clirdec-presence .
docker run -p 3000:3000 --env-file .env clirdec-presence
```

## Generating Secure JWT Secrets

For security, JWT secrets must be cryptographically secure random strings. Never use predictable values like "your-secret-key".

### Using the Secret Generator

```bash
# Generate default 32-byte (64 hex character) secrets
node generate-secrets.js

# Generate longer secrets (recommended for production)
node generate-secrets.js --length 64

# Generate multiple secret pairs
node generate-secrets.js --count 3

# Generate base64 format secrets
node generate-secrets.js --format base64
```

### Manual Generation (Alternative)

```bash
# Using Node.js crypto (recommended)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

### Security Requirements

- **Minimum Length**: 32 bytes (64 hex characters)
- **Random Source**: Cryptographically secure random generator
- **Uniqueness**: Different secrets for JWT_SECRET and JWT_REFRESH_SECRET
- **Storage**: Never commit to version control
- **Rotation**: Regenerate for production deployment

## Environment Configuration

### Required Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Email Service
BREVO_API_KEY=your_brevo_api_key
FROM_EMAIL=matclirdecpresence@gmail.com

# Application

  # REQUIRED (fail-closed in production):
  SESSION_SECRET=32+ chars
  JWT_SECRET=32+ chars
  JWT_REFRESH_SECRET=32+ chars

  # REQUIRED (production CORS allowlist):
# Set at least one of these:
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
# or FRONTEND_URL=https://yourdomain.com
# or CORS_ORIGIN=https://yourdomain.com
  NODE_ENV=production
SESSION_SECRET=32_character_random_string
JWT_SECRET=your_jwt_secret_key_min_32_chars
  JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_min_32_chars
```

## Database migrations (explicit step)

For Postgres deployments, run migrations and then verify critical tables exist:

- Migrate: [`npm run db:push --workspace=server`](server/package.json:10)
- Verify: [`npm run db:verify-schema --workspace=server`](server/package.json:12)
- Verify: [`server/scripts/verify-schema.mjs`](server/scripts/verify-schema.mjs:1)

### Current runtime assumptions

- The canonical schema lives in [`server/src/schema.ts`](server/src/schema.ts:1).
- [`shared/schema.ts`](shared/schema.ts:1) re-exports that schema for shared typing.
- The active PostgreSQL session store is `user_sessions`.
- If schema verification fails in production, treat that as a deployment issue and do not rely on fallback behavior as the long-term fix.

## Secrets rotation

Rotation guidance: [`docs/secrets-rotation.md`](docs/secrets-rotation.md:1)

## TLS termination

Preferred: terminate TLS at the edge/load balancer.

If you must terminate TLS inside nginx for docker-compose:

- Use [`nginx.tls.conf`](nginx.tls.conf:1)
- Run compose with the override [`docker-compose.production.tls.yml`](docker-compose.production.tls.yml:1)

### Optional Variables

```env
PORT=3000
WS_PORT=5023
LOG_LEVEL=info
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Domain Configuration

### Railway (Automatic)

Railway provides automatic HTTPS and custom domains.

### Manual Server

```nginx
# Nginx configuration
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com
```

## IoT Device Configuration

### ESP32 S3 Setup

1. Flash the firmware from `ESP32_S3_DUAL_SENSOR_ATTENDANCE.ino`
2. Update WiFi credentials in the code
3. Set the correct server domain
4. Power on the device

### Device Registration

Devices automatically register when they connect to the WebSocket server.

## Monitoring and Maintenance

### Health Checks

- Application health: `https://yourdomain.com/health`
- WebSocket status: Check browser developer tools

### Logs

```bash
# Railway logs
railway logs

# PM2 logs
pm2 logs

# Application logs (if configured)
tail -f logs/app.log
```

### Database Backup

```bash
# Railway automatic backups
# Or manual backup
pg_dump $DATABASE_URL > backup.sql
```

## Single-Building Rollout Guardrails

Use this runbook when deploying for a single physical building/campus before any horizontal scaling.

### 1) Enforce Single Application Instance

- Use exactly one API process and one WebSocket process for initial rollout.
- Do **not** use cluster autoscaling (`instances: "max"`) during single-building launch.
- For Docker Compose, keep one API replica (`--scale api=1`).

PM2 baseline for single-building:

```javascript
module.exports = {
  apps: [
    {
      name: "presence-api",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      autorestart: true,
    },
    {
      name: "presence-websocket",
      script: "dist/websocket-server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
    },
  ],
};
```

### 2) Monitoring Guardrails (Mandatory)

Before go-live, verify these signals are observable:

- API health endpoint returns healthy continuously (`/health`)
- Error rate alerting is active
- Host CPU, memory, and disk utilization dashboards are visible
- Database connectivity and slow-query indicators are monitored

Minimum alert thresholds for single-building rollout:

- API 5xx rate > 2% for 5 minutes
- p95 API latency > 1000ms for 10 minutes
- Host memory usage > 85% for 10 minutes
- Disk free space < 15%

### 3) Backup Guardrails (Mandatory)

- Perform automated PostgreSQL backups at least daily
- Keep at least 30 days of retention
- Store backup copies outside the app host (object storage or separate backup host)
- Test restore procedure before production launch and after any major schema change

Recommended validation commands:

```bash
# Backup
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore verification (to non-production DB)
psql "$STAGING_DATABASE_URL" < backup_YYYYMMDD_HHMMSS.sql
```

### 4) Change-Control Guardrails

- Deploy only one change set at a time
- Keep rollback scripts ready (`deploy/scripts/rollback.sh`)
- Capture pre-deploy and post-deploy health snapshots
- Do not enable additional replicas until 7 days of stable operation

## Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

#### Database Connection

```bash
# Test connection
npm run db:push

# Check DATABASE_URL format
echo $DATABASE_URL
```

#### WebSocket Issues

- Ensure port 5023 is available
- Check firewall settings
- Verify WebSocket endpoint: `/ws` and `/iot`

#### Email Not Sending

- Verify Brevo API key
- Check FROM_EMAIL is verified in Brevo
- Check email queue via Brevo dashboard

### Performance Optimization

- Enable gzip compression
- Configure rate limiting
- Set up database connection pooling
- Use CDN for static assets

## Security Checklist

- [ ] Change default SESSION_SECRET
- [ ] Set JWT_SECRET and JWT_REFRESH_SECRET (min 32 characters each)
- [ ] Use HTTPS in production
- [ ] Configure CORS properly
- [ ] Set secure cookie flags
- [ ] Regular dependency updates
- [ ] Database backups
- [ ] Monitor for vulnerabilities

## Support

For issues or questions:

- Check the troubleshooting section
- Review server logs
- Contact: support@clsu.edu.ph
