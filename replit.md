# CLIRDEC:PRESENCE

## Overview

CLIRDEC:PRESENCE is a comprehensive attendance monitoring system for Central Luzon State University that combines RFID technology with proximity sensors to prevent ghost attendance. The system provides real-time tracking, IoT device integration, automated parent notifications, and role-based access control for administrators and faculty members.

The application serves BSIT students from the Department of Information Technology (DIT) under the College of Engineering, featuring automated schedule management, laboratory computer tracking, and comprehensive reporting capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type-safe development
- **Build Tool**: Vite for fast development and optimized production builds
- **Styling**: Tailwind CSS with utility-first approach
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state and caching
- **Real-time Updates**: WebSocket client for live attendance events and IoT device communication
- **Component Library**: Custom components with Shadcn/ui patterns

**Design Decisions**:
- Monorepo structure with separate client/server/shared workspaces for code organization
- Authentication state managed through React Context with session persistence
- Role-based UI rendering (admin vs faculty views)
- Notification system with toast-style alerts for user feedback
- Mobile-responsive design for all device sizes

### Backend Architecture
- **Runtime**: Node.js with Express framework
- **Language**: TypeScript for type safety across the stack
- **Database ORM**: Drizzle ORM for type-safe database queries
- **WebSocket**: ws library for real-time bidirectional communication
- **Session Management**: express-session with in-memory store (production should use PostgreSQL session store)
- **Security**: Helmet for security headers, CORS for cross-origin requests, bcryptjs for password hashing

**Design Decisions**:
- RESTful API design with /api prefix for all endpoints
- Role-based middleware (requireAuth, requireAdmin, requireAdminOrFaculty) for authorization
- WebSocket separation between web clients (/ws) and IoT devices (/iot)
- 7-second validation window for RFID + proximity sensor correlation
- Automated class session generation based on semester schedules

### Database Schema
- **Users**: Faculty and admin accounts with role-based access
- **Students**: BSIT students with RFID UIDs and parent contact information
- **Classrooms**: Limited to 4 rooms (lecture/laboratory types in CLIRDEC Building)
- **Subjects**: Course information with unique codes
- **Schedules**: Weekly class timetables with semester/academic year tracking
- **Class Sessions**: Auto-generated attendance sessions based on schedules
- **Attendance Records**: Entry/exit times with RFID and sensor validation flags
- **Computers**: Laboratory computer inventory with status tracking
- **Computer Assignments**: Student-to-computer mapping with session duration
- **IoT Devices**: ESP32 S3 device registration and status monitoring
- **Email Notifications**: Parent notification audit trail
- **Enrollments**: Student-to-subject associations

**Design Decisions**:
- PostgreSQL for relational data integrity
- Discrepancy flags for ghost attendance detection (RFID without proximity or vice versa)
- Automatic timestamps on all records for audit trails
- Parent email made mandatory for notification system
- Soft deletes with isActive flags instead of hard deletes

### Authentication & Authorization
- **Session-based Authentication**: Express sessions with HTTP-only cookies
- **Password Security**: bcryptjs with 12 salt rounds
- **Role Hierarchy**: Admin (full access) > Faculty (limited to assigned classes)
- **Route Protection**: Middleware-based access control on all sensitive endpoints

**Design Decisions**:
- No JWT tokens - traditional session cookies for simplicity
- Password reset functionality removed (not in research paper scope)
- Session validation on every protected route
- Logout clears session server-side

### Real-time Communication
- **Web Clients**: Connect via /ws with userId parameter
- **IoT Devices**: Connect via /iot with deviceId parameter
- **Message Types**: rfidScan, sensorTrigger, attendanceRecord, deviceStatus
- **Heartbeat**: Ping/pong every 30 seconds to detect disconnections

**Design Decisions**:
- Separate WebSocket paths for web vs IoT to isolate concerns
- Message broadcasting to all web clients for live dashboard updates
- Targeted messages to specific IoT devices for configuration
- Automatic reconnection logic on client-side with exponential backoff

### IoT Integration
- **Devices**: ESP32 S3 with RC522 RFID readers and HC-SR04 ultrasonic sensors
- **Protocol**: WebSocket for low-latency bidirectional communication
- **Device Management**: Registration, status monitoring, configuration updates
- **Ghost Detection**: 7-second window to correlate RFID tap with proximity sensor

**Design Decisions**:
- WebSocket over HTTP polling for real-time performance
- Device status tracking with lastHeartbeat timestamps
- Configuration stored in database for remote device management
- Dual validation (RFID + sensor) to prevent ghost attendance

### Email Service
- **Provider**: Brevo (formerly Sendinblue) transactional email API
- **Use Case**: Parent notifications for absences/tardiness
- **Template**: HTML email with student, class, and attendance details
- **Audit Trail**: All sent emails logged in emailNotifications table

**Design Decisions**:
- Optional email service (gracefully degrades if API key missing)
- Asynchronous sending to avoid blocking attendance recording
- Parent email required on student records for notifications
- Notification history for compliance and reporting

### Report Generation
- **Formats**: CSV export for data analysis
- **Types**: Attendance reports with date ranges, subject filters, classroom filters
- **Data**: Student attendance percentages, late counts, absence counts
- **Export**: Server-generated CSV files with download links

**Design Decisions**:
- CSV chosen over PDF for easier data manipulation in Excel
- Server-side generation to handle large datasets
- Role-based filtering (faculty see only their classes)
- Timezone-aware date handling for accurate reporting

## External Dependencies

### Database
- **PostgreSQL**: Primary relational database for all persistent data
- **Connection**: postgres library for connection pooling
- **ORM**: Drizzle ORM for type-safe queries and migrations
- **Credentials**: DATABASE_URL environment variable

### Email Service
- **Brevo API**: Transactional email service for parent notifications
- **SDK**: @getbrevo/brevo npm package
- **Configuration**: BREVO_API_KEY and FROM_EMAIL environment variables
- **Optional**: System functions without email if not configured

### Hosting Platform
- **Railway**: Recommended deployment platform with PostgreSQL plugin
- **Health Checks**: /health endpoint for uptime monitoring
- **Environment**: NODE_ENV=production for optimizations
- **Session Secret**: SESSION_SECRET environment variable for cookie signing

### Third-party Libraries
- **Security**: helmet (HTTP headers), cors (cross-origin), bcryptjs (password hashing)
- **Rate Limiting**: express-rate-limit (100 requests per 15 minutes per IP)
- **WebSocket**: ws library for real-time communication
- **Session Storage**: express-session with connect-pg-simple for PostgreSQL session store

### Development Tools
- **TypeScript**: Type checking across client/server/shared
- **Vite**: Development server with HMR and production bundling
- **ESLint**: Code linting for TypeScript and React
- **Tailwind CSS**: Utility-first CSS with PostCSS processing
- **Concurrently**: Running client and server simultaneously in development