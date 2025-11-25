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
```

### 5. Deploy

Railway will automatically build and deploy your application.

## Manual Deployment

### Local Development Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Push database schema
npm run db:push

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
npm run db:push

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

## Environment Configuration

### Required Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Email Service
BREVO_API_KEY=your_brevo_api_key
FROM_EMAIL=matclirdecpresence@gmail.com

# Application
NODE_ENV=production
SESSION_SECRET=32_character_random_string
```

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
