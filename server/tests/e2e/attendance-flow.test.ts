import { test, expect } from "@playwright/test";

const E2E_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || "admin@clirdec.edu";
const E2E_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || "admin123";

test.describe("Attendance Management E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto("/");

    // Login if needed (assuming login form exists)
    await page.fill('input[name="email"]', E2E_EMAIL);
    await page.fill('input[name="password"]', E2E_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL("**/dashboard");
  });

  test("should complete full attendance workflow", async ({ page }) => {
    // Navigate to Live Attendance page
    await page.click("text=Live Attendance");
    await page.waitForURL("**/live-attendance");

    // Verify page loads
    await expect(
      page.locator("h3").filter({ hasText: "Live Attendance Monitoring" }),
    ).toBeVisible();

    // Test RFID simulation
    const rfidInput = page.locator('input[placeholder="Enter RFID card ID"]');
    await rfidInput.fill("TEST123456");
    await page.click('button:has-text("Simulate RFID Tap")');

    // Verify event appears in feed
    await expect(
      page.locator("text=RFID card scanned: TEST123456"),
    ).toBeVisible();

    // Test sensor simulation
    await page.click('button:has-text("Simulate Entry Sensor")');
    await expect(page.locator("text=entry sensor triggered")).toBeVisible();

    // Check stats update
    const totalEventsStat = page
      .locator("text=Total Events")
      .locator("xpath=following-sibling::*");
    const initialCount = (await totalEventsStat.textContent()) ?? "";

    // Trigger another event
    await page.click('button:has-text("Simulate Exit Sensor")');

    // Verify stats updated
    await expect(totalEventsStat).not.toHaveText(initialCount);
  });

  test("should handle manual attendance entry", async ({ page }) => {
    // Navigate to Live Attendance
    await page.click("text=Live Attendance");

    // Click Manual Entry button
    await page.click('button:has-text("Manual Entry")');

    // Fill manual entry form
    await page.selectOption('select[name="student"]', "1"); // Select first student
    await page.selectOption('select[name="session"]', "1"); // Select first session
    await page.fill(
      'input[type="datetime-local"]',
      new Date().toISOString().slice(0, 16),
    );
    await page.fill("textarea", "E2E test manual entry");

    // Submit form
    await page.click('button:has-text("Record Attendance")');

    // Verify success notification
    await expect(page.locator("text=Attendance Recorded")).toBeVisible();

    // Verify record appears in table
    await expect(page.locator("table")).toContainText("E2E test manual entry");
  });

  test("should handle attendance discrepancies", async ({ page }) => {
    // Navigate to Live Attendance
    await page.click("text=Live Attendance");

    // Simulate RFID without sensor
    const rfidInput = page.locator('input[placeholder="Enter RFID card ID"]');
    await rfidInput.fill("DISC123456");
    await page.click('button:has-text("Simulate RFID Tap")');

    // Check for discrepancy indicator
    await expect(page.locator("text=discrepancy")).toBeVisible();

    // Verify discrepancy count increases
    const discrepancyStat = page
      .locator("text=Discrepancies")
      .locator("xpath=following-sibling::*");
    const initialCount = (await discrepancyStat.textContent()) ?? "";

    // Trigger another discrepancy
    await rfidInput.fill("DISC789012");
    await page.click('button:has-text("Simulate RFID Tap")');

    // Verify count updated
    await expect(discrepancyStat).not.toHaveText(initialCount);
  });

  test("should display real-time attendance table", async ({ page }) => {
    // Navigate to Live Attendance
    await page.click("text=Live Attendance");

    // Verify table headers
    await expect(
      page.locator("th").filter({ hasText: "Student" }),
    ).toBeVisible();
    await expect(
      page.locator("th").filter({ hasText: "Status" }),
    ).toBeVisible();
    await expect(
      page.locator("th").filter({ hasText: "Check-in Time" }),
    ).toBeVisible();

    // Verify table has data or shows empty state
    const tableBody = page.locator("tbody");
    const hasData = (await tableBody.locator("tr").count()) > 0;

    if (hasData) {
      // Verify data structure
      const firstRow = tableBody.locator("tr").first();
      await expect(firstRow.locator("td")).toHaveCount(6); // 6 columns
    } else {
      // Verify empty state message
      await expect(
        page.locator("text=No attendance records found"),
      ).toBeVisible();
    }
  });

  test("should handle parent contact functionality", async ({ page }) => {
    // Navigate to Live Attendance
    await page.click("text=Live Attendance");

    // Find a record with absent status (if any)
    const absentRow = page.locator("tr").filter({ hasText: "absent" }).first();

    if (await absentRow.isVisible()) {
      // Click contact button
      await absentRow.locator('button:has-text("Contact")').click();

      // Fill contact form
      await page.fill(
        "textarea",
        "This is an automated test message from the attendance system.",
      );

      // Submit contact form
      await page.click('button:has-text("Send Message")');

      // Verify success notification
      await expect(page.locator("text=Parent Contacted")).toBeVisible();
    } else {
      // Skip test if no absent records
      test.skip(true, "No absent records available for contact test");
    }
  });

  test("should refresh attendance data", async ({ page }) => {
    // Navigate to Live Attendance
    await page.click("text=Live Attendance");

    // Click refresh button
    await page.click('button:has-text("Refresh")');

    // Verify loading state (if implemented)
    // This test mainly ensures the refresh functionality doesn't break
    await expect(
      page.locator("h3").filter({ hasText: "Live Attendance Monitoring" }),
    ).toBeVisible();
  });

  test("should display system status indicators", async ({ page }) => {
    // Navigate to Live Attendance
    await page.click("text=Live Attendance");

    // Check WebSocket connection status
    const wsStatus = page
      .locator("text=RFID Scanner")
      .locator("xpath=following-sibling::*");
    await expect(wsStatus).toBeVisible();

    // Check device status indicators
    await expect(page.locator("text=Active Devices")).toBeVisible();
    await expect(page.locator("text=Attendance System")).toBeVisible();
  });
});
