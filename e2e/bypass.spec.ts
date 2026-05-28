import { test, expect } from "./fixtures";

test("bypass review page loads", async ({ authedPage: page }) => {
  await page.goto("/bypass-review");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("body")).toContainText(/bypass|peserta|tidak ada/i);
});