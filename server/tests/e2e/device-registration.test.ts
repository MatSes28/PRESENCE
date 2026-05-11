import { test, expect } from "@playwright/test";
import { gotoRoute, loginAsAdmin } from "./helpers";

test.describe("Device Registration E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("should complete full device registration workflow", async ({
    page,
  }) => {
    await gotoRoute(page, "/iot", "IoT Device Management");

    // Click Add Device button
    await page.getByRole("button", { name: "Register Device" }).first().click();

    // Fill device registration form
    const deviceId = `E2E_TEST_DEVICE_${Date.now()}`;
    await page.fill('input[name="deviceId"]', deviceId);
    await page.selectOption('select[name="deviceType"]', "esp32_s3");
    await page.selectOption('select[name="classroomId"]', { index: 1 });

    // Submit form
    await page.getByRole("button", { name: "Register Device" }).last().click();

    // Verify success notification
    await expect(
      page.getByText("Device Registered", { exact: true }),
    ).toBeVisible();

    // Verify device appears on the page
    await expect(
      page.getByRole("heading", { name: deviceId, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("ESP32-S3").first()).toBeVisible();
  });

  test("should handle device discovery and registration", async ({ page }) => {
    await gotoRoute(page, "/iot", "IoT Device Management");

    // Click Network Discovery button
    const discoveryButton = page.getByRole("button", {
      name: "Network Discovery",
    });
    if (!(await discoveryButton.isVisible())) {
      test.skip(true, "Network discovery is not exposed in the current UI");
    }
    await discoveryButton.click();

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
    await gotoRoute(page, "/iot", "IoT Device Management");

    // Find a device in the table (assuming one exists)
    const configureButton = page.getByRole("button", { name: "Configure" }).first();
    if (await configureButton.isVisible()) {
      // Click configure button
      await configureButton.click();

      // Verify configuration modal opens
      await expect(
        page.getByText("Configuration", { exact: true }).last(),
      ).toBeVisible();

      // Update configuration
      await page.fill('input[name="heartbeatInterval"]', "30000");

      // Save configuration
      await page.getByRole("button", { name: "Update Configuration" }).click();

      // Verify success
      await expect(
        page.getByText("Configuration Updated", { exact: true }),
      ).toBeVisible();
    } else {
      test.skip(true, "No devices available for configuration test");
    }
  });

  test("should monitor device health", async ({ page }) => {
    await gotoRoute(page, "/iot", "IoT Device Management");

    // Find a device and click health check
    const diagnosticsButton = page.getByRole("button", { name: "Diagnostics" }).first();
    if (await diagnosticsButton.isVisible()) {
      await diagnosticsButton.click();
      await expect(page.getByText("Command Sent").first()).toBeVisible();
    } else {
      test.skip(true, "No devices available for health check test");
    }
  });

  test("should handle device commands", async ({ page }) => {
    await gotoRoute(page, "/iot", "IoT Device Management");

    // Find a device and click commands
    const pingButton = page.getByRole("button", { name: "Ping" }).first();
    if (await pingButton.isVisible()) {
      // Send ping command
      await pingButton.click();

      // Verify command response
      await expect(page.getByText("Command Sent").first()).toBeVisible();

      // Send restart command
      await page.getByRole("button", { name: "Restart" }).first().click();
      await expect(page.getByText("Command Sent").first()).toBeVisible();
    } else {
      test.skip(true, "No devices available for command test");
    }
  });

  test("should display device status indicators", async ({ page }) => {
    await gotoRoute(page, "/iot", "IoT Device Management");

    // Verify status indicators are present
    await expect(page.getByText("Total Devices", { exact: true })).toBeVisible();
    await expect(page.getByText("Online", { exact: true })).toBeVisible();
    await expect(page.getByText("Offline", { exact: true })).toBeVisible();
    await expect(page.getByText("Maintenance", { exact: true })).toBeVisible();
  });

  test("should handle bulk device operations", async ({ page }) => {
    await gotoRoute(page, "/iot", "IoT Device Management");

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
    await gotoRoute(page, "/iot", "IoT Device Management");

    // Click Add Device button
    await page.getByRole("button", { name: "Register Device" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Register IoT Device" }),
    ).toBeVisible();

    // Fill invalid data
    await page.fill('input[name="deviceId"]', "invalid device id with spaces");
    await page.selectOption('select[name="classroomId"]', { index: 1 });
    await page.selectOption('select[name="deviceType"]', "esp32_s3");

    // Submit form
    await page.getByRole("button", { name: "Register Device" }).last().click();

    // Verify validation for device ID format
    await expect(page.getByText("Invalid Device ID")).toBeVisible();
  });

  test("should handle device firmware updates", async ({ page }) => {
    await gotoRoute(page, "/iot", "IoT Device Management");

    // Find a device and click firmware update
    const firmwareButton = page.getByRole("button", { name: "Update Firmware" }).first();
    if (await firmwareButton.isVisible()) {
      await firmwareButton.click();

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
