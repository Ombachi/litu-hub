import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:8080";

test.describe("Assignment Flow", () => {
  test("assignments page requires authentication", async ({ page }) => {
    await page.goto(`${BASE}/assignments`);
    await expect(page).toHaveURL(/\/auth/);
  });
});
