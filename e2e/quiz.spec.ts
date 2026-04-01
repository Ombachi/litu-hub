import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:8080";

test.describe("Quiz Flow", () => {
  test("quiz page requires authentication", async ({ page }) => {
    await page.goto(`${BASE}/quizzes`);
    await expect(page).toHaveURL(/\/auth/);
  });
});
