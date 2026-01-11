#!/usr/bin/env node

/**
 * Integration Endpoint Testing Script
 * Tests the key integration endpoints of the PRESENCE system
 */

import axios from "axios";
import { performance } from "perf_hooks";

const BASE_URL = "http://localhost:3000/api";

// Test configuration
const TEST_CONFIG = {
  endpoints: [
    { name: "Health Check", path: "/health", method: "GET" },
    {
      name: "Authentication",
      path: "/auth/login",
      method: "POST",
      data: { email: "admin@clirdec.edu", password: "Admin123!" },
    },
    { name: "Students", path: "/students", method: "GET" },
    { name: "Subjects", path: "/subjects", method: "GET" },
    { name: "Schedules", path: "/schedules", method: "GET" },
    { name: "Attendance", path: "/attendance", method: "GET" },
    { name: "IoT Devices", path: "/iot/devices", method: "GET" },
    { name: "Computers", path: "/computers", method: "GET" },
    { name: "Classrooms", path: "/classrooms", method: "GET" },
  ],
  timeout: 5000, // 5 seconds
  maxRetries: 3,
};

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",

  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    crimson: "\x1b[38m",
  },

  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
    crimson: "\x1b[48m",
  },
};

// Test a single endpoint
async function testEndpoint(endpoint) {
  const startTime = performance.now();
  let attempt = 0;
  let success = false;
  let response = null;
  let error = null;

  while (attempt < TEST_CONFIG.maxRetries && !success) {
    attempt++;
    try {
      const config = {
        method: endpoint.method,
        url: `${BASE_URL}${endpoint.path}`,
        timeout: TEST_CONFIG.timeout,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      };

      if (endpoint.data) {
        config.data = endpoint.data;
      }

      response = await axios(config);
      success = true;
    } catch (err) {
      error = err;
      if (attempt < TEST_CONFIG.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  const endTime = performance.now();
  const responseTime = endTime - startTime;

  return {
    name: endpoint.name,
    success,
    responseTime,
    statusCode: response ? response.status : error?.response?.status || "N/A",
    attempt,
    error: error ? error.message : null,
  };
}

// Run all tests
async function runIntegrationTests() {
  console.log(`${colors.fg.cyan}${colors.bright}
🔍 PRESENCE System - Integration Endpoint Testing${colors.reset}`);
  console.log(
    `${colors.fg.blue}===============================================${colors.reset}`
  );
  console.log(`${colors.fg.yellow}Base URL:${colors.reset} ${BASE_URL}`);
  console.log(
    `${colors.fg.yellow}Timeout:${colors.reset} ${TEST_CONFIG.timeout}ms`
  );
  console.log(
    `${colors.fg.yellow}Max Retries:${colors.reset} ${TEST_CONFIG.maxRetries}`
  );
  console.log("");

  const results = [];
  let passed = 0;
  let failed = 0;
  let totalResponseTime = 0;

  for (const endpoint of TEST_CONFIG.endpoints) {
    console.log(
      `${colors.fg.magenta}Testing ${endpoint.name}...${colors.reset}`
    );

    const result = await testEndpoint(endpoint);
    results.push(result);

    if (result.success) {
      console.log(
        `${colors.fg.green}✅ PASS${colors.reset} - ${endpoint.name}`
      );
      console.log(
        `   ${colors.fg.blue}Response Time:${
          colors.reset
        } ${result.responseTime.toFixed(2)}ms`
      );
      console.log(
        `   ${colors.fg.blue}Status Code:${colors.reset} ${result.statusCode}`
      );
      passed++;
    } else {
      console.log(`${colors.fg.red}❌ FAIL${colors.reset} - ${endpoint.name}`);
      console.log(
        `   ${colors.fg.blue}Attempts:${colors.reset} ${result.attempt}`
      );
      console.log(`   ${colors.fg.blue}Error:${colors.reset} ${result.error}`);
      console.log(
        `   ${colors.fg.blue}Status Code:${colors.reset} ${result.statusCode}`
      );
      failed++;
    }

    totalResponseTime += result.responseTime;
    console.log("");
  }

  // Summary
  const averageResponseTime = totalResponseTime / TEST_CONFIG.endpoints.length;
  const successRate = (passed / TEST_CONFIG.endpoints.length) * 100;

  console.log(
    `${colors.fg.cyan}${colors.bright}===============================================${colors.reset}`
  );
  console.log(
    `${colors.fg.cyan}${colors.bright}📊 TEST SUMMARY${colors.reset}`
  );
  console.log(
    `${colors.fg.cyan}${colors.bright}===============================================${colors.reset}`
  );
  console.log(
    `${colors.fg.green}Total Tests:${colors.reset} ${TEST_CONFIG.endpoints.length}`
  );
  console.log(`${colors.fg.green}Passed:${colors.reset} ${passed}`);
  console.log(`${colors.fg.red}Failed:${colors.reset} ${failed}`);
  console.log(
    `${colors.fg.blue}Success Rate:${colors.reset} ${successRate.toFixed(2)}%`
  );
  console.log(
    `${colors.fg.blue}Avg Response Time:${
      colors.reset
    } ${averageResponseTime.toFixed(2)}ms`
  );

  if (failed === 0) {
    console.log(`${colors.fg.green}${colors.bright}
🎉 All integration endpoints are working correctly!${colors.reset}`);
  } else {
    console.log(`${colors.fg.red}${colors.bright}
⚠️  Some endpoints failed. Please check the errors above.${colors.reset}`);
  }

  return { passed, failed, successRate, averageResponseTime, results };
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTests().catch((error) => {
    console.error(
      `${colors.fg.red}[ERROR]${colors.reset} Test execution failed:`,
      error
    );
    process.exit(1);
  });
}

export { runIntegrationTests, testEndpoint };
