// Artillery processor for custom logic during load testing
module.exports = {
  beforeScenario: function (context, ee, next) {
    // Inject credentials from environment (no hardcoded/mock tokens).
    context.vars.loadtestEmail =
      process.env.LOADTEST_EMAIL || "loadtest-admin@example.com";
    context.vars.loadtestPassword =
      process.env.LOADTEST_PASSWORD || "ChangeMe-LoadTest-Password-123!";

    // Optional: device API key for IoT endpoints (set for iot-specific test plans)
    context.vars.deviceApiKey = process.env.LOADTEST_DEVICE_API_KEY || "";

    return next();
  },

  beforeRequest: function (requestParams, context, ee, next) {
    // Add custom headers or modify requests before sending
    if (!requestParams.headers) {
      requestParams.headers = {};
    }

    // Add request ID for tracking
    requestParams.headers["X-Request-ID"] =
      `load-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add user agent
    requestParams.headers["User-Agent"] = "Artillery-Load-Test/1.0";

    return next();
  },

  afterResponse: function (requestParams, response, context, ee, next) {
    // Process response after receiving
    const requestId = requestParams.headers["X-Request-ID"];

    // Log slow requests (>500ms)
    if (
      response.timings &&
      response.timings.phases &&
      response.timings.phases.total > 500
    ) {
      console.log(
        `Slow request: ${requestParams.url} - ${response.timings.phases.total}ms - ${requestId}`,
      );
    }

    // Check for error responses
    if (response.statusCode >= 400) {
      console.log(
        `Error response: ${response.statusCode} for ${requestParams.url} - ${requestId}`,
      );
    }

    // Track custom metrics
    if (response.body && typeof response.body === "object") {
      // Extract business metrics from response
      if (response.body.attendanceRecordsCreated) {
        ee.emit(
          "custom_metric",
          "attendance_records_created",
          response.body.attendanceRecordsCreated,
        );
      }
      if (response.body.rfidScansProcessed) {
        ee.emit(
          "custom_metric",
          "rfid_scans_processed",
          response.body.rfidScansProcessed,
        );
      }
    }

    return next();
  },

  // Custom functions for dynamic data generation
  generateStudentId: function (context, events, done) {
    // Generate realistic student IDs (1-2000 range for larger school)
    const studentId = Math.floor(Math.random() * 2000) + 1;
    return done(studentId);
  },

  generateClassSessionId: function (context, events, done) {
    // Generate realistic class session IDs (morning/afternoon sessions)
    const sessionId = Math.floor(Math.random() * 100) + 1;
    return done(sessionId);
  },

  generateRFID: function (context, events, done) {
    // Generate realistic RFID tags with consistent format
    const rfid =
      "RFID" +
      String(Math.floor(Math.random() * 900000 + 100000)).padStart(6, "0");
    return done(rfid);
  },

  generateDeviceId: function (context, events, done) {
    // Generate IoT device IDs
    const deviceId = "iot_device_" + (Math.floor(Math.random() * 100) + 1);
    return done(deviceId);
  },

  generateFacultyEmail: function (context, events, done) {
    // Generate faculty email addresses
    const facultyId = Math.floor(Math.random() * 100) + 1;
    const email = `faculty${facultyId}@school.edu`;
    return done(email);
  },

  generateStudentEmail: function (context, events, done) {
    // Generate student email addresses
    const studentId = Math.floor(Math.random() * 2000) + 1;
    const email = `student${studentId}@school.edu`;
    return done(email);
  },

  generateTimestamp: function (context, events, done) {
    // Generate realistic timestamps within school hours
    const now = new Date();
    const hour = Math.floor(Math.random() * 12) + 7; // 7 AM to 7 PM
    now.setHours(
      hour,
      Math.floor(Math.random() * 60),
      Math.floor(Math.random() * 60),
    );
    return done(now.toISOString());
  },

  generateAttendanceStatus: function (context, events, done) {
    // Generate attendance status with realistic distribution (85% present)
    const statuses = [
      "present",
      "present",
      "present",
      "present",
      "present",
      "present",
      "present",
      "present",
      "late",
      "absent",
    ];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    return done(status);
  },

  // Bulk data generation for realistic scenarios
  generateBulkAttendanceRecords: function (context, events, done) {
    const records = [];
    const numRecords = Math.floor(Math.random() * 20) + 5; // 5-25 students per class

    for (let i = 0; i < numRecords; i++) {
      records.push({
        studentId: Math.floor(Math.random() * 2000) + 1,
        status:
          Math.random() > 0.15
            ? "present"
            : Math.random() > 0.5
              ? "late"
              : "absent",
        entryTime: new Date().toISOString(),
        notes: Math.random() > 0.8 ? `Load test note ${i}` : undefined,
      });
    }

    return done(records);
  },
};
