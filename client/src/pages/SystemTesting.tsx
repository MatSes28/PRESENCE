import React, { useState } from "react";
import { api } from "../lib/api";

export const SystemTesting: React.FC = () => {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const runRFIDTest = async () => {
    setLoading(true);
    try {
      const response = await api.post("/testing/rfid-simulate", {
        cardId: "TEST_CARD_123",
        deviceId: "SIMULATOR_001",
      });
      setTestResults((prev) => [
        ...prev,
        `RFID Test: ${(response.data as any).message}`,
      ]);
    } catch (error) {
      setTestResults((prev) => [...prev, `RFID Test Failed: ${error}`]);
    } finally {
      setLoading(false);
    }
  };

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const response = await api.get("/testing/health-check");
      setTestResults((prev) => [
        ...prev,
        `Health Check: ${(response.data as any).status}`,
      ]);
    } catch (error) {
      setTestResults((prev) => [...prev, `Health Check Failed: ${error}`]);
    } finally {
      setLoading(false);
    }
  };

  const createTestAttendance = async () => {
    setLoading(true);
    try {
      const response = await api.post("/testing/create-attendance", {
        studentId: "TEST_STUDENT",
        sessionId: "TEST_SESSION",
        status: "present",
      });
      setTestResults((prev) => [
        ...prev,
        `Test Attendance: ${(response.data as any).message}`,
      ]);
    } catch (error) {
      setTestResults((prev) => [...prev, `Test Attendance Failed: ${error}`]);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">System Testing</h2>

      {/* Test Buttons */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Test Scenarios
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={runRFIDTest}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Simulate RFID Tap
          </button>
          <button
            onClick={runHealthCheck}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            Run Health Check
          </button>
          <button
            onClick={createTestAttendance}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
          >
            Create Test Attendance
          </button>
        </div>
      </div>

      {/* Test Results */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
          <button
            onClick={clearResults}
            className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
          >
            Clear
          </button>
        </div>
        <div className="p-6">
          {testResults.length === 0 ? (
            <p className="text-gray-500">
              No test results yet. Run a test to see results here.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {testResults.map((result, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 rounded border-l-4 border-blue-500"
                >
                  <p className="text-sm text-gray-900">{result}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date().toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Operations */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Bulk Operations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Test Records
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="100"
            />
          </div>
          <div className="flex items-end">
            <button className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700">
              Generate Bulk Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
