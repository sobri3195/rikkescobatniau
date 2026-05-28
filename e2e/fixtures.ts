import { test as base, expect, type Page } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL || "tester@rikkes.test";
const PASSWORD = process.env.E2E_PASSWORD || "Tester#2026!";

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password|kata sandi/i).fill(PASSWORD);
  await page.getByRole("button", { name: /masuk|sign in|login/i }).click();
  await page.waitForURL((url) => !/\/login$/.test(url.pathname), { timeout: 20_000 });
}

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await login(page);
    await use(page);
  },
});

export { expect };