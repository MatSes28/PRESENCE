import { test, expect } from "@playwright/test";
import { gotoRoute, loginAsAdmin } from "./helpers";

test.describe("Report Print Preview", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("shows print report content and hides screen controls", async ({
    page,
  }) => {
    await gotoRoute(page, "/reports", "Attendance Reports");

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
