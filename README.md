# CLIRDEC:PRESENCE

**Proximity and RFID-Enabled Smart Entry for Classroom Engagement**

A comprehensive attendance monitoring system designed for Central Luzon State University, featuring real-time tracking, IoT integration, and automated notifications.

## 🎯 Features

### Core Functionality

- ✅ **Real-time Attendance Tracking** - RFID + proximity sensor dual validation
- ✅ **Ghost Attendance Prevention** - Physical presence verification (7-second validation window)
- ✅ **ESP32 S3 Integration** - HC-SR04 ultrasonic sensors + RC522 RFID reader
- ✅ **Automated Notifications** - Parent alerts via Brevo email service
- ✅ **Multi-faculty Support** - Role-based access control (Admin/Faculty)
- ✅ **Laboratory Management** - Computer assignment and usage tracking
- ✅ **Comprehensive Reporting** - PDF/CSV export with timestamps

### Technical Features

- ✅ **WebSocket Communication** - Real-time updates (web clients + IoT devices)
- ✅ **Automatic Schedule Population** - Semester-based class session generation
- ✅ **Discrepancy Detection** - Flags ghost taps and sensor-only detections
- ✅ **Production-Ready** - No demo data, clean slate for actual use
- ✅ **Mobile Responsive** - 100% functional on all device sizes
- ✅ **Memory Optimized** - Emergency cleanup and monitoring

## 🏗️ Tech Stack

### Frontend

- React 18 - Modern UI library
- TypeScript - Type-safe development
- Vite - Lightning-fast build tool
- Tailwind CSS - Utility-first styling
- Shadcn/ui - Beautiful component library
- TanStack Query - Powerful data fetching
- Wouter - Lightweight routing

### Backend

- Node.js + Express - Server framework
- TypeScript - Type-safe backend
- PostgreSQL - Relational database
- Drizzle ORM - Type-safe database queries
- WebSocket (ws) - Real-time communication
- Brevo - Transactional email service

### DevOps

- Railway - Cloud deployment platform
- Drizzle Kit - Database migrations
- ESBuild - Fast bundling
- VS Code - Optimized development environment

## 📁 Project Structure

```
clirdec-presence/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities & helpers
│   │   └── hooks/         # Custom React hooks
│   └── public/            # Static assets
├── server/                # Express backend
│   ├── routes.ts          # API route definitions
│   ├── storage.ts         # Database abstraction layer
│   ├── services/          # Business logic
│   │   ├── attendanceMonitor.ts
│   │   ├── emailService.ts
│   │   └── iotDeviceManager.ts
│   └── utils/             # Server utilities
├── shared/                # Shared code
│   └── schema.ts          # Database schema & types
├── .vscode/               # VS Code configuration
├── railway.json           # Railway deployment config
├── .env.example           # Environment variables template
└── ESP32_S3_DUAL_SENSOR_ATTENDANCE.ino  # IoT firmware
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Brevo account for email

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/presence.git
   cd clirdec-presence
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment setup**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database setup**

   ```bash
   npm run db:push
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 🔧 Development Commands

```bash
# Development
npm run dev          # Start dev server with hot reload
npm run build        # Build for production
npm start            # Run production build

# Database
npm run db:push      # Push schema changes to database

# Type Checking
npm run check        # TypeScript type check
```

## 🚂 Railway Deployment

### Automated Deployment (Recommended)

1. Push code to GitHub
2. Create Railway project from repo
3. Add PostgreSQL database
4. Set environment variables
5. Deploy! 🎉

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete guide.

## 📊 Database Schema

### Core Entities

- **Users/Professors** - Faculty and admin accounts
- **Students** - Student records with RFID UIDs
- **Classrooms** - Lab rooms and facilities
- **Subjects** - Course information
- **Schedules** - Recurring class schedules
- **Class Sessions** - Auto-generated from schedules
- **Attendance Records** - Entry/exit logs with validation
- **Computers** - Lab computer tracking

### Key Features

- Automatic schedule population (semester-based)
- Ghost attendance flagging
- Dual validation (RFID + proximity sensor)
- Multi-faculty data isolation

## 🔌 IoT Device Integration

### ESP32 S3 Hardware

- **RFID Reader**: RC522 (3.3V - CRITICAL!)
- **Entry Sensor**: HC-SR04 ultrasonic (GPIO 12/13, 5V)
- **Exit Sensor**: HC-SR04 ultrasonic (GPIO 25/26, 5V)
- **Connectivity**: WiFi WebSocket (/iot endpoint)

### Setup Modes

1. **USB Registration Mode** - Type RFID UIDs into web forms
2. **WiFi Attendance Mode** - Real-time monitoring with motion detection

See `ESP32_S3_DUAL_SENSOR_ATTENDANCE.ino` for firmware.

## 🔐 Security

- ✅ Session-based authentication
- ✅ Environment variable protection
- ✅ SQL injection prevention (Drizzle ORM)
- ✅ HTTPS/WSS on Railway
- ✅ Role-based access control
- ✅ Secure secret management

## 📈 System Features

### For Administrators

- User management (create/delete faculty)
- System-wide reports and analytics
- IoT device monitoring
- Email configuration
- System health dashboard

### For Faculty

- Student management (isolated to their classes)
- Attendance monitoring and tracking
- Computer assignment
- Class schedule management
- Reports and exports (PDF/CSV)
- Parent notification system

### For Students (via RFID)

- Automatic attendance logging
- Entry/exit tracking
- Computer assignment
- Ghost attendance prevention

## 🧪 Testing

### Manual Testing Checklist

- [ ] Login/logout flow
- [ ] Student CRUD operations
- [ ] RFID attendance logging
- [ ] Email notifications
- [ ] Computer assignments
- [ ] Report generation
- [ ] Mobile responsiveness
- [ ] WebSocket connections
- [ ] Ghost attendance detection

## 🐛 Troubleshooting

### Common Issues

#### Build Errors

```bash
rm -rf node_modules dist
npm install
npm run build
```

#### Database Connection

```bash
# Verify DATABASE_URL in .env
npm run db:push
```

#### Email Not Sending

- Check Brevo API key validity
- Verify FROM_EMAIL is verified in Brevo
- Check email queue via API

#### WebSocket Issues

- Ensure port 5023 is available
- Check WebSocket endpoint: /ws (web), /iot (devices)
- Verify Railway supports WebSocket (it does!)

## 📚 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide
- **[RAILWAY_SETUP.md](RAILWAY_SETUP.md)** - Quick Railway setup
- **[VSCODE_SETUP.md](VSCODE_SETUP.md)** - VS Code configuration
- **[QUICK_START_ESP32_S3.md](QUICK_START_ESP32_S3.md)** - ESP32 hardware setup

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Code Standards

- TypeScript strict mode
- Prettier formatting (auto on save)
- ESLint compliance
- Meaningful commit messages

## 📝 License

This project is developed for Central Luzon State University - Information Technology Department.

## 👥 Authors

**Development Team** - CLSU IT Department
**Contact** - support@clsu.edu.ph

## 🙏 Acknowledgments

- Central Luzon State University
- Information Technology Department
- Faculty and staff for requirements and testing
- Open source community for amazing tools

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
