import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:8080";

test.describe("Grading Flow", () => {
  test("grading page requires authentication", async ({ page }) => {
    await page.goto(`${BASE}/grading`);
    await expect(page).toHaveURL(/\/auth/);
  });
});
