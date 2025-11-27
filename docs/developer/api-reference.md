# CLIRDEC:PRESENCE API Reference

## Overview

This document provides detailed API reference for the CLIRDEC:PRESENCE attendance management system.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Dashboard APIs](#dashboard-apis)
3. [Attendance APIs](#attendance-apis)
4. [Schedule APIs](#schedule-apis)
5. [Student APIs](#student-apis)
6. [Computer Lab APIs](#computer-lab-apis)
7. [IoT Device APIs](#iot-device-apis)
8. [User Management APIs](#user-management-apis)
9. [Analytics APIs](#analytics-apis)
10. [System APIs](#system-apis)

---

## Authentication

### POST /auth/login

Authenticate user and obtain JWT token.

**Request Body:**

```json
{
  "email": "admin@clirdec.edu",
  "password": "secure_password"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "admin@clirdec.edu",
      "name": "System Administrator",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**

- `400`: Invalid credentials
- `429`: Too many login attempts

### POST /auth/logout

Invalidate user session.

**Response (200):**

```json
{
  "success": true
}
```

---

## Dashboard APIs

### GET /dashboard/stats

Retrieve real-time dashboard statistics.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "todayClasses": 5,
    "presentStudents": 120,
    "absentStudents": 10,
    "attendanceRate": 92.3,
    "totalEvents": 150,
    "activeDevices": 8,
    "systemUptime": "7d 12h 30m",
    "errorRate": 0.5
  }
}
```

### GET /dashboard/analytics

Retrieve attendance analytics and trends.

**Query Parameters:**

- `period` (string): Time period - `7d`, `30d`, `90d` (default: `7d`)

**Response (200):**

```json
{
  "success": true,
  "data": {
    "dailyTrends": [
      {
        "date": "2025-11-27",
        "present": 120,
        "absent": 10,
        "rate": 92.3
      }
    ],
    "hourlyPatterns": [
      {
        "hour": 8,
        "count": 45
      }
    ],
    "subjectPerformance": [
      {
        "subject": "Data Structures",
        "rate": 94.5,
        "total": 150
      }
    ],
    "facultyPerformance": [
      {
        "faculty": "Dr. Maria Santos",
        "rate": 96.2,
        "total": 200
      }
    ],
    "period": "7d"
  }
}
```

---

## Attendance APIs

### GET /attendance

Retrieve attendance records with filtering.

**Query Parameters:**

- `studentId` (integer): Filter by student ID
- `classSessionId` (integer): Filter by session ID
- `date` (string): Filter by date (YYYY-MM-DD)
- `limit` (integer): Records per page (1-100, default: 50)
- `offset` (integer): Records to skip (default: 0)

**Response (200):**

```json
{
  "success": true,
  "records": [
    {
      "record": {
        "id": 1,
        "studentId": 1,
        "classSessionId": 1,
        "entryTime": "2025-11-27T08:15:00.000Z",
        "exitTime": "2025-11-27T09:45:00.000Z",
        "status": "present",
        "rfidDetected": true,
        "sensorDetected": true,
        "isValid": true,
        "discrepancyFlag": false,
        "notes": null
      },
      "student": {
        "id": 1,
        "studentId": "2021001",
        "name": "Juan Dela Cruz",
        "email": "juan.delacruz@clirdec.edu"
      },
      "session": {
        "id": 1,
        "date": "2025-11-27",
        "status": "completed"
      }
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 150
  }
}
```

### POST /attendance

Create manual attendance record (admin only).

**Request Body:**

```json
{
  "studentId": 1,
  "classSessionId": 1,
  "entryTime": "2025-11-27T08:15:00.000Z",
  "exitTime": "2025-11-27T09:45:00.000Z",
  "notes": "Manual entry - student was ill"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Attendance record created successfully",
  "record": {
    "id": 1,
    "studentId": 1,
    "classSessionId": 1,
    "entryTime": "2025-11-27T08:15:00.000Z",
    "exitTime": "2025-11-27T09:45:00.000Z",
    "status": "present",
    "rfidDetected": false,
    "sensorDetected": false,
    "isValid": true,
    "discrepancyFlag": false,
    "notes": "Manual entry - student was ill"
  }
}
```

### POST /attendance/simulate-rfid

Simulate RFID card scan (admin/testing only).

**Request Body:**

```json
{
  "rfidUid": "ABC123DEF456"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "RFID simulation successful",
  "data": {
    "studentId": 1,
    "studentName": "Juan Dela Cruz",
    "isValid": true
  }
}
```

### POST /attendance/simulate-sensor

Simulate entry/exit sensor trigger (admin/testing only).

**Request Body:**

```json
{
  "sensorType": "entry",
  "distance": 50
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Sensor simulation successful",
  "data": {
    "sensorType": "entry",
    "distance": 50,
    "triggered": true
  }
}
```

---

## Schedule APIs

### GET /schedules

Retrieve class schedules with filtering.

**Query Parameters:**

- `facultyId` (integer): Filter by faculty ID
- `subjectId` (integer): Filter by subject ID
- `dayOfWeek` (integer): Filter by day (0-6)
- `semester` (string): Filter by semester
- `academicYear` (string): Filter by academic year

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "subjectId": 1,
      "subjectName": "Data Structures and Algorithms",
      "classroomId": 1,
      "classroomName": "Computer Lab 1",
      "facultyId": 1,
      "facultyName": "Dr. Maria Santos",
      "dayOfWeek": 1,
      "startTime": "08:00",
      "endTime": "09:30",
      "semester": "1st Semester",
      "academicYear": "2025",
      "isActive": true
    }
  ]
}
```

### POST /schedules

Create new class schedule (admin only).

**Request Body:**

```json
{
  "subjectId": 1,
  "classroomId": 1,
  "facultyId": 1,
  "dayOfWeek": 1,
  "startTime": "08:00",
  "endTime": "09:30",
  "semester": "1st Semester",
  "academicYear": "2025",
  "isRecurring": true,
  "recurrencePattern": "weekly",
  "recurrenceEndDate": "2025-12-31",
  "conflictResolutionPriority": 5
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Schedule created successfully",
  "schedule": {
    "id": 1,
    "subjectId": 1,
    "subjectName": "Data Structures and Algorithms",
    "classroomId": 1,
    "classroomName": "Computer Lab 1",
    "facultyId": 1,
    "facultyName": "Dr. Maria Santos",
    "dayOfWeek": 1,
    "startTime": "08:00",
    "endTime": "09:30",
    "semester": "1st Semester",
    "academicYear": "2025",
    "isActive": true
  }
}
```

### PUT /schedules/{id}

Update existing class schedule (admin only).

**Path Parameters:**

- `id` (integer): Schedule ID

**Request Body:** Same as POST /schedules

**Response (200):**

```json
{
  "success": true,
  "message": "Schedule updated successfully",
  "schedule": { ... }
}
```

### DELETE /schedules/{id}

Delete class schedule (admin only).

**Path Parameters:**

- `id` (integer): Schedule ID

**Response (200):**

```json
{
  "success": true,
  "message": "Schedule deleted successfully"
}
```

---

## Student APIs

### GET /students

Retrieve student records with filtering.

**Query Parameters:**

- `year` (integer): Filter by year level (1-4)
- `section` (string): Filter by section
- `isActive` (boolean): Filter by active status
- `limit` (integer): Records per page (1-100, default: 50)
- `offset` (integer): Records to skip (default: 0)

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "studentId": "2021001",
      "name": "Juan Dela Cruz",
      "email": "juan.delacruz@clirdec.edu",
      "year": 2,
      "section": "A",
      "program": "BSIT",
      "department": "DIT",
      "college": "College of Engineering",
      "rfidUid": "ABC123DEF456",
      "parentEmail": "parent@email.com",
      "parentName": "Maria Dela Cruz",
      "isActive": true
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 500
  }
}
```

### POST /students

Create new student record (admin only).

**Request Body:**

```json
{
  "studentId": "2021001",
  "name": "Juan Dela Cruz",
  "email": "juan.delacruz@clirdec.edu",
  "year": 2,
  "section": "A",
  "rfidUid": "ABC123DEF456",
  "parentEmail": "parent@email.com",
  "parentName": "Maria Dela Cruz"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Student created successfully",
  "student": { ... }
}
```

---

## Computer Lab APIs

### GET /computers

Retrieve computer records with filtering.

**Query Parameters:**

- `classroomId` (integer): Filter by classroom ID
- `status` (string): Filter by status (available/in_use/maintenance)
- `isActive` (boolean): Filter by active status

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "classroomId": 1,
      "name": "PC-001",
      "ipAddress": "192.168.1.100",
      "macAddress": "00:1B:44:11:3A:B7",
      "status": "available",
      "lastMaintenance": "2025-10-15T09:00:00.000Z",
      "nextMaintenance": "2026-01-15T09:00:00.000Z",
      "maintenanceNotes": "Updated antivirus software",
      "isActive": true
    }
  ]
}
```

### POST /computers

Add computers to classroom (admin only).

**Request Body:**

```json
{
  "classroomId": 1,
  "count": 25,
  "namePrefix": "PC-",
  "startNumber": 1
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "25 computers added successfully",
  "computers": [ ... ]
}
```

---

## IoT Device APIs

### GET /iot-devices

Retrieve IoT device records with filtering.

**Query Parameters:**

- `classroomId` (integer): Filter by classroom ID
- `deviceType` (string): Filter by device type
- `status` (string): Filter by status (online/offline/maintenance)
- `isActive` (boolean): Filter by active status

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "deviceId": "ESP32_S3_001",
      "classroomId": 1,
      "deviceType": "esp32_s3",
      "status": "online",
      "lastSeen": "2025-11-27T17:45:37.900Z",
      "config": {
        "rfid_timeout": 5000,
        "sensor_sensitivity": 0.8
      },
      "isActive": true
    }
  ]
}
```

### POST /iot-devices

Register new IoT device (admin only).

**Request Body:**

```json
{
  "deviceId": "ESP32_S3_001",
  "classroomId": 1,
  "deviceType": "esp32_s3",
  "config": {
    "rfid_timeout": 5000,
    "sensor_sensitivity": 0.8,
    "wifi_ssid": "CLIRDEC-GUEST",
    "wifi_password": "secure_password"
  }
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "IoT device registered successfully",
  "device": { ... }
}
```

---

## User Management APIs

### GET /users

Retrieve user records (admin only).

**Query Parameters:**

- `role` (string): Filter by role (admin/faculty)
- `isActive` (boolean): Filter by active status

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "faculty@clirdec.edu",
      "name": "Dr. Maria Santos",
      "role": "faculty",
      "facultyId": "FAC001",
      "department": "Computer Science",
      "gender": "female",
      "isActive": true
    }
  ]
}
```

### POST /users

Create new user account (admin only).

**Request Body:**

```json
{
  "email": "faculty@clirdec.edu",
  "password": "temporary_password",
  "name": "Dr. Maria Santos",
  "role": "faculty",
  "facultyId": "FAC001",
  "department": "Computer Science",
  "gender": "female"
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "User created successfully",
  "user": { ... }
}
```

---

## Analytics APIs

### GET /analytics/attendance

Retrieve detailed attendance analytics.

**Query Parameters:**

- `startDate` (string): Start date (YYYY-MM-DD)
- `endDate` (string): End date (YYYY-MM-DD)
- `studentId` (integer): Filter by student
- `subjectId` (integer): Filter by subject
- `facultyId` (integer): Filter by faculty

**Response (200):**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRecords": 1500,
      "presentCount": 1380,
      "absentCount": 120,
      "attendanceRate": 92.0,
      "averageEntryTime": "08:15",
      "averageDuration": "1.5 hours"
    },
    "trends": [ ... ],
    "breakdown": {
      "bySubject": [ ... ],
      "byFaculty": [ ... ],
      "byDayOfWeek": [ ... ],
      "byTimeOfDay": [ ... ]
    },
    "insights": {
      "topPerformers": [ ... ],
      "atRiskStudents": [ ... ],
      "patterns": [ ... ]
    }
  }
}
```

### GET /analytics/system

Retrieve system performance analytics.

**Response (200):**

```json
{
  "success": true,
  "data": {
    "uptime": "99.9%",
    "responseTime": {
      "average": 245,
      "p95": 500,
      "p99": 1000
    },
    "throughput": {
      "requestsPerMinute": 1200,
      "activeUsers": 150
    },
    "errors": {
      "total": 15,
      "rate": 0.1,
      "byEndpoint": { ... }
    },
    "resources": {
      "cpu": 45.2,
      "memory": 67.8,
      "disk": 23.4
    }
  }
}
```

---

## System APIs

### GET /health

System health check endpoint.

**Response (200):**

```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2025-11-27T17:45:37.900Z",
  "version": "1.0.0",
  "system": {
    "cpu": {
      "usage": 15.5,
      "loadAverage": [1.2, 1.5, 1.8]
    },
    "memory": {
      "usagePercent": 65.2,
      "free": 217680334848,
      "total": 412550602752
    },
    "disk": [
      {
        "usagePercent": 26.0,
        "free": 1877752426496,
        "total": 2538202173440
      }
    ]
  },
  "database": {
    "connections": {
      "active": 5,
      "total": 20
    },
    "status": "healthy"
  },
  "application": {
    "requests": {
      "total": 1500,
      "successful": 1485,
      "failed": 15
    },
    "errors": {
      "total": 3,
      "rate": 0.002
    }
  }
}
```

### GET /metrics

Prometheus-compatible metrics endpoint.

**Response (200):**

```
# HELP presence_active_users Current number of active users
# TYPE presence_active_users gauge
presence_active_users 42

# HELP presence_attendance_records_created_total Total attendance records created
# TYPE presence_attendance_records_created_total counter
presence_attendance_records_created_total 15432

# HELP presence_http_requests_total Total HTTP requests
# TYPE presence_http_requests_total counter
presence_http_requests_total{method="GET",endpoint="/dashboard/stats",status="200"} 1234
```

### POST /system/maintenance

Trigger system maintenance tasks (admin only).

**Request Body:**

```json
{
  "task": "cleanup_old_records",
  "parameters": {
    "olderThanDays": 365,
    "dryRun": true
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Maintenance task completed",
  "results": {
    "recordsDeleted": 1250,
    "spaceFreed": "45MB"
  }
}
```

---

## WebSocket Events

### Client Connection

```javascript
const ws = new WebSocket("wss://api.clirdec.edu");

// Authentication
ws.send(
  JSON.stringify({
    type: "auth",
    token: "jwt_token_here",
  })
);
```

### Real-time Events

#### RFID Scan Events

```json
{
  "type": "rfidScan",
  "deviceId": "ESP32_001",
  "rfidUid": "ABC123DEF456",
  "timestamp": "2025-11-27T08:15:00.000Z",
  "location": "CLIRDEC-101"
}
```

#### Sensor Events

```json
{
  "type": "sensorTrigger",
  "deviceId": "ESP32_001",
  "sensorType": "entry",
  "distance": 45,
  "timestamp": "2025-11-27T08:15:00.000Z"
}
```

#### Attendance Events

```json
{
  "type": "attendanceRecord",
  "studentId": 1,
  "studentName": "Juan Dela Cruz",
  "classSessionId": 1,
  "status": "present",
  "timestamp": "2025-11-27T08:15:00.000Z",
  "isValid": true
}
```

#### Device Status Events

```json
{
  "type": "deviceStatus",
  "devices": [
    {
      "deviceId": "ESP32_001",
      "status": "online",
      "lastSeen": "2025-11-27T17:45:37.900Z"
    }
  ]
}
```

---

## Error Codes

| Code                   | Description                     | HTTP Status |
| ---------------------- | ------------------------------- | ----------- |
| `VALIDATION_ERROR`     | Invalid input data              | 400         |
| `AUTHENTICATION_ERROR` | Invalid credentials             | 401         |
| `AUTHORIZATION_ERROR`  | Insufficient permissions        | 403         |
| `NOT_FOUND`            | Resource not found              | 404         |
| `CONFLICT`             | Resource conflict               | 409         |
| `RATE_LIMIT_EXCEEDED`  | Too many requests               | 429         |
| `INTERNAL_ERROR`       | Server error                    | 500         |
| `SERVICE_UNAVAILABLE`  | Service temporarily unavailable | 503         |

---

## Rate Limits

| Endpoint Pattern     | Limit         | Window     |
| -------------------- | ------------- | ---------- |
| `/auth/*`            | 10 requests   | 15 minutes |
| `/dashboard/*`       | 1000 requests | 1 hour     |
| `/attendance` (GET)  | 1000 requests | 1 hour     |
| `/attendance` (POST) | 100 requests  | 1 hour     |
| `/students`          | 500 requests  | 1 hour     |
| `/schedules`         | 500 requests  | 1 hour     |
| Real-time WebSocket  | 100 messages  | 1 minute   |

---

## SDKs and Libraries

### JavaScript/TypeScript SDK

```javascript
import { PresenceAPI } from "@clirdec/presence-sdk";

const client = new PresenceAPI({
  baseURL: "https://api.clirdec.edu",
  token: "your_jwt_token",
});

// Get dashboard stats
const stats = await client.dashboard.getStats();

// Create attendance record
const record = await client.attendance.create({
  studentId: 1,
  classSessionId: 1,
});
```

### Python SDK

```python
from clirdec_presence import PresenceAPI

client = PresenceAPI(
    base_url='https://api.clirdec.edu',
    token='your_jwt_token'
)

# Get attendance records
records = client.attendance.list(student_id=1)

# Create schedule
schedule = client.schedules.create({
    'subjectId': 1,
    'classroomId': 1,
    'facultyId': 1,
    'dayOfWeek': 1,
    'startTime': '08:00',
    'endTime': '09:30'
})
```

---

## Changelog

### Version 1.0.0

- Complete attendance management system
- Real-time RFID and sensor integration
- Comprehensive analytics and reporting
- Multi-platform support (Web, Mobile, API)
- IoT device management
- Smart computer lab assignments

---

## Support

- **API Documentation**: [docs.clirdec.edu/api](https://docs.clirdec.edu/api)
- **Developer Portal**: [developers.clirdec.edu](https://developers.clirdec.edu)
- **Community Forums**: [community.clirdec.edu](https://community.clirdec.edu)
- **Support Email**: developers@clirdec.edu

**Last Updated**: November 27, 2025
**API Version**: 1.0.0
