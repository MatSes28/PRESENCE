# CLIRDEC:PRESENCE System Architecture

## Overview

CLIRDEC:PRESENCE is a comprehensive attendance management system built with modern web technologies, designed for the Bachelor of Science in Information Technology (BSIT) program at CLIRDEC's College of Engineering.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Database Design](#database-design)
4. [API Design](#api-design)
5. [Real-time Communication](#real-time-communication)
6. [Security Architecture](#security-architecture)
7. [Deployment Architecture](#deployment-architecture)
8. [Performance Considerations](#performance-considerations)
9. [Scalability Design](#scalability-design)

---

## System Architecture

### High-Level Architecture

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

### Component Overview

#### Frontend Layer

- **Web Client**: React-based dashboard for administrators and faculty
- **Mobile App**: React Native application for students and faculty
- **IoT Devices**: ESP32-S3 microcontrollers with RFID readers and sensors

#### Backend Layer

- **API Gateway**: Express.js server handling HTTP requests
- **Business Logic**: Core attendance processing and validation
- **Real-time Engine**: WebSocket server for live updates

#### Data Layer

- **Primary Database**: PostgreSQL with Drizzle ORM
- **Cache Layer**: Redis for session management and performance
- **External Services**: Email and SMS notification services

---

## Technology Stack

### Frontend Technologies

#### Web Client

```json
{
  "framework": "React 18",
  "language": "TypeScript",
  "styling": "Tailwind CSS",
  "state": "React Hooks + Context",
  "routing": "Wouter",
  "charts": "Recharts",
  "icons": "Heroicons",
  "build": "Vite"
}
```

#### Mobile App

```json
{
  "framework": "React Native",
  "language": "TypeScript",
  "navigation": "React Navigation",
  "state": "Redux Toolkit",
  "storage": "AsyncStorage",
  "notifications": "React Native Notifications",
  "biometrics": "React Native Biometrics"
}
```

#### IoT Devices

```json
{
  "hardware": "ESP32-S3",
  "firmware": "Arduino IDE",
  "protocol": "MQTT",
  "sensors": "RC522 RFID + Ultrasonic",
  "communication": "WiFi + MQTT",
  "power": "USB-C + Battery Backup"
}
```

### Backend Technologies

#### Server Runtime

```json
{
  "runtime": "Node.js 18+",
  "framework": "Express.js 4.x",
  "language": "TypeScript",
  "orm": "Drizzle ORM",
  "validation": "Zod",
  "documentation": "OpenAPI 3.0"
}
```

#### Database Layer

```json
{
  "database": "PostgreSQL 13+",
  "orm": "Drizzle ORM",
  "migrations": "Drizzle Kit",
  "connection": "pg (node-postgres)",
  "caching": "Redis 6+"
}
```

#### Real-time Communication

```json
{
  "protocol": "WebSocket",
  "library": "ws",
  "message_format": "JSON",
  "heartbeat": "30 second intervals",
  "reconnection": "Exponential backoff"
}
```

### DevOps & Deployment

#### Development Tools

```json
{
  "version_control": "Git",
  "ci_cd": "GitHub Actions",
  "containerization": "Docker",
  "orchestration": "Docker Compose",
  "monitoring": "Winston + custom metrics",
  "testing": "Jest + Supertest + Cypress"
}
```

#### Production Deployment

```json
{
  "container_runtime": "Docker",
  "reverse_proxy": "Nginx",
  "ssl_termination": "Let's Encrypt",
  "load_balancer": "Nginx (upstream)",
  "monitoring": "Prometheus + Grafana",
  "logging": "ELK Stack"
}
```

---

## Database Design

### Schema Overview

The database schema is designed with relational integrity and performance optimization:

#### Core Entities

```sql
-- Users (Faculty & Admin)
users {
  id: serial PRIMARY KEY,
  email: varchar UNIQUE NOT NULL,
  password: text NOT NULL,
  name: varchar NOT NULL,
  role: varchar NOT NULL, -- admin, faculty
  facultyId: varchar,
  department: varchar,
  isActive: boolean DEFAULT true
}

-- Students
students {
  id: serial PRIMARY KEY,
  studentId: varchar UNIQUE NOT NULL,
  name: varchar NOT NULL,
  email: varchar,
  year: integer,
  section: varchar,
  rfidUid: varchar UNIQUE,
  parentEmail: varchar NOT NULL,
  isActive: boolean DEFAULT true
}

-- Academic Structure
subjects {
  id: serial PRIMARY KEY,
  code: varchar UNIQUE NOT NULL,
  name: varchar NOT NULL,
  description: text
}

classrooms {
  id: serial PRIMARY KEY,
  name: varchar NOT NULL,
  location: varchar NOT NULL,
  type: varchar DEFAULT 'lecture',
  capacity: integer
}

-- Scheduling
schedules {
  id: serial PRIMARY KEY,
  subjectId: integer REFERENCES subjects(id),
  classroomId: integer REFERENCES classrooms(id),
  facultyId: integer REFERENCES users(id),
  dayOfWeek: integer NOT NULL, -- 0-6
  startTime: varchar NOT NULL,
  endTime: varchar NOT NULL,
  semester: varchar NOT NULL,
  academicYear: varchar NOT NULL
}

classSessions {
  id: serial PRIMARY KEY,
  scheduleId: integer REFERENCES schedules(id),
  date: timestamp NOT NULL,
  status: varchar DEFAULT 'scheduled'
}

-- Attendance Tracking
attendanceRecords {
  id: serial PRIMARY KEY,
  studentId: integer REFERENCES students(id),
  classSessionId: integer REFERENCES classSessions(id),
  entryTime: timestamp,
  exitTime: timestamp,
  status: varchar, -- present, late, absent
  rfidDetected: boolean DEFAULT false,
  sensorDetected: boolean DEFAULT false,
  isValid: boolean DEFAULT false,
  discrepancyFlag: boolean DEFAULT false,
  notes: text
}

-- Lab Management
computers {
  id: serial PRIMARY KEY,
  classroomId: integer REFERENCES classrooms(id),
  name: varchar NOT NULL,
  ipAddress: varchar,
  macAddress: varchar,
  status: varchar DEFAULT 'available'
}

computerAssignments {
  id: serial PRIMARY KEY,
  computerId: integer REFERENCES computers(id),
  studentId: integer REFERENCES students(id),
  classSessionId: integer REFERENCES classSessions(id),
  loginTime: timestamp,
  logoutTime: timestamp,
  status: varchar DEFAULT 'assigned'
}

-- IoT Integration
iotDevices {
  id: serial PRIMARY KEY,
  deviceId: varchar UNIQUE NOT NULL,
  classroomId: integer REFERENCES classrooms(id),
  deviceType: varchar DEFAULT 'esp32_s3',
  status: varchar DEFAULT 'offline',
  lastSeen: timestamp,
  config: jsonb
}
```

### Database Relationships

#### Entity Relationships

```
users (1) ──── (many) schedules
users (1) ──── (many) computerMaintenance
users (1) ──── (many) userSessions

students (1) ──── (many) attendanceRecords
students (1) ──── (many) computerAssignments
students (1) ──── (many) enrollments

subjects (1) ──── (many) schedules
subjects (1) ──── (many) enrollments

classrooms (1) ──── (many) schedules
classrooms (1) ──── (many) computers
classrooms (1) ──── (many) iotDevices

schedules (1) ──── (many) classSessions

classSessions (1) ──── (many) attendanceRecords
classSessions (1) ──── (many) computerAssignments

computers (1) ──── (many) computerAssignments
computers (1) ──── (many) computerMaintenance
```

### Indexing Strategy

#### Performance Indexes

```sql
-- Attendance lookup optimization
CREATE INDEX idx_attendance_student_session ON attendance_records(studentId, classSessionId);
CREATE INDEX idx_attendance_session_date ON attendance_records(classSessionId, createdAt);

-- Schedule optimization
CREATE INDEX idx_schedules_faculty_day ON schedules(facultyId, dayOfWeek);
CREATE INDEX idx_schedules_classroom_time ON schedules(classroomId, dayOfWeek, startTime);

-- Student search optimization
CREATE INDEX idx_students_year_section ON students(year, section);
CREATE INDEX idx_students_rfid ON students(rfidUid) WHERE rfidUid IS NOT NULL;

-- Session management
CREATE INDEX idx_class_sessions_schedule_date ON class_sessions(scheduleId, date);
CREATE INDEX idx_class_sessions_status_date ON class_sessions(status, date);

-- Computer assignments
CREATE INDEX idx_computer_assignments_session ON computer_assignments(classSessionId, status);
CREATE INDEX idx_computer_assignments_student ON computer_assignments(studentId, assignedAt);
```

### Data Partitioning

#### Time-based Partitioning

```sql
-- Attendance records partitioned by month
CREATE TABLE attendance_records_y2025m01 PARTITION OF attendance_records
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Class sessions partitioned by academic year
CREATE TABLE class_sessions_2025 PARTITION OF class_sessions
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

---

## API Design

### RESTful API Principles

#### Resource Naming

- **Users**: `/api/users`
- **Students**: `/api/students`
- **Schedules**: `/api/schedules`
- **Attendance**: `/api/attendance`
- **Computers**: `/api/computers`
- **IoT Devices**: `/api/iot-devices`

#### HTTP Methods

- **GET**: Retrieve resources
- **POST**: Create new resources
- **PUT**: Update existing resources
- **DELETE**: Remove resources

#### Response Format

```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 150
  },
  "timestamp": "2025-11-27T17:45:37.900Z"
}
```

### Authentication & Authorization

#### JWT Authentication

```javascript
// Client sends Authorization header
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Server validates and extracts user info
const payload = {
  userId: 123,
  email: "user@clirdec.edu",
  role: "faculty",
  iat: 1638123456,
  exp: 1638213456
}
```

#### Role-based Access Control

```javascript
const permissions = {
  admin: ["read", "write", "delete", "manage_users"],
  faculty: ["read", "write", "view_reports"],
  student: ["read", "view_own_data"],
};
```

### Error Handling

#### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data provided",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    },
    "requestId": "req_1234567890_abc123def",
    "timestamp": "2025-11-27T17:45:37.900Z"
  }
}
```

#### HTTP Status Codes

- **200**: Success
- **201**: Created
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not Found
- **409**: Conflict
- **422**: Unprocessable Entity
- **500**: Internal Server Error

---

## Real-time Communication

### WebSocket Architecture

#### Connection Management

```javascript
// Client connection
const ws = new WebSocket("wss://api.clirdec.edu");

// Authentication
ws.send(
  JSON.stringify({
    type: "auth",
    token: "jwt_token_here",
  })
);

// Message handling
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleMessage(message);
};
```

#### Message Types

##### RFID Events

```json
{
  "type": "rfidScan",
  "deviceId": "ESP32_001",
  "rfidUid": "ABC123DEF456",
  "timestamp": "2025-11-27T08:15:00.000Z",
  "location": "CLIRDEC-101"
}
```

##### Sensor Events

```json
{
  "type": "sensorTrigger",
  "deviceId": "ESP32_001",
  "sensorType": "entry",
  "distance": 45,
  "timestamp": "2025-11-27T08:15:00.000Z"
}
```

##### Attendance Events

```json
{
  "type": "attendanceRecord",
  "studentId": 123,
  "studentName": "Juan Dela Cruz",
  "classSessionId": 456,
  "status": "present",
  "timestamp": "2025-11-27T08:15:00.000Z",
  "isValid": true
}
```

### MQTT Integration

#### IoT Device Communication

```javascript
// Device publishes sensor data
mqttClient.publish(
  "clirdec/sensors/ESP32_001/entry",
  JSON.stringify({
    distance: 45,
    timestamp: Date.now(),
    battery: 85,
  })
);

// Server subscribes to device topics
mqttClient.subscribe("clirdec/sensors/+/+");
mqttClient.subscribe("clirdec/rfid/+/scan");
```

#### Topic Structure

```
clirdec/
├── sensors/{deviceId}/{sensorType}
├── rfid/{deviceId}/scan
├── devices/{deviceId}/status
└── commands/{deviceId}/config
```

---

## Security Architecture

### Authentication Layer

#### Multi-factor Authentication

```javascript
const authFactors = {
  knowledge: "password",
  possession: "sms_code",
  inherence: "biometric",
  location: "geofencing",
};
```

#### Session Management

```javascript
const sessionConfig = {
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  httpOnly: true,
  secure: true,
  sameSite: "strict",
};
```

### Authorization Layer

#### Permission Matrix

```javascript
const permissions = {
  admin: {
    users: ["create", "read", "update", "delete"],
    students: ["create", "read", "update", "delete"],
    attendance: ["create", "read", "update", "delete", "excuse"],
    reports: ["generate", "export", "schedule"],
  },
  faculty: {
    students: ["read"],
    attendance: ["read", "update", "excuse"],
    reports: ["generate", "view"],
  },
  student: {
    attendance: ["read"],
    profile: ["read", "update"],
  },
};
```

### Data Protection

#### Encryption at Rest

```javascript
// Sensitive data encryption
const encryptedFields = ["password", "rfidUid", "parentEmail", "sessionTokens"];

const encryption = {
  algorithm: "AES-256-GCM",
  keyRotation: "90 days",
  backupEncryption: true,
};
```

#### Network Security

```nginx
# SSL/TLS Configuration
server {
  listen 443 ssl http2;
  ssl_certificate /etc/ssl/certs/clirdec.crt;
  ssl_certificate_key /etc/ssl/private/clirdec.key;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
}
```

---

## Deployment Architecture

### Container Orchestration

#### Docker Compose Setup

```yaml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/clirdec
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=clirdec
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Production Deployment

#### Load Balancing

```nginx
upstream app_backend {
  server app1:3000;
  server app2:3000;
  server app3:3000;
}

server {
  listen 80;
  server_name api.clirdec.edu;

  location / {
    proxy_pass http://app_backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

#### Monitoring Stack

```yaml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana

  loki:
    image: grafana/loki
    volumes:
      - loki_data:/loki
```

---

## Performance Considerations

### Database Optimization

#### Query Optimization

```sql
-- Efficient attendance queries
SELECT
  s.name as student_name,
  sub.name as subject_name,
  ar.entry_time,
  ar.status
FROM attendance_records ar
JOIN students s ON ar.student_id = s.id
JOIN class_sessions cs ON ar.class_session_id = cs.id
JOIN schedules sch ON cs.schedule_id = sch.id
JOIN subjects sub ON sch.subject_id = sub.id
WHERE cs.date >= $1 AND cs.date <= $2
ORDER BY ar.entry_time DESC
LIMIT $3 OFFSET $4;
```

#### Connection Pooling

```javascript
const poolConfig = {
  min: 2,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};
```

### Caching Strategy

#### Multi-level Caching

```javascript
const cacheLayers = {
  l1: "memory", // Fast in-memory cache
  l2: "redis", // Distributed cache
  l3: "database", // Persistent storage
  ttl: {
    dashboard: 60, // 1 minute
    userData: 300, // 5 minutes
    schedules: 600, // 10 minutes
    analytics: 1800, // 30 minutes
  },
};
```

### CDN Integration

#### Static Asset Delivery

```javascript
const cdnConfig = {
  provider: "CloudFlare",
  regions: ["asia-pacific", "north-america"],
  caching: {
    static: "1 year",
    dynamic: "5 minutes",
    api: "no-cache",
  },
};
```

---

## Scalability Design

### Horizontal Scaling

#### Application Scaling

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: presence-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: presence-api
  template:
    metadata:
      labels:
        app: presence-api
    spec:
      containers:
        - name: api
          image: clirdec/presence:latest
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

#### Database Scaling

```sql
-- Read replicas for analytics
CREATE PUBLICATION presence_pub FOR ALL TABLES;
CREATE SUBSCRIPTION presence_sub
  CONNECTION 'host=primary.db port=5432 user=replica dbname=presence'
  PUBLICATION presence_pub;
```

### Microservices Architecture

#### Service Decomposition

```
presence-api/
├── auth-service/          # Authentication & authorization
├── attendance-service/    # Core attendance processing
├── schedule-service/      # Class scheduling
├── analytics-service/     # Reporting & analytics
├── iot-service/          # IoT device management
├── notification-service/  # Email & SMS notifications
└── user-service/         # User management
```

#### API Gateway

```javascript
const routes = {
  "/auth/*": "auth-service:3001",
  "/attendance/*": "attendance-service:3002",
  "/schedules/*": "schedule-service:3003",
  "/analytics/*": "analytics-service:3004",
  "/iot/*": "iot-service:3005",
  "/notifications/*": "notification-service:3006",
  "/users/*": "user-service:3007",
};
```

### Performance Monitoring

#### Key Metrics

```javascript
const performanceMetrics = {
  responseTime: {
    p50: "< 200ms",
    p95: "< 500ms",
    p99: "< 1000ms",
  },
  throughput: {
    requestsPerSecond: "> 1000",
    concurrentUsers: "> 10000",
  },
  availability: {
    uptime: "> 99.9%",
    errorRate: "< 0.1%",
  },
};
```

#### Alerting Rules

```yaml
groups:
  - name: presence_alerts
    rules:
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
```

---

## Conclusion

The CLIRDEC:PRESENCE system architecture is designed for scalability, reliability, and maintainability. The modular design allows for independent scaling of components, comprehensive monitoring ensures system health, and the security-first approach protects sensitive student data.

The architecture supports the system's mission to provide accurate, real-time attendance tracking while maintaining high performance and availability for CLIRDEC's BSIT program.

**Last Updated**: November 27, 2025
**Version**: 1.0.0
