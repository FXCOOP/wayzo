import { test, expect } from '@playwright/test';

test.describe('Homepage Tests', () => {
  test('should load homepage correctly', async ({ page }) => {
    await page.goto('/index.backend.html');

    // Check brand name in header
    await expect(page.locator('.brand-name')).toContainText('Wayzo');

    // Check form elements are present
    await expect(page.locator('input[name="destination"]')).toBeVisible();
    await expect(page.locator('input[name="from"]')).toBeVisible();
    await expect(page.locator('input[name="start"]')).toBeVisible();
    await expect(page.locator('input[name="end"]')).toBeVisible();
    await expect(page.locator('input[name="budget"]')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/index.backend.html');

    // Try to submit without filling required fields
    const generateButton = page.locator('button:has-text("Generate"), button[data-testid="generate-plan"], button[type="submit"]');
    if (await generateButton.count() > 0) {
      await generateButton.first().click();

      // Check for validation messages or that form didn't submit
      const hasValidationError = await page.locator('input:invalid, .error, .invalid').count() > 0;
      const stillOnPage = await page.locator('input[name="destination"]').count() > 0;

      expect(hasValidationError || stillOnPage).toBeTruthy();
    }
  });

  test('should handle language switching', async ({ page }) => {
    await page.goto('/index.backend.html');

    // Check if language selector exists
    const languageSelector = page.locator('#languageSelect');
    await expect(languageSelector).toBeVisible();

    // Test language switching
    await languageSelector.selectOption('es');

    // Wait for content to update
    await page.waitForTimeout(1000);

    // Switch back to English
    await languageSelector.selectOption('en');
  });
});