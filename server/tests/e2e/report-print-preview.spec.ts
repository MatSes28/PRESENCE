import { test, expect } from "@playwright/test";

const E2E_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL || "admin@clirdec.edu";
const E2E_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || "admin123";

test.describe("Report Print Preview", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.fill('input[name="email"]', E2E_EMAIL);
    await page.fill('input[name="password"]', E2E_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard");
  });

  test("shows print report content and hides screen controls", async ({
    page,
  }) => {
    await page.getByText("Reports").click();
    await page.waitForURL("**/reports");

    await expect(page.getByText("Report Filters")).toBeVisible();
    await expect(page.locator(".print-report-brand")).toBeHidden();

    await page.emulateMedia({ media: "print" });

    await expect(page.locator(".print-report-brand")).toHaveText(
      "CLIRDEC:PRESENCE",
    );
    await expect(page.locator(".print-report-table")).toBeVisible();
    await expect(page.getByText("Report Filters")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Generate Report" }),
    ).toBeHidden();
  });
});
