import { test, expect } from "./fixtures";

const SEED_NAME = process.env.E2E_SEED_NAME || "SEED Adi Pratama";

test("login → dashboard → open seed candidate", async ({ authedPage: page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const row = page.getByRole("row", { name: new RegExp(SEED_NAME, "i") }).first();
  if (await row.count()) {
    await row.click();
  } else {
    await page.goto("/candidates");
    await page.getByPlaceholder(/cari|search/i).first().fill(SEED_NAME);
    await page.getByText(SEED_NAME, { exact: false }).first().click();
  }
  await expect(page.getByText(/EKG/i).first()).toBeVisible();
  await expect(page.getByText(/Rontgen/i).first()).toBeVisible();
});