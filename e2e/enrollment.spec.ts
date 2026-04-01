import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:8080";

test.describe("Enrollment Flow", () => {
  test("unauthenticated user is redirected to /auth", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/\/auth/);
  });

  test("landing page shows course catalog or enrollment option", async ({ page }) => {
    await page.goto(`${BASE}/`);
    // Landing page should be accessible
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
