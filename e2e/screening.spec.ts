import { test, expect } from "./fixtures";

const SEED_NAME = process.env.E2E_SEED_NAME || "SEED Adi Pratama";

test("screening Hari-H sanity validation rejects unrealistic TB", async ({ authedPage: page }) => {
  await page.goto("/candidates");
  await page.getByPlaceholder(/cari|search/i).first().fill(SEED_NAME).catch(() => {});
  await page.getByText(SEED_NAME, { exact: false }).first().click();

  const screeningTab = page.getByRole("tab", { name: /screening hari-h/i });
  if (await screeningTab.count()) await screeningTab.click();

  await page.getByLabel(/tinggi badan/i).first().fill("50");
  await page.getByLabel(/berat badan/i).first().fill("70");

  await expect(page.getByText(/di luar rentang wajar/i).first()).toBeVisible({ timeout: 5000 });

  const submit = page.getByRole("button", { name: /^submit$/i }).first();
  await expect(submit).toBeDisabled();
});