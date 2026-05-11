import { test, expect } from "@playwright/test";
import { gotoRoute, loginAsAdmin } from "./helpers";

test.describe("Attendance Management E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should complete full attendance workflow", async ({ page }) => {
    await gotoRoute(page, "/attendance", "Live Attendance Monitoring");

    // Test RFID simulation
    const rfidInput = page.locator('input[placeholder="Enter RFID card ID"]');
    await rfidInput.fill("RFID20260001");
    const rfidResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/attendance/simulate-rfid"),
    );
    await page.click('button:has-text("Simulate RFID Tap")');
    const rfidResponse = await rfidResponsePromise;
    expect([200, 400, 429]).toContain(rfidResponse.status());

    // Test sensor simulation
    const entryResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/attendance/simulate-sensor"),
    );
    await page.click('button:has-text("Simulate Entry Sensor")');
    const entryResponse = await entryResponsePromise;
    expect([200, 400, 429]).toContain(entryResponse.status());

    // Trigger another event
    const exitResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/attendance/simulate-sensor"),
    );
    await page.click('button:has-text("Simulate Exit Sensor")');
    const exitResponse = await exitResponsePromise;
    expect([200, 400, 429]).toContain(exitResponse.status());
  });

  test("should handle manual attendance entry", async ({ page }) => {
    await gotoRoute(page, "/attendance", "Live Attendance Monitoring");

    // Click Manual Entry button
    await page.click('button:has-text("Manual Entry")');

    // Fill manual entry form
    await page.selectOption('select[name="studentId"]', { index: 1 });
    await page.selectOption('select[name="classSessionId"]', { index: 1 });
    await page.fill(
      'input[type="datetime-local"]',
      new Date().toISOString().slice(0, 16),
    );
    await page.fill("textarea", "E2E test manual entry");

    const manualResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/attendance/manual"),
    );

    // Submit form
    await page.click('button:has-text("Record Attendance")');
    const manualResponse = await manualResponsePromise;
    expect([200, 201, 400, 409]).toContain(manualResponse.status());

    // Verify the table remains available after recording.
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("should handle attendance discrepancies", async ({ page }) => {
    await gotoRoute(page, "/attendance", "Live Attendance Monitoring");

    // Simulate an unknown RFID without sensor pairing.
    const rfidInput = page.locator('input[placeholder="Enter RFID card ID"]');
    await rfidInput.fill("DISC123456");
    const rfidResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/attendance/simulate-rfid"),
    );
    await page.click('button:has-text("Simulate RFID Tap")');
    const rfidResponse = await rfidResponsePromise;

    // Unknown tags should be handled cleanly instead of breaking the workflow.
    expect(rfidResponse.status()).toBe(400);
    await expect(page.getByText("Discrepancies", { exact: true })).toBeVisible();
  });

  test("should display real-time attendance table", async ({ page }) => {
    await gotoRoute(page, "/attendance", "Live Attendance Monitoring");

    // Verify table headers
    await expect(
      page.getByRole("columnheader", { name: "Student", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Status", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: /Check-in Time/ }),
    ).toBeVisible();

    // Verify table has data or shows empty state
    const tableBody = page.locator("tbody");
    const emptyState = page.getByText("No attendance records found");
    const hasData =
      (await tableBody.locator("tr").count()) > 0 &&
      !(await emptyState.isVisible());

    if (hasData) {
      // Verify data structure
      const firstRow = tableBody.locator("tr").first();
      await expect(firstRow.locator("td")).toHaveCount(7);
    } else {
      // Verify empty state message
      await expect(
        emptyState,
      ).toBeVisible();
    }
  });

  test("should handle parent contact functionality", async ({ page }) => {
    await gotoRoute(page, "/attendance", "Live Attendance Monitoring");

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
    await gotoRoute(page, "/attendance", "Live Attendance Monitoring");

    // Click refresh button
    await page.click('button:has-text("Refresh")');

    // Verify loading state (if implemented)
    // This test mainly ensures the refresh functionality doesn't break
    await expect(
      page.locator("h3").filter({ hasText: "Live Attendance Monitoring" }),
    ).toBeVisible();
  });

  test("should display system status indicators", async ({ page }) => {
    await gotoRoute(page, "/attendance", "Live Attendance Monitoring");

    // Check WebSocket connection status
    await expect(page.getByText(/RFID Scanner (Active|Inactive)/)).toBeVisible();

    // Check device status indicators
    await expect(page.locator("text=Active Devices")).toBeVisible();
    await expect(
      page.getByRole("main").getByText("Attendance System", { exact: true }),
    ).toBeVisible();
  });
});
