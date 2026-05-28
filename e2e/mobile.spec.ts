import { test, expect } from "./fixtures";

test("candidates list has no horizontal overflow on mobile", async ({ authedPage: page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile", "mobile-only test");
  await page.goto("/candidates");
  await expect(page.locator("body")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow).toBeFalsy();
});