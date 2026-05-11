import { test, expect } from "@playwright/test";
import { gotoRoute, loginAsAdmin } from "./helpers";

test.describe("Reporting Workflow E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await gotoRoute(page, "/reports", "Attendance Reports");
  });

  test("should render the reporting workspace", async ({ page }) => {
    await expect(page.getByText("Report Filters", { exact: true })).toBeVisible();
    await expect(page.getByText("Live Report Preview")).toBeVisible();
    await expect(page.getByText("Report History", { exact: true })).toBeVisible();
    await expect(page.getByText("Scheduled Reports", { exact: true })).toBeVisible();
  });

  test("should expose report filters and export controls", async ({ page }) => {
    await expect(page.locator('select[name="dateRangePreset"]')).toBeVisible();
    await expect(page.locator('input[name="startDate"]')).toBeVisible();
    await expect(page.locator('input[name="endDate"]')).toBeVisible();
    await expect(page.locator('select[name="subjectId"]')).toBeVisible();
    await expect(page.locator('select[name="classroomId"]')).toBeVisible();
    await expect(page.locator('select[name="type"]')).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Generate Report" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Raw CSV" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Styled Excel" })).toBeVisible();
    await expect(page.getByRole("button", { name: "PDF" })).toBeVisible();
  });

  test("should validate invalid custom date ranges", async ({ page }) => {
    await page.fill('input[name="startDate"]', "2026-12-31");
    await page.fill('input[name="endDate"]', "2026-01-01");

    await expect(
      page.getByText("Start date must be before or equal to end date."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Generate Report" }),
    ).toBeDisabled();
  });

  test("should change report type without breaking preview", async ({ page }) => {
    await page.selectOption('select[name="type"]', "students");
    await expect(page.locator('select[name="type"]')).toHaveValue("students");
    await expect(page.getByText("Live Report Preview")).toBeVisible();

    await page.selectOption('select[name="type"]', "classroom");
    await expect(page.locator('select[name="type"]')).toHaveValue("classroom");
    await expect(page.getByText("Live Report Preview")).toBeVisible();
  });

  test("should expose scheduled report controls", async ({ page }) => {
    await expect(page.getByText("Scheduled Reports", { exact: true })).toBeVisible();
    await expect(page.locator("#schedule-preset")).toBeVisible();
    await expect(page.locator('input[placeholder="Monday Attendance Email"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Schedule" })).toBeVisible();
  });

  test("should expose report history controls", async ({ page }) => {
    await expect(page.getByText("Report History", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export History CSV" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh" }).last()).toBeVisible();
  });
});
