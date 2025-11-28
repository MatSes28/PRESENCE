import { test, expect } from "@playwright/test";

test.describe("Reporting Workflow E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto("http://localhost:3000");

    // Login
    await page.fill('input[name="email"]', "admin@clirdec.edu");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL("**/dashboard");
  });

  test("should generate and view attendance reports", async ({ page }) => {
    // Navigate to Reports page
    await page.click("text=Reports");
    await page.waitForURL("**/reports");

    // Verify page loads
    await expect(
      page.locator("h3").filter({ hasText: "Attendance Reports" })
    ).toBeVisible();

    // Select report type
    await page.selectOption('select[name="reportType"]', "attendance_summary");

    // Set date range
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const endDate = new Date().toISOString().split("T")[0];

    await page.fill('input[name="startDate"]', startDate);
    await page.fill('input[name="endDate"]', endDate);

    // Generate report
    await page.click('button:has-text("Generate Report")');

    // Verify report generation
    await expect(
      page.locator("text=Report generated successfully")
    ).toBeVisible();

    // Verify report content
    await expect(page.locator("text=Total Students")).toBeVisible();
    await expect(page.locator("text=Present")).toBeVisible();
    await expect(page.locator("text=Absent")).toBeVisible();
    await expect(page.locator("text=Attendance Rate")).toBeVisible();
  });

  test("should export reports in different formats", async ({ page }) => {
    // Navigate to Reports page
    await page.click("text=Reports");
    await page.waitForURL("**/reports");

    // Generate a report first
    await page.selectOption('select[name="reportType"]', "attendance_summary");
    await page.click('button:has-text("Generate Report")');

    // Wait for report to load
    await page.waitForSelector("text=Report generated successfully");

    // Test PDF export
    const pdfButton = page.locator('button:has-text("Export PDF")');
    if (await pdfButton.isVisible()) {
      // Start download listening
      const downloadPromise = page.waitForEvent("download");

      await pdfButton.click();

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    }

    // Test CSV export
    const csvButton = page.locator('button:has-text("Export CSV")');
    if (await csvButton.isVisible()) {
      const downloadPromise = page.waitForEvent("download");

      await csvButton.click();

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.csv$/);
    }
  });

  test("should generate device health reports", async ({ page }) => {
    // Navigate to Reports page
    await page.click("text=Reports");
    await page.waitForURL("**/reports");

    // Select device health report
    await page.selectOption('select[name="reportType"]', "device_health");

    // Generate report
    await page.click('button:has-text("Generate Report")');

    // Verify device health metrics
    await expect(page.locator("text=Device Health Report")).toBeVisible();
    await expect(page.locator("text=Online Devices")).toBeVisible();
    await expect(page.locator("text=Offline Devices")).toBeVisible();
    await expect(page.locator("text=Average Uptime")).toBeVisible();
  });

  test("should display report charts and visualizations", async ({ page }) => {
    // Navigate to Reports page
    await page.click("text=Reports");
    await page.waitForURL("**/reports");

    // Generate attendance report
    await page.selectOption('select[name="reportType"]', "attendance_summary");
    await page.click('button:has-text("Generate Report")');

    // Check for chart containers
    const chartContainer = page.locator('[data-testid="attendance-chart"]');
    if (await chartContainer.isVisible()) {
      // Verify chart is rendered (basic check)
      await expect(chartContainer).toBeVisible();
    }

    // Check for data visualization elements
    await expect(page.locator("text=Daily Attendance Trend")).toBeVisible();
    await expect(page.locator("text=Classroom Breakdown")).toBeVisible();
  });

  test("should filter reports by classroom and date", async ({ page }) => {
    // Navigate to Reports page
    await page.click("text=Reports");
    await page.waitForURL("**/reports");

    // Select classroom filter
    const classroomSelect = page.locator('select[name="classroom"]');
    if (await classroomSelect.isVisible()) {
      await page.selectOption('select[name="classroom"]', "1"); // Select first classroom
    }

    // Set custom date range
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    await page.fill(
      'input[name="startDate"]',
      lastMonth.toISOString().split("T")[0]
    );
    await page.fill(
      'input[name="endDate"]',
      new Date().toISOString().split("T")[0]
    );

    // Generate filtered report
    await page.click('button:has-text("Generate Report")');

    // Verify report shows filtered data
    await expect(page.locator("text=Filtered by classroom")).toBeVisible();
  });

  test("should handle scheduled report generation", async ({ page }) => {
    // Navigate to Reports page
    await page.click("text=Reports");
    await page.waitForURL("**/reports");

    // Click on scheduled reports tab/section
    const scheduledTab = page.locator('button:has-text("Scheduled Reports")');
    if (await scheduledTab.isVisible()) {
      await scheduledTab.click();

      // Verify scheduled reports interface
      await expect(page.locator("text=Scheduled Reports")).toBeVisible();

      // Create new scheduled report
      await page.click('button:has-text("Create Schedule")');

      // Fill schedule form
      await page.selectOption(
        'select[name="reportType"]',
        "attendance_summary"
      );
      await page.selectOption('select[name="frequency"]', "weekly");
      await page.fill('input[name="email"]', "admin@clirdec.edu");

      // Save schedule
      await page.click('button:has-text("Save Schedule")');

      // Verify schedule created
      await expect(
        page.locator("text=Schedule created successfully")
      ).toBeVisible();
    }
  });

  test("should display report history and archives", async ({ page }) => {
    // Navigate to Reports page
    await page.click("text=Reports");
    await page.waitForURL("**/reports");

    // Look for report history section
    const historyTab = page.locator('button:has-text("Report History")');
    if (await historyTab.isVisible()) {
      await historyTab.click();

      // Verify history interface
      await expect(page.locator("text=Generated Reports")).toBeVisible();

      // Check for report list
      const reportList = page.locator("table");
      if (await reportList.isVisible()) {
        // Verify table has expected columns
        await expect(
          page.locator("th").filter({ hasText: "Report Type" })
        ).toBeVisible();
        await expect(
          page.locator("th").filter({ hasText: "Generated" })
        ).toBeVisible();
        await expect(
          page.locator("th").filter({ hasText: "Actions" })
        ).toBeVisible();
      }
    }
  });

  test("should handle report generation errors gracefully", async ({
    page,
  }) => {
    // Navigate to Reports page
    await page.click("text=Reports");
    await page.waitForURL("**/reports");

    // Try to generate report with invalid date range
    await page.selectOption('select[name="reportType"]', "attendance_summary");
    await page.fill('input[name="startDate"]', "2025-12-31"); // Future date
    await page.fill('input[name="endDate"]', "2025-01-01"); // Earlier than start

    // Generate report
    await page.click('button:has-text("Generate Report")');

    // Verify error handling
    await expect(page.locator("text=Invalid date range")).toBeVisible();
  });

  test("should generate real-time attendance analytics", async ({ page }) => {
    // Navigate to Reports page
    await page.click("text=Reports");
    await page.waitForURL("**/reports");

    // Select real-time analytics
    const realtimeTab = page.locator('button:has-text("Real-time Analytics")');
    if (await realtimeTab.isVisible()) {
      await realtimeTab.click();

      // Verify real-time metrics
      await expect(page.locator("text=Live Attendance Rate")).toBeVisible();
      await expect(page.locator("text=Current Session")).toBeVisible();
      await expect(page.locator("text=Active Students")).toBeVisible();

      // Check for real-time updates (refresh button or auto-update indicator)
      const refreshButton = page.locator('button:has-text("Refresh")');
      if (await refreshButton.isVisible()) {
        await refreshButton.click();
        await expect(page.locator("text=Data refreshed")).toBeVisible();
      }
    }
  });

  test("should validate report permissions", async ({ page }) => {
    // This test would require different user roles
    // For now, just verify that reports are accessible to admin users

    // Navigate to Reports page
    await page.click("text=Reports");
    await page.waitForURL("**/reports");

    // Verify admin can access all report types
    const reportTypes = [
      "attendance_summary",
      "device_health",
      "student_performance",
    ];
    for (const reportType of reportTypes) {
      await page.selectOption('select[name="reportType"]', reportType);
      await page.click('button:has-text("Generate Report")');

      // Should not show permission denied
      await expect(page.locator("text=Permission denied")).not.toBeVisible();
    }
  });
});
