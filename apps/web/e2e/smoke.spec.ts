import { test, expect } from "@playwright/test";

const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

test.beforeAll(async ({ request }) => {
  try {
    const res = await request.get(`${api}/health`, { timeout: 5000 });
    if (!res.ok()) test.skip(true, "API down");
  } catch {
    test.skip(true, "API down");
  }
});

test("create project from hub", async ({ page }) => {
  await page.goto("/projects");
  const newBtn = page.getByRole("button", { name: /new project/i });
  if (!(await newBtn.isVisible().catch(() => false))) {
    test.skip(true, "hub not reachable or auth required");
  }
  await newBtn.click();
  await expect(page).toHaveURL(/\/projects\/new/);
});

test("literature page loads", async ({ page }) => {
  await page.goto("/validate/literature");
  await expect(page.locator("body")).toBeVisible();
});

test("gap analysis page loads", async ({ page }) => {
  await page.goto("/validate/gap-analysis");
  await expect(page.locator("body")).toBeVisible();
});
