# CLIRDEC:PRESENCE Documentation

## 📚 Documentation Overview

Welcome to the comprehensive documentation suite for CLIRDEC:PRESENCE, a real-time attendance management system designed specifically for CLIRDEC's Bachelor of Science in Information Technology (BSIT) program.

---

## 📖 Documentation Structure

### 🎯 User Manuals

- **[Administrator Manual](./user-manuals/admin-manual.md)** - Complete system administration guide
- **[Faculty Manual](./user-manuals/faculty-manual.md)** - Faculty user guide for attendance monitoring
- **[Student Manual](./user-manuals/student-manual.md)** - Student guide for using the attendance system

### 🛠️ Developer Documentation

- **[System Architecture](./developer/architecture.md)** - Technical architecture and design decisions
- **[API Reference](./developer/api-reference.md)** - Complete API documentation with examples
- **[Deployment Guide](./developer/deployment.md)** - Production deployment and configuration
- **[Incident Response Plan](./incident-response-plan.md)** - Security incident handling procedures

### 📡 API Documentation

- **[OpenAPI Specification](./api/openapi.yaml)** - Complete OpenAPI 3.0.3 specification
- **[API Guide](./api/README.md)** - API usage guide and quick reference

---

## 🚀 Quick Start

### For Administrators

1. **Read the [Administrator Manual](./user-manuals/admin-manual.md)**
2. **Follow the [Deployment Guide](./developer/deployment.md)**
3. **Configure using the [API Reference](./developer/api-reference.md)**

### For Faculty

1. **Read the [Faculty Manual](./user-manuals/faculty-manual.md)**
2. **Access the system at**: `https://faculty.clirdec.edu`
3. **Use default credentials provided by admin**

### For Students

1. **Read the [Student Manual](./user-manuals/student-manual.md)**
2. **Access the system at**: `https://student.clirdec.edu`
3. **Use your CLIRDEC student email**

### For Developers

1. **Study the [System Architecture](./developer/architecture.md)**
2. **Review the [API Reference](./developer/api-reference.md)**
3. **Follow the [Deployment Guide](./developer/deployment.md)**

---

## 🎯 Key Features Documented

### ✅ Real-time Attendance Tracking

- RFID card scanning with ESP32-S3 devices
- Ultrasonic sensor validation
- WebSocket real-time updates
- Mobile app integration

### ✅ Smart Computer Lab Management

- AI-powered seat assignments
- Performance-based allocation
- Conflict-free assignments
- Maintenance scheduling

### ✅ Comprehensive Analytics

- Real-time dashboard metrics
- Attendance trend analysis
- Faculty performance tracking
- Student progress monitoring

### ✅ Multi-platform Support

- **Web Dashboard**: Full-featured admin/faculty interface
- **Mobile App**: iOS/Android student access
- **REST API**: Complete programmatic access
- **IoT Integration**: ESP32-S3 device management

### ✅ Enterprise Security

- JWT authentication with role-based access
- Data encryption at rest and in transit
- Audit logging and compliance
- Multi-factor authentication support

---

## 📋 System Requirements

### Hardware Requirements

- **Server**: Quad-core CPU, 8GB RAM, 100GB SSD
- **IoT Devices**: ESP32-S3 microcontrollers
- **RFID Cards**: ISO 14443A compatible
- **Network**: Gigabit Ethernet, WiFi 6

### Software Requirements

- **Backend**: Node.js 18+, PostgreSQL 13+, Redis 6+
- **Frontend**: Modern web browser with JavaScript enabled
- **Mobile**: iOS 14+ or Android 10+
- **IoT**: Arduino IDE with ESP32-S3 board support

---

## 🔧 API Quick Reference

### Authentication

```bash
# Login
curl -X POST https://api.clirdec.edu/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clirdec.edu","password":"password"}'

# Use token in requests
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://api.clirdec.edu/dashboard/stats
```

### Key Endpoints

- `GET /dashboard/stats` - Real-time statistics
- `GET /attendance` - Attendance records
- `POST /attendance` - Manual attendance entry
- `GET /schedules` - Class schedules
- `GET /students` - Student management
- `GET /computers` - Lab computer management
- `GET /iot-devices` - IoT device management

### WebSocket Real-time Events

```javascript
const ws = new WebSocket("wss://api.clirdec.edu");
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle rfidScan, sensorTrigger, attendanceRecord events
};
```

---

## 🏗️ Architecture Highlights

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Mobile App    │    │   IoT Devices   │
│   (React)       │    │   (React Native)│    │   (ESP32-S3)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   API Gateway   │
                    │   (Express.js)  │
                    └─────────────────┘
                             │
                    ┌─────────────────┐
                    │  Business Logic │
                    │   (Node.js)     │
                    └─────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   PostgreSQL    │ │     Redis       │ │   Email/SMS     │
│   Database      │ │     Cache       │ │   Services      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js 18, Express.js, TypeScript
- **Database**: PostgreSQL 13 with Drizzle ORM
- **Cache**: Redis 6 for session management
- **Real-time**: WebSocket with Socket.IO
- **IoT**: ESP32-S3 with MQTT protocol
- **Deployment**: Docker, PM2, Nginx

---

## 📊 Monitoring & Analytics

### System Metrics

- **Performance**: Response times, throughput, error rates
- **Resources**: CPU, memory, disk usage
- **Database**: Connection pools, query performance
- **IoT**: Device status, signal strength, battery levels

### Business Metrics

- **Attendance Rates**: Daily, weekly, monthly trends
- **User Activity**: Active users, session durations
- **System Usage**: API calls, feature adoption
- **Quality Metrics**: Data accuracy, system reliability

### Monitoring Tools

- **Application**: Custom metrics with Winston logging
- **Infrastructure**: PM2 process management
- **Database**: PostgreSQL monitoring queries
- **External**: Prometheus + Grafana integration

---

## 🔒 Security & Compliance

### Security Features

- **Authentication**: JWT with configurable expiration
- **Authorization**: Role-based access control (RBAC)
- **Encryption**: AES-256 for sensitive data
- **Network**: SSL/TLS with Let's Encrypt certificates
- **Audit**: Comprehensive logging of all actions

### Compliance Standards

- **Data Privacy**: Student data protection regulations
- **Academic Integrity**: Secure attendance validation
- **GDPR**: European data protection compliance
- **Local Laws**: Philippine data privacy regulations

### Security Best Practices

- **Password Policies**: Complexity requirements with expiration
- **Session Management**: Secure session handling with timeouts
- **API Security**: Rate limiting and request validation
- **Data Protection**: Encryption and secure backups

---

## 🚀 Deployment Options

### Quick Start (Docker)

```bash
# Clone repository
git clone https://github.com/clirdec/presence.git
cd presence

# Start with Docker Compose
docker-compose up -d

# Access the application
# Web: http://localhost:3000
# API: http://localhost:3000/api
```

### Production Deployment

```bash
# Install dependencies
npm ci --production=false

# Build application
npm run build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Cloud Deployment

- **AWS**: EC2, RDS, ElastiCache, CloudFront
- **Google Cloud**: GCE, Cloud SQL, Memorystore
- **Azure**: VM, Database, Cache, CDN

---

## 📞 Support & Resources

### Documentation Resources

- **[API Documentation](./api/README.md)** - Complete API reference
- **[Architecture Guide](./developer/architecture.md)** - Technical deep-dive
- **[Deployment Guide](./developer/deployment.md)** - Production setup

### Support Channels

- **📧 Email**: support@clirdec.edu
- **💬 Forums**: community.clirdec.edu
- **📚 Knowledge Base**: help.clirdec.edu
- **🐛 Bug Reports**: GitHub Issues

### Community Resources

- **GitHub Repository**: github.com/clirdec/presence
- **Developer Portal**: developers.clirdec.edu
- **API Playground**: api-playground.clirdec.edu
- **Status Page**: status.clirdec.edu

---

## 📈 Version Information

### Current Version: 1.0.0

**Release Date**: November 27, 2025

#### What's New in 1.0.0

- ✅ Complete attendance management system
- ✅ Real-time RFID and sensor integration
- ✅ AI-powered smart assignments
- ✅ Comprehensive analytics dashboard
- ✅ Multi-platform mobile and web support
- ✅ Enterprise-grade security and monitoring
- ✅ Production-ready deployment guides
- ✅ Complete API documentation

#### Planned Features

- 🔄 **v1.1.0**: Advanced AI analytics and predictions
- 🔄 **v1.2.0**: Enhanced mobile features and offline support
- 🔄 **v2.0.0**: Multi-campus support and advanced integrations

---

## 🤝 Contributing

We welcome contributions to improve CLIRDEC:PRESENCE!

### Ways to Contribute

- **🐛 Bug Reports**: Report issues via GitHub
- **💡 Feature Requests**: Suggest improvements
- **📝 Documentation**: Help improve guides
- **🔧 Code Contributions**: Submit pull requests
- **🧪 Testing**: Help with testing and QA

### Development Setup

```bash
# Fork and clone
git clone https://github.com/your-username/presence.git
cd presence

# Install dependencies
npm install

# Set up development environment
cp .env.example .env
# Configure your local settings

# Start development
npm run dev
```

### Coding Standards

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting with Prettier formatting
- **Testing**: Jest with 80%+ coverage requirement
- **Documentation**: JSDoc for all public APIs

---

## 📜 License

CLIRDEC:PRESENCE is licensed under the MIT License.

```
Copyright (c) 2025 CLIRDEC College of Engineering

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## 🙏 Acknowledgments

### CLIRDEC Team

- **Project Lead**: Dr. Maria Santos
- **Technical Architect**: Prof. Juan Reyes
- **IoT Specialist**: Engr. Ana Cruz
- **Quality Assurance**: Mark Anthony Lopez

### Technology Partners

- **ESP32-S3 Integration**: Arduino Community
- **PostgreSQL Optimization**: PostgreSQL Global Development Group
- **Redis Caching**: Redis Labs

### Open Source Contributions

- **React & TypeScript**: Meta & Microsoft
- **Node.js & Express**: OpenJS Foundation
- **Drizzle ORM**: Drizzle Team
- **Tailwind CSS**: Tailwind Labs

---

## 📞 Contact Information

**CLIRDEC College of Engineering**  
**Information Technology Department**  
**Address**: CLIRDEC Campus, Dasmariñas City, Philippines  
**Phone**: +63-XX-XXX-XXXX  
**Email**: it@clirdec.edu  
**Website**: www.clirdec.edu

**System Support**  
**Email**: support@clirdec.edu  
**Emergency**: +63-XX-XXX-XXXX (24/7)  
**Status Page**: status.clirdec.edu

---

_This documentation is maintained by the CLIRDEC IT Department and is updated regularly to reflect system improvements and user feedback._

**Last Updated**: November 27, 2025  
**Documentation Version**: 1.0.0
