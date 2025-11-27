# CLIRDEC:PRESENCE Administrator Manual

## Welcome to CLIRDEC:PRESENCE

This manual provides comprehensive guidance for administrators managing the CLIRDEC:PRESENCE attendance system for the Bachelor of Science in Information Technology (BSIT) program.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Getting Started](#getting-started)
3. [Dashboard Management](#dashboard-management)
4. [User Management](#user-management)
5. [Student Management](#student-management)
6. [Schedule Management](#schedule-management)
7. [Computer Lab Management](#computer-lab-management)
8. [IoT Device Management](#iot-device-management)
9. [Attendance Monitoring](#attendance-monitoring)
10. [Reports & Analytics](#reports--analytics)
11. [System Settings](#system-settings)
12. [Troubleshooting](#troubleshooting)
13. [Best Practices](#best-practices)

---

## System Overview

### What is CLIRDEC:PRESENCE?

CLIRDEC:PRESENCE is a comprehensive attendance management system designed specifically for CLIRDEC's College of Engineering BSIT program. The system integrates:

- **RFID Technology**: Automated attendance recording via student ID cards
- **IoT Sensors**: Entry/exit validation for accuracy
- **Real-time Monitoring**: Live attendance tracking and alerts
- **Smart Assignment**: AI-powered computer lab seat assignments
- **Multi-platform Access**: Web dashboard, mobile app, and API

### Key Features

- ✅ **Automated Attendance**: RFID card scans and sensor validation
- ✅ **Real-time Alerts**: Instant notifications for absences/lateness
- ✅ **Comprehensive Analytics**: Performance tracking and reporting
- ✅ **Smart Lab Management**: Intelligent computer assignments
- ✅ **Parent Communication**: Automated notifications to guardians
- ✅ **Multi-role Access**: Admin, Faculty, and Student interfaces

---

## Getting Started

### System Requirements

#### Hardware Requirements

- **Server**: Quad-core CPU, 8GB RAM, 100GB SSD
- **Network**: Gigabit Ethernet, WiFi 6 access points
- **IoT Devices**: ESP32-S3 microcontrollers with RFID readers
- **RFID Cards**: ISO 14443A compatible cards

#### Software Requirements

- **Operating System**: Ubuntu 20.04 LTS or CentOS 8+
- **Database**: PostgreSQL 13+
- **Cache**: Redis 6+ (optional, for performance)
- **Web Server**: Nginx or Apache
- **SSL Certificate**: Valid SSL certificate required

### Initial Setup

#### 1. System Installation

```bash
# Clone the repository
git clone https://github.com/clirdec/presence.git
cd presence

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
nano .env  # Configure database, Redis, email settings

# Run database migrations
npm run db:migrate

# Seed initial data
npm run db:seed

# Start the application
npm start
```

#### 2. Database Configuration

```sql
-- Create database
CREATE DATABASE clirdec_presence;

-- Create user
CREATE USER presence_user WITH PASSWORD 'secure_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE clirdec_presence TO presence_user;
```

#### 3. Environment Configuration

```bash
# .env file configuration
NODE_ENV=production
DATABASE_URL=postgresql://presence_user:password@localhost:5432/clirdec_presence
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_super_secure_jwt_secret_here
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_USER=admin@clirdec.edu
EMAIL_PASS=your_app_password
```

#### 4. SSL Configuration

```nginx
# Nginx SSL configuration
server {
    listen 443 ssl http2;
    server_name api.clirdec.edu;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### First Login

1. Navigate to `https://admin.clirdec.edu`
2. Use default admin credentials:
   - **Email**: `admin@clirdec.edu`
   - **Password**: `admin123` (change immediately)
3. Complete security setup wizard
4. Configure system settings

---

## Dashboard Management

### Overview Dashboard

The main dashboard provides real-time system insights:

#### Key Metrics

- **Today's Classes**: Number of active class sessions
- **Present Students**: Students marked present today
- **Absent Students**: Students marked absent today
- **Attendance Rate**: Overall attendance percentage
- **Total Events**: RFID scans and sensor triggers
- **Active Devices**: Online IoT devices
- **System Uptime**: Server uptime statistics
- **Error Rate**: System error percentage

#### Real-time Activity Feed

- Live RFID scan events
- Sensor trigger notifications
- Attendance record updates
- System status changes

### Analytics Dashboard

#### Time Period Selection

- **7 Days**: Weekly attendance trends
- **30 Days**: Monthly performance analysis
- **90 Days**: Quarterly insights

#### Available Charts

- **Daily Attendance Trends**: Present vs absent over time
- **Hourly Patterns**: Peak attendance times
- **Subject Performance**: Attendance by subject
- **Faculty Performance**: Attendance by instructor

### Quick Actions

#### Session Management

- **Start New Session**: Create class sessions for today
- **Activate Sessions**: Enable existing scheduled sessions
- **Monitor Active Sessions**: View current class activities

#### System Actions

- **Add Students**: Bulk student registration
- **View Reports**: Access detailed analytics
- **Send Notifications**: Broadcast system messages

---

## User Management

### User Roles

#### Administrator

- Full system access
- User management
- System configuration
- Advanced reporting

#### Faculty

- Class schedule management
- Student attendance monitoring
- Basic reporting
- Communication tools

#### Student

- Personal attendance viewing
- Schedule access
- Notification preferences

### Creating Users

#### Manual User Creation

1. Navigate to **User Management** → **Add User**
2. Fill required information:
   - **Email**: Valid email address
   - **Name**: Full name
   - **Role**: Admin/Faculty
   - **Department**: For faculty users
3. Set temporary password
4. Assign appropriate permissions

#### Bulk User Import

1. Prepare CSV file with format:

   ```csv
   email,name,role,department,faculty_id
   faculty1@clirdec.edu,"Dr. Maria Santos",faculty,"Computer Science",FAC001
   faculty2@clirdec.edu,"Prof. Juan Reyes",faculty,"Information Technology",FAC002
   ```

2. Go to **User Management** → **Import Users**
3. Upload CSV file
4. Review and confirm import

### User Permissions

#### Admin Permissions

- ✅ Create/edit/delete users
- ✅ Manage system settings
- ✅ Access all reports
- ✅ Configure IoT devices
- ✅ System maintenance

#### Faculty Permissions

- ✅ View assigned classes
- ✅ Monitor attendance
- ✅ Send notifications
- ✅ Access basic reports
- ❌ User management
- ❌ System configuration

### Password Management

#### Password Policies

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

#### Password Reset Process

1. User requests password reset
2. System sends reset email
3. User clicks reset link
4. User sets new password
5. System confirms password change

---

## Student Management

### Student Registration

#### Individual Registration

1. Go to **Students** → **Add Student**
2. Enter student details:
   - **Student ID**: Unique identifier (e.g., 2021001)
   - **Name**: Full legal name
   - **Email**: Student email address
   - **Year**: Academic year (1-4)
   - **Section**: Class section (A, B, C, etc.)
   - **RFID UID**: Card identifier (optional)
   - **Parent Email**: Guardian contact email
   - **Parent Name**: Guardian full name

#### Bulk Student Import

1. Prepare CSV file:

   ```csv
   student_id,name,email,year,section,rfid_uid,parent_email,parent_name
   2021001,"Juan Dela Cruz",juan.delacruz@clirdec.edu,2,A,ABC123DEF456,parent@email.com,"Maria Dela Cruz"
   2021002,"Ana Santos",ana.santos@clirdec.edu,2,A,DEF456GHI789,mother@email.com,"Rosa Santos"
   ```

2. Navigate to **Students** → **Import Students**
3. Upload and validate CSV
4. Review import results

### Student Data Management

#### Editing Student Information

1. Search for student by ID or name
2. Click **Edit** button
3. Update information as needed
4. Save changes

#### RFID Card Assignment

1. Go to student profile
2. Click **Assign RFID Card**
3. Scan or enter RFID UID
4. Confirm assignment

#### Student Status Management

- **Active**: Normal attendance tracking
- **Inactive**: Temporarily disabled
- **Suspended**: Administrative action required

### Parent Communication

#### Automated Notifications

The system automatically sends notifications for:

- **Daily Attendance**: Summary of attendance status
- **Absences**: Immediate notification of absences
- **Lateness**: Alerts for late arrivals
- **System Alerts**: Important announcements

#### Manual Communication

1. Select student(s)
2. Click **Contact Parent**
3. Compose message
4. Send notification

---

## Schedule Management

### Creating Class Schedules

#### Manual Schedule Creation

1. Navigate to **Schedules** → **Add Schedule**
2. Select **Subject** from dropdown
3. Choose **Classroom** location
4. Assign **Faculty** member
5. Set **Day of Week** (Sunday = 0, Monday = 1, etc.)
6. Configure **Start Time** and **End Time**
7. Select **Semester** and **Academic Year**

#### Bulk Schedule Import

1. Prepare CSV file:

   ```csv
   subject_id,classroom_id,faculty_id,day_of_week,start_time,end_time,semester,academic_year
   1,1,1,1,08:00,09:30,1st Semester,2025
   2,2,2,2,09:45,11:15,1st Semester,2025
   ```

2. Go to **Schedules** → **Import Schedules**
3. Upload and process CSV

### Schedule Conflict Detection

The system automatically detects conflicts:

#### Types of Conflicts

- **Room Conflicts**: Same room, overlapping times
- **Faculty Conflicts**: Same faculty, overlapping times
- **Time Conflicts**: Invalid time ranges

#### Conflict Resolution

1. System alerts of conflicts during scheduling
2. Review conflict details
3. Options:
   - **Adjust Times**: Modify schedule times
   - **Change Room**: Assign different classroom
   - **Override**: Force schedule (admin only)

### Recurring Schedules

#### Setting Up Recurring Classes

1. Enable **Recurring Schedule** option
2. Set **Recurrence Pattern**:
   - **Weekly**: Every week on same day
   - **Bi-weekly**: Every two weeks
   - **Monthly**: Monthly on same date
3. Set **End Date** for recurrence
4. Add **Exceptions** for holidays/special dates

### Schedule Maintenance

#### Editing Schedules

1. Find schedule in list
2. Click **Edit** button
3. Modify details
4. Check for conflicts
5. Save changes

#### Deleting Schedules

1. Select schedule
2. Click **Delete** button
3. Confirm deletion
4. System handles related data cleanup

---

## Computer Lab Management

### Lab Configuration

#### Adding Computers to Labs

1. Go to **Lab Computers** → **Add Computers**
2. Select **Classroom** (lab location)
3. Set **Number of Computers** to add
4. Configure **Naming Pattern** (e.g., PC-001, PC-002)
5. Set **Starting Number**
6. Click **Add Computers**

#### Computer Specifications

Each computer record includes:

- **Name**: Unique identifier (PC-001)
- **IP Address**: Network address
- **MAC Address**: Hardware address
- **Status**: Available/In Use/Maintenance
- **Last Maintenance**: Date of last service
- **Next Maintenance**: Scheduled service date

### Smart Assignment System

#### Assignment Methods

##### Performance-Based Assignment

- Assigns high-performing students to optimal positions
- Considers attendance history and academic performance
- Places struggling students in accessible locations

##### Learning Style Assignment

- Matches seating to learning preferences
- Visual learners near displays
- Auditory learners near instructor
- Kinesthetic learners with movement access

##### Conflict-Free Assignment

- Separates students with attendance conflicts
- Reduces distractions and behavioral issues
- Optimizes learning environment

##### Random Assignment

- Simple random distribution
- Equal opportunity seating
- Quick assignment for basic needs

#### Running Smart Assignments

1. Go to **Lab Computers** → **Smart Assignment**
2. Select **Class Session**
3. Choose **Assignment Method**
4. Click **Run Assignment**
5. Review and confirm assignments

### Maintenance Management

#### Scheduling Maintenance

1. Navigate to **Maintenance** → **Schedule Maintenance**
2. Select **Computer** to service
3. Choose **Maintenance Type**:
   - **Preventive**: Regular maintenance
   - **Corrective**: Fix issues
   - **Upgrade**: Hardware/software updates
4. Set **Scheduled Date**
5. Add **Description** and **Notes**

#### Maintenance Workflow

1. **Scheduled**: Maintenance planned
2. **In Progress**: Technician working
3. **Completed**: Maintenance finished
4. **Cancelled**: Maintenance postponed

#### Maintenance Tracking

- **Maintenance History**: Complete service records
- **Cost Tracking**: Maintenance expenses
- **Parts Inventory**: Used components
- **Performance Metrics**: Uptime statistics

---

## IoT Device Management

### Device Registration

#### Adding IoT Devices

1. Go to **IoT Devices** → **Add Device**
2. Enter **Device ID** (ESP32_S3_001)
3. Select **Classroom** location
4. Choose **Device Type** (ESP32-S3)
5. Configure device settings:
   - **RFID Timeout**: Scan timeout (ms)
   - **Sensor Sensitivity**: Detection threshold
   - **Update Interval**: Status reporting frequency

#### Device Configuration

```json
{
  "rfid_timeout": 5000,
  "sensor_sensitivity": 0.8,
  "update_interval": 30000,
  "wifi_ssid": "CLIRDEC-GUEST",
  "wifi_password": "secure_password",
  "mqtt_broker": "mqtt.clirdec.edu",
  "mqtt_port": 8883
}
```

### Device Monitoring

#### Real-time Status

- **Online/Offline**: Connection status
- **Last Seen**: Last communication timestamp
- **Signal Strength**: WiFi signal quality
- **Battery Level**: Power status (if applicable)
- **Error Count**: Communication failures

#### Device Health Dashboard

- **Active Devices**: Currently online
- **Offline Devices**: Disconnected devices
- **Maintenance Required**: Devices needing service
- **Firmware Updates**: Available updates

### Firmware Management

#### Updating Device Firmware

1. Go to device details
2. Check **Current Firmware Version**
3. Upload **New Firmware File**
4. Click **Update Firmware**
5. Monitor update progress

#### Firmware Versions

- **v1.0.0**: Initial release
- **v1.1.0**: Improved RFID detection
- **v1.2.0**: Enhanced sensor accuracy
- **v2.0.0**: MQTT protocol support

---

## Attendance Monitoring

### Live Attendance View

#### Real-time Monitoring

1. Navigate to **Live Attendance** tab
2. View **Real-time Activity Feed**:
   - RFID scan events
   - Sensor triggers
   - Attendance records
   - System notifications

#### Attendance Statistics

- **Total Events**: All system activities
- **Valid Entries**: Successful attendance records
- **Discrepancies**: Potential issues
- **Active Devices**: Online IoT devices

### Manual Attendance Entry

#### Adding Manual Records

1. Go to **Live Attendance** → **Manual Entry**
2. Select **Student** from dropdown
3. Choose **Class Session**
4. Set **Entry Time** (optional)
5. Add **Notes** (optional)
6. Click **Record Attendance**

### RFID Simulation (Testing)

#### Testing RFID Functionality

1. Go to **RFID Scanner Simulation**
2. Enter **RFID Card ID**
3. Click **Simulate RFID Tap**
4. Observe system response

#### Sensor Simulation

1. Click **Simulate Entry Sensor** or **Exit Sensor**
2. Set **Distance** value (50 = normal detection)
3. Monitor attendance recording

### Attendance Corrections

#### Excusing Absences

1. Find absent student record
2. Click **Excuse** button
3. Enter **Reason** for absence
4. Confirm excusal

#### Correcting Records

1. Locate incorrect record
2. Click **Edit** button
3. Update attendance details
4. Save changes

---

## Reports & Analytics

### Available Reports

#### Attendance Reports

- **Daily Attendance**: Today's attendance summary
- **Weekly Reports**: 7-day attendance trends
- **Monthly Reports**: Monthly performance analysis
- **Subject-wise Reports**: Attendance by subject
- **Student Reports**: Individual student history

#### System Reports

- **Device Performance**: IoT device statistics
- **System Health**: Server and database metrics
- **User Activity**: Login and usage patterns
- **Error Logs**: System errors and warnings

### Generating Reports

#### Standard Reports

1. Go to **Reports** section
2. Select **Report Type**
3. Set **Date Range**
4. Choose **Filters** (class, student, subject)
5. Click **Generate Report**

#### Custom Reports

1. Use **Advanced Analytics** tab
2. Configure custom metrics
3. Set time periods
4. Export to PDF/Excel/CSV

### Report Scheduling

#### Automated Reports

1. Go to **Reports** → **Scheduled Reports**
2. Create new schedule:
   - **Report Type**: Daily/Weekly/Monthly
   - **Recipients**: Email addresses
   - **Format**: PDF/Excel
   - **Schedule**: Daily/Weekly/Monthly
3. Save schedule

---

## System Settings

### General Settings

#### System Configuration

- **Institution Name**: CLIRDEC
- **System Name**: CLIRDEC:PRESENCE
- **Timezone**: Asia/Manila
- **Language**: English
- **Date Format**: MM/DD/YYYY

#### Security Settings

- **Session Timeout**: 30 minutes
- **Password Policy**: Complexity requirements
- **Two-Factor Authentication**: Optional/Required
- **Login Attempts**: Maximum failed attempts

### Notification Settings

#### Email Configuration

- **SMTP Server**: smtp.gmail.com
- **SMTP Port**: 587
- **Authentication**: Required
- **From Address**: admin@clirdec.edu

#### Notification Rules

- **Parent Notifications**: Immediate/Daily/Weekly
- **Faculty Alerts**: Real-time/Scheduled
- **System Alerts**: Admin notifications

### Integration Settings

#### External Systems

- **Student Information System**: API endpoints
- **Email Service**: SMTP configuration
- **SMS Service**: Gateway settings
- **Calendar Integration**: Google Calendar/Microsoft Outlook

---

## Troubleshooting

### Common Issues

#### System Performance

**Issue**: Slow response times
**Solutions**:

- Check server resources (CPU, memory)
- Optimize database queries
- Clear cache and restart services
- Scale server resources if needed

**Issue**: Database connection errors
**Solutions**:

- Verify database server status
- Check connection string
- Restart database service
- Check network connectivity

#### IoT Device Issues

**Issue**: Devices not connecting
**Solutions**:

- Check WiFi network
- Verify device configuration
- Update firmware
- Check MQTT broker status

**Issue**: RFID not detecting cards
**Solutions**:

- Clean RFID reader
- Check card validity
- Adjust reader sensitivity
- Test with known working card

#### Attendance Issues

**Issue**: Incorrect attendance records
**Solutions**:

- Verify RFID card assignments
- Check sensor calibration
- Review manual entries
- Audit system logs

### System Logs

#### Accessing Logs

1. Go to **System** → **Logs**
2. Select **Log Type**:
   - **Application Logs**: General system activity
   - **Error Logs**: System errors and warnings
   - **Security Logs**: Authentication and authorization
   - **Audit Logs**: Administrative actions

#### Log Analysis

- **Filter by Date/Time**: Specific time ranges
- **Filter by Level**: ERROR, WARN, INFO, DEBUG
- **Search**: Keywords and patterns
- **Export**: Download log files

### Support Resources

#### Getting Help

1. **Documentation**: Check this manual first
2. **Knowledge Base**: Search common solutions
3. **Support Ticket**: Create detailed issue report
4. **Community Forum**: Ask other administrators

#### Emergency Contacts

- **IT Support**: it@clirdec.edu
- **System Administrator**: admin@clirdec.edu
- **Emergency Hotline**: +63-XX-XXX-XXXX

---

## Best Practices

### System Maintenance

#### Regular Tasks

- **Daily**: Check system health dashboard
- **Weekly**: Review attendance reports
- **Monthly**: Update student records
- **Quarterly**: Perform system backups
- **Annually**: Review and update policies

#### Backup Strategy

- **Database Backups**: Daily automated backups
- **File Backups**: Weekly configuration backups
- **Offsite Storage**: Cloud backup storage
- **Backup Testing**: Monthly restoration tests

### Security Best Practices

#### Access Control

- **Principle of Least Privilege**: Minimal required permissions
- **Regular Audits**: Review user access quarterly
- **Password Policies**: Enforce strong passwords
- **Multi-Factor Authentication**: Enable for administrators

#### Data Protection

- **Encryption**: Encrypt sensitive data at rest and in transit
- **Data Retention**: Implement data retention policies
- **Privacy Compliance**: GDPR and local privacy laws
- **Incident Response**: Documented security incident procedures

### Performance Optimization

#### System Tuning

- **Database Indexing**: Optimize query performance
- **Caching Strategy**: Implement Redis caching
- **Load Balancing**: Distribute traffic across servers
- **Monitoring**: Set up alerts for performance issues

#### User Training

- **Regular Training**: Annual system training sessions
- **Documentation Updates**: Keep manuals current
- **User Feedback**: Collect and implement user suggestions
- **Support Resources**: Provide help desk access

### Compliance and Auditing

#### Regulatory Compliance

- **Data Privacy**: Student data protection
- **Academic Integrity**: Attendance accuracy
- **Audit Trails**: Complete system activity logs
- **Reporting**: Regular compliance reports

#### Quality Assurance

- **Data Accuracy**: Regular data validation
- **System Reliability**: 99.9% uptime target
- **User Satisfaction**: Regular user surveys
- **Continuous Improvement**: Feature enhancement roadmap

---

## Conclusion

This administrator manual provides comprehensive guidance for managing the CLIRDEC:PRESENCE system. Regular review and updates to this documentation ensure administrators stay current with system capabilities and best practices.

For additional support or questions, contact the IT department at it@clirdec.edu.

**Last Updated**: November 27, 2025
**Version**: 1.0.0
