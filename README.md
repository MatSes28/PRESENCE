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
   git clone https://github.com/yourusername/clirdec-presence.git
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
