import { expect, type Page } from "@playwright/test";

export const E2E_EMAIL =
  process.env.PLAYWRIGHT_TEST_EMAIL || "admin@clirdec.edu";
export const E2E_PASSWORD =
  process.env.PLAYWRIGHT_TEST_PASSWORD || "admin123";

export async function loginAsAdmin(page: Page) {
  await page.goto("/login");

  await page.fill('input[name="email"]', E2E_EMAIL);
  await page.fill('input[name="password"]', E2E_PASSWORD);
  await page.waitForTimeout(5200);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.click('button[type="submit"]');
    await page.waitForTimeout(500);

    if (
      await page
        .getByRole("heading", { name: "Dashboard", exact: true })
        .isVisible()
    ) {
      break;
    }

    const duplicateGuard = page.getByText(
      "Duplicate request detected, please wait before retrying.",
    );
    if (!(await duplicateGuard.isVisible())) {
      break;
    }
    await page.waitForTimeout(5200);
  }

  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
}

export async function gotoRoute(page: Page, route: string, heading: string) {
  await page.goto(route);
  await expect(
    page.getByRole("heading", { name: heading, exact: true }),
  ).toBeVisible();
}
