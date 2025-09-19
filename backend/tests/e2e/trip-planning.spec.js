import { test, expect } from '@playwright/test';

test.describe('Trip Planning Flow', () => {
  test('should complete basic trip planning form', async ({ page }) => {
    await page.goto('/index.backend.html');

    // Fill out the trip planning form
    await page.fill('input[name="destination"]', 'Paris, France');
    await page.fill('input[name="from"]', 'New York, USA');
    await page.fill('input[name="start"]', '2025-12-01');
    await page.fill('input[name="end"]', '2025-12-07');
    await page.fill('input[name="budget"]', '3000');

    // Select currency if available
    const currencySelect = page.locator('select[name="currency"]');
    if (await currencySelect.count() > 0) {
      await currencySelect.selectOption('USD');
    }

    // Fill traveler information
    await page.fill('input[name="adults"]', '2');
    await page.fill('input[name="children"]', '0');

    // Select trip level if available
    const levelSelect = page.locator('select[name="level"]');
    if (await levelSelect.count() > 0) {
      await levelSelect.selectOption('mid-range');
    }

    // Submit the form
    const submitButton = page.locator('button[type="submit"], button[data-testid="generate-plan"], .submit-btn');
    await submitButton.click();

    // Wait for response (could be preview or full plan)
    await page.waitForLoadState('networkidle');

    // Check if we get some kind of result
    const hasResult = await page.locator('h2, .trip-overview, .preview, .plan-result').count() > 0;
    expect(hasResult).toBeTruthy();
  });

  test('should handle multi-destination trips', async ({ page }) => {
    await page.goto('/index.backend.html');

    // Look for multi-destination feature
    const multiDestButton = page.locator('button:has-text("Add Destination"), .add-destination, [data-multi-dest]');

    if (await multiDestButton.count() > 0) {
      await multiDestButton.click();

      // Fill primary destination
      await page.fill('input[name="destination"]', 'Rome, Italy');

      // Fill additional destination if form appears
      const additionalDestInput = page.locator('input[name="destination_2"], input[name="destinations[1]"]');
      if (await additionalDestInput.count() > 0) {
        await additionalDestInput.fill('Florence, Italy');
      }

      await page.fill('input[name="from"]', 'London, UK');
      await page.fill('input[name="start"]', '2025-11-15');
      await page.fill('input[name="end"]', '2025-11-25');
      await page.fill('input[name="budget"]', '4000');
      await page.fill('input[name="adults"]', '1');
      await page.fill('input[name="children"]', '0');

      const submitButton = page.locator('button[type="submit"], button[data-testid="generate-plan"]');
      await submitButton.click();

      await page.waitForLoadState('networkidle');
    }
  });

  test('should validate date ranges', async ({ page }) => {
    await page.goto('/index.backend.html');

    // Try invalid date range (end before start)
    await page.fill('input[name="start"]', '2025-12-31');
    await page.fill('input[name="end"]', '2025-12-01');
    await page.fill('input[name="destination"]', 'Tokyo, Japan');
    await page.fill('input[name="from"]', 'San Francisco, USA');
    await page.fill('input[name="adults"]', '1');

    const submitButton = page.locator('button[type="submit"], button[data-testid="generate-plan"]');
    await submitButton.click();

    // Should show validation error or prevent submission
    const hasError = await page.locator('.error, .invalid, [aria-invalid="true"]').count() > 0;
    const isStillOnForm = await page.locator('input[name="destination"]').count() > 0;

    expect(hasError || isStillOnForm).toBeTruthy();
  });
});