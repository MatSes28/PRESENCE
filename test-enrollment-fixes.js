#!/usr/bin/env node

/**
 * Test script to verify enrollment API fixes
 * This script tests the bulk enrollment endpoint with various scenarios
 */

import fetch from "node-fetch";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Configuration
const API_BASE_URL = "http://localhost:3000/api";
const TEST_SUBJECT_ID = 1; // Use an existing subject ID
const TEST_STUDENT_IDS = [1, 2, 3]; // Use existing student IDs
const TEST_SEMESTER = "1st Semester";
const TEST_ACADEMIC_YEAR = "2023-2024";

// Test cases
const testCases = [
  {
    name: "Valid bulk enrollment",
    data: {
      studentIds: TEST_STUDENT_IDS,
      subjectId: TEST_SUBJECT_ID,
      semester: TEST_SEMESTER,
      academicYear: TEST_ACADEMIC_YEAR,
    },
    expectedStatus: 201,
    shouldSucceed: true,
  },
  {
    name: "Missing required fields",
    data: {
      studentIds: TEST_STUDENT_IDS,
      // Missing subjectId, semester, academicYear
    },
    expectedStatus: 400,
    shouldSucceed: false,
  },
  {
    name: "Invalid student IDs (non-numeric)",
    data: {
      studentIds: ["invalid", "ids"],
      subjectId: TEST_SUBJECT_ID,
      semester: TEST_SEMESTER,
      academicYear: TEST_ACADEMIC_YEAR,
    },
    expectedStatus: 400,
    shouldSucceed: false,
  },
  {
    name: "Non-existent subject",
    data: {
      studentIds: TEST_STUDENT_IDS,
      subjectId: 99999, // Non-existent subject
      semester: TEST_SEMESTER,
      academicYear: TEST_ACADEMIC_YEAR,
    },
    expectedStatus: 404,
    shouldSucceed: false,
  },
  {
    name: "Non-existent students",
    data: {
      studentIds: [99999, 99998], // Non-existent students
      subjectId: TEST_SUBJECT_ID,
      semester: TEST_SEMESTER,
      academicYear: TEST_ACADEMIC_YEAR,
    },
    expectedStatus: 404,
    shouldSucceed: false,
  },
];

// Helper function to make API requests
async function makeApiRequest(endpoint, method = "POST", data = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token", // Replace with actual auth if needed
    },
    body: data ? JSON.stringify(data) : undefined,
  };

  try {
    const response = await fetch(url, options);
    const responseData = await response.json();
    return { response, responseData };
  } catch (error) {
    console.error(`Request failed for ${endpoint}:`, error.message);
    return { error };
  }
}

// Run test cases
async function runTests() {
  console.log("🧪 Starting Enrollment API Test Suite");
  console.log("=====================================\n");

  let passedTests = 0;
  let failedTests = 0;

  for (const testCase of testCases) {
    console.log(`📋 Running test: ${testCase.name}`);
    console.log(`📤 Request data: ${JSON.stringify(testCase.data, null, 2)}`);

    try {
      const { response, responseData, error } = await makeApiRequest(
        "/enrollments/bulk",
        "POST",
        testCase.data
      );

      if (error) {
        console.error(
          `❌ Test failed: ${testCase.name} - Request error: ${error.message}`
        );
        failedTests++;
        continue;
      }

      console.log(`📍 Response status: ${response.status}`);
      console.log(`📦 Response data: ${JSON.stringify(responseData, null, 2)}`);

      if (response.status === testCase.expectedStatus) {
        console.log(`✅ Test passed: ${testCase.name}`);
        passedTests++;
      } else {
        console.error(
          `❌ Test failed: ${testCase.name} - Expected status ${testCase.expectedStatus}, got ${response.status}`
        );
        failedTests++;
      }

      // Check if success flag matches expectation
      if (responseData && "success" in responseData) {
        if (responseData.success === testCase.shouldSucceed) {
          console.log(`✅ Success flag correct: ${responseData.success}`);
        } else {
          console.error(
            `❌ Success flag incorrect: Expected ${testCase.shouldSucceed}, got ${responseData.success}`
          );
          failedTests++;
        }
      }
    } catch (error) {
      console.error(
        `❌ Test failed: ${testCase.name} - Unexpected error: ${error.message}`
      );
      failedTests++;
    }

    console.log("---");
  }

  // Summary
  console.log("\n📊 Test Summary");
  console.log("================");
  console.log(`Total tests: ${testCases.length}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(
    `Success rate: ${((passedTests / testCases.length) * 100).toFixed(2)}%`
  );

  if (failedTests === 0) {
    console.log(
      "🎉 All tests passed! The enrollment API fixes are working correctly."
    );
  } else {
    console.log(
      "⚠️  Some tests failed. Please review the error messages above."
    );
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

// Run the tests
runTests();
