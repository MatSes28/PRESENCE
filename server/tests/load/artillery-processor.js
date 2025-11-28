// Artillery processor for custom logic during load testing
module.exports = {
  beforeRequest: function (requestParams, context, ee, next) {
    // Add custom headers or modify requests before sending
    if (!requestParams.headers) {
      requestParams.headers = {};
    }

    // Add request ID for tracking
    requestParams.headers[
      "X-Request-ID"
    ] = `load-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
        `Slow request: ${requestParams.url} - ${response.timings.phases.total}ms - ${requestId}`
      );
    }

    // Check for error responses
    if (response.statusCode >= 400) {
      console.log(
        `Error response: ${response.statusCode} for ${requestParams.url} - ${requestId}`
      );
    }

    // Track custom metrics
    if (response.body && typeof response.body === "object") {
      // Extract business metrics from response
      if (response.body.attendanceRecordsCreated) {
        ee.emit(
          "custom_metric",
          "attendance_records_created",
          response.body.attendanceRecordsCreated
        );
      }
      if (response.body.rfidScansProcessed) {
        ee.emit(
          "custom_metric",
          "rfid_scans_processed",
          response.body.rfidScansProcessed
        );
      }
    }

    return next();
  },

  // Custom functions for dynamic data generation
  generateStudentId: function (context, events, done) {
    // Generate realistic student IDs
    const studentId = Math.floor(Math.random() * 1000) + 1;
    return done(studentId);
  },

  generateClassSessionId: function (context, events, done) {
    // Generate realistic class session IDs
    const sessionId = Math.floor(Math.random() * 50) + 1;
    return done(sessionId);
  },

  generateRFID: function (context, events, done) {
    // Generate realistic RFID tags
    const rfid = "RFID" + Math.floor(Math.random() * 900000 + 100000);
    return done(rfid);
  },

  // Authentication helper
  getAuthToken: function (context, events, done) {
    // In a real scenario, this would authenticate and return a token
    // For load testing, we'll use a mock token
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.load.token";
    return done(token);
  },
};
