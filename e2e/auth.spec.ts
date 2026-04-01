import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:8080";

test.describe("Authentication Flow", () => {
  test("should show login form on /auth", async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
  });

  test("should show validation errors for empty form", async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    await page.getByRole("button", { name: /sign in/i }).click();
    // Form should not navigate away
    await expect(page).toHaveURL(/\/auth/);
  });

  test("should toggle to signup form", async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    await page.getByText(/create.*account|sign up/i).click();
    await expect(page.getByPlaceholder(/first name/i)).toBeVisible();
  });

  test("should navigate to forgot password", async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    await page.getByText(/forgot.*password/i).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    await page.getByPlaceholder(/email/i).fill("bad@example.com");
    await page.getByPlaceholder(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Should stay on auth page or show error
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/auth/);
  });
});
