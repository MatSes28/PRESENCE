import { test, expect } from "@playwright/test";

const E2E_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || "admin@clirdec.edu";
const E2E_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || "admin123";

test.describe("Device Registration E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto("/");

    // Login
    await page.fill('input[name="email"]', E2E_EMAIL);
    await page.fill('input[name="password"]', E2E_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL("**/dashboard");
  });

  test("should complete full device registration workflow", async ({
    page,
  }) => {
    // Navigate to IoT Devices page
    await page.click("text=IoT Devices");
    await page.waitForURL("**/iot-devices");

    // Verify page loads
    await expect(
      page.locator("h3").filter({ hasText: "IoT Device Management" }),
    ).toBeVisible();

    // Click Add Device button
    await page.click('button:has-text("Add Device")');

    // Fill device registration form
    await page.fill('input[name="deviceId"]', "E2E_TEST_DEVICE_001");
    await page.selectOption('select[name="deviceType"]', "esp32_s3");
    await page.selectOption('select[name="classroom"]', "1"); // Select first classroom
    await page.fill('input[name="ipAddress"]', "192.168.1.100");
    await page.fill('input[name="macAddress"]', "AA:BB:CC:DD:EE:FF");

    // Submit form
    await page.click('button:has-text("Register Device")');

    // Verify success notification
    await expect(
      page.locator("text=Device registered successfully"),
    ).toBeVisible();

    // Verify device appears in table
    await expect(page.locator("table")).toContainText("E2E_TEST_DEVICE_001");
    await expect(page.locator("table")).toContainText("esp32_s3");
  });

  test("should handle device discovery and registration", async ({ page }) => {
    // Navigate to IoT Devices page
    await page.click("text=IoT Devices");
    await page.waitForURL("**/iot-devices");

    // Click Network Discovery button
    await page.click('button:has-text("Network Discovery")');

    // Verify discovery modal opens
    await expect(page.locator("text=Device Discovery")).toBeVisible();

    // Start discovery
    await page.click('button:has-text("Start Discovery")');

    // Wait for discovery to complete (simulate)
    await page.waitForTimeout(3000);

    // Check if devices were found
    const discoveredDevices = page.locator("text=Discovered Devices");
    if (await discoveredDevices.isVisible()) {
      // Register discovered device
      await page.click('button:has-text("Register Selected")');

      // Verify registration success
      await expect(
        page.locator("text=Device registered successfully"),
      ).toBeVisible();
    } else {
      // No devices found - verify empty state
      await expect(page.locator("text=No devices discovered")).toBeVisible();
    }
  });

  test("should configure device settings", async ({ page }) => {
    // Navigate to IoT Devices page
    await page.click("text=IoT Devices");
    await page.waitForURL("**/iot-devices");

    // Find a device in the table (assuming one exists)
    const deviceRow = page.locator("tbody tr").first();
    if (await deviceRow.isVisible()) {
      // Click configure button
      await deviceRow.locator('button:has-text("Configure")').click();

      // Verify configuration modal opens
      await expect(page.locator("text=Device Configuration")).toBeVisible();

      // Update configuration
      await page.fill('input[name="rfidSensitivity"]', "75");
      await page.fill('input[name="sensorThreshold"]', "50");
      await page.check('input[name="autoRestart"]');

      // Save configuration
      await page.click('button:has-text("Save Configuration")');

      // Verify success
      await expect(page.locator("text=Configuration updated")).toBeVisible();
    } else {
      test.skip(true, "No devices available for configuration test");
    }
  });

  test("should monitor device health", async ({ page }) => {
    // Navigate to IoT Devices page
    await page.click("text=IoT Devices");
    await page.waitForURL("**/iot-devices");

    // Find a device and click health check
    const deviceRow = page.locator("tbody tr").first();
    if (await deviceRow.isVisible()) {
      await deviceRow.locator('button:has-text("Health Check")').click();

      // Verify health check results
      await expect(page.locator("text=Health Check Results")).toBeVisible();

      // Check health metrics
      await expect(page.locator("text=Uptime")).toBeVisible();
      await expect(page.locator("text=CPU Usage")).toBeVisible();
      await expect(page.locator("text=Memory Usage")).toBeVisible();
      await expect(page.locator("text=Signal Strength")).toBeVisible();
    } else {
      test.skip(true, "No devices available for health check test");
    }
  });

  test("should handle device commands", async ({ page }) => {
    // Navigate to IoT Devices page
    await page.click("text=IoT Devices");
    await page.waitForURL("**/iot-devices");

    // Find a device and click commands
    const deviceRow = page.locator("tbody tr").first();
    if (await deviceRow.isVisible()) {
      await deviceRow.locator('button:has-text("Commands")').click();

      // Verify command modal opens
      await expect(page.locator("text=Device Commands")).toBeVisible();

      // Send ping command
      await page.click('button:has-text("Ping")');

      // Verify command response
      await expect(
        page.locator("text=Command sent successfully"),
      ).toBeVisible();

      // Send restart command
      await page.click('button:has-text("Restart")');

      // Confirm restart
      await page.click('button:has-text("Confirm Restart")');

      // Verify restart command sent
      await expect(page.locator("text=Restart command sent")).toBeVisible();
    } else {
      test.skip(true, "No devices available for command test");
    }
  });

  test("should display device status indicators", async ({ page }) => {
    // Navigate to IoT Devices page
    await page.click("text=IoT Devices");
    await page.waitForURL("**/iot-devices");

    // Verify status indicators are present
    await expect(page.locator("text=Total Devices")).toBeVisible();
    await expect(page.locator("text=Online Devices")).toBeVisible();
    await expect(page.locator("text=Offline Devices")).toBeVisible();

    // Check device table has status column
    await expect(
      page.locator("th").filter({ hasText: "Status" }),
    ).toBeVisible();

    // Verify status badges exist
    const statusBadges = page.locator('[data-testid="device-status"]');
    if (await statusBadges.first().isVisible()) {
      // Check for online/offline/maintenance status
      const badgeText = await statusBadges.first().textContent();
      expect(["online", "offline", "maintenance"]).toContain(
        badgeText?.toLowerCase(),
      );
    }
  });

  test("should handle bulk device operations", async ({ page }) => {
    // Navigate to IoT Devices page
    await page.click("text=IoT Devices");
    await page.waitForURL("**/iot-devices");

    // Check for bulk operations
    const bulkUpdateButton = page.locator('button:has-text("Bulk Update")');
    if (await bulkUpdateButton.isVisible()) {
      await bulkUpdateButton.click();

      // Verify bulk operations modal
      await expect(page.locator("text=Bulk Device Operations")).toBeVisible();

      // Select devices
      await page.check('input[type="checkbox"][name="device-select"]');

      // Choose operation
      await page.selectOption('select[name="bulk-operation"]', "restart");

      // Execute bulk operation
      await page.click('button:has-text("Execute")');

      // Verify bulk operation results
      await expect(page.locator("text=Bulk operation completed")).toBeVisible();
    } else {
      test.skip(true, "Bulk operations not available");
    }
  });

  test("should validate device registration form", async ({ page }) => {
    // Navigate to IoT Devices page
    await page.click("text=IoT Devices");
    await page.waitForURL("**/iot-devices");

    // Click Add Device button
    await page.click('button:has-text("Add Device")');

    // Try to submit empty form
    await page.click('button:has-text("Register Device")');

    // Verify validation errors
    await expect(page.locator("text=Device ID is required")).toBeVisible();
    await expect(page.locator("text=Device type is required")).toBeVisible();

    // Fill invalid data
    await page.fill('input[name="deviceId"]', "invalid device id with spaces");
    await page.selectOption('select[name="deviceType"]', "esp32_s3");

    // Submit form
    await page.click('button:has-text("Register Device")');

    // Verify validation for device ID format
    await expect(page.locator("text=Invalid device ID format")).toBeVisible();
  });

  test("should handle device firmware updates", async ({ page }) => {
    // Navigate to IoT Devices page
    await page.click("text=IoT Devices");
    await page.waitForURL("**/iot-devices");

    // Find a device and click firmware update
    const deviceRow = page.locator("tbody tr").first();
    if (await deviceRow.isVisible()) {
      await deviceRow.locator('button:has-text("Update Firmware")').click();

      // Verify firmware update modal
      await expect(page.locator("text=Firmware Update")).toBeVisible();

      // Select firmware version
      await page.selectOption('select[name="firmwareVersion"]', "v1.2.3");

      // Start update
      await page.click('button:has-text("Start Update")');

      // Verify update progress
      await expect(page.locator("text=Update in progress")).toBeVisible();

      // Wait for completion (simulate)
      await page.waitForTimeout(2000);

      // Verify completion
      await expect(
        page.locator("text=Firmware update completed"),
      ).toBeVisible();
    } else {
      test.skip(true, "No devices available for firmware update test");
    }
  });
});
