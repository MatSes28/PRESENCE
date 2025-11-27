# CLIRDEC:PRESENCE API Documentation

## Overview

This directory contains comprehensive API documentation for the CLIRDEC:PRESENCE attendance management system.

## Files

- [`openapi.yaml`](./openapi.yaml) - Complete OpenAPI 3.0.3 specification
- [`postman_collection.json`](./postman_collection.json) - Postman collection for API testing
- [`api-examples.md`](./api-examples.md) - Practical API usage examples

## Quick Start

### Authentication

All API endpoints require JWT authentication. Obtain a token by logging in:

```bash
curl -X POST https://api.clirdec.edu/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@clirdec.edu",
    "password": "your_password"
  }'
```

Use the returned token in subsequent requests:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://api.clirdec.edu/dashboard/stats
```

### Base URLs

- **Production**: `https://api.clirdec.edu`
- **Staging**: `https://api-staging.clirdec.edu`
- **Development**: `http://localhost:3000`

## Key Endpoints

### Dashboard & Analytics

- `GET /dashboard/stats` - Real-time dashboard statistics
- `GET /dashboard/analytics` - Attendance trends and analytics

### Attendance Management

- `GET /attendance` - Retrieve attendance records
- `POST /attendance` - Manual attendance entry
- `POST /attendance/simulate-rfid` - RFID simulation (testing)
- `POST /attendance/simulate-sensor` - Sensor simulation (testing)

### Schedule Management

- `GET /schedules` - List class schedules
- `POST /schedules` - Create new schedule
- `PUT /schedules/{id}` - Update schedule
- `DELETE /schedules/{id}` - Delete schedule

### Student Management

- `GET /students` - List students
- `POST /students` - Create student record

### Computer Lab Management

- `GET /computers` - List computers
- `POST /computers` - Add computers to classroom

### IoT Device Management

- `GET /iot-devices` - List IoT devices
- `POST /iot-devices` - Register new device

## Rate Limiting

- **General endpoints**: 1000 requests/hour per user
- **Real-time endpoints**: 100 requests/minute per user
- **Administrative endpoints**: 500 requests/hour per admin

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "requestId": "unique-request-id",
    "timestamp": "2025-11-27T17:45:37.900Z"
  }
}
```

## WebSocket Integration

Real-time updates are available via WebSocket:

```javascript
const ws = new WebSocket("wss://api.clirdec.edu");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case "rfidScan":
      console.log("RFID scanned:", data.rfidUid);
      break;
    case "attendanceRecord":
      console.log("Attendance recorded:", data);
      break;
    case "deviceStatus":
      console.log("Device status update:", data);
      break;
  }
};
```

## SDKs & Libraries

- **JavaScript/TypeScript**: Official client library available
- **Python**: Community-maintained library
- **Mobile SDKs**: iOS and Android SDKs available

## Support

- **Documentation**: [docs.clirdec.edu](https://docs.clirdec.edu)
- **API Status**: [status.clirdec.edu](https://status.clirdec.edu)
- **Support**: it@clirdec.edu
- **Community**: [GitHub Discussions](https://github.com/clirdec/presence/discussions)

## Changelog

### Version 1.0.0

- Initial release
- Complete attendance management system
- Real-time RFID and sensor integration
- Comprehensive analytics and reporting
- Multi-platform support (Web, Mobile, API)
