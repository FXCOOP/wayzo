import { test, expect } from '@playwright/test';

test.describe('Responsive Design Tests', () => {
  const viewports = [
    { name: 'Mobile Portrait', width: 375, height: 667 },
    { name: 'Mobile Landscape', width: 667, height: 375 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Desktop', width: 1920, height: 1080 },
  ];

  viewports.forEach(({ name, width, height }) => {
    test(`should display correctly on ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');

      // Check that main form elements are visible and accessible
      await expect(page.locator('input[name="destination"]')).toBeVisible();
      await expect(page.locator('input[name="from"]')).toBeVisible();

      // Check that text is readable (not overlapping)
      const titleElement = page.locator('h1').first();
      if (await titleElement.count() > 0) {
        const boundingBox = await titleElement.boundingBox();
        expect(boundingBox?.width).toBeGreaterThan(0);
        expect(boundingBox?.height).toBeGreaterThan(0);
      }

      // Check for mobile menu or navigation elements on smaller screens
      if (width <= 768) {
        const mobileNav = page.locator('.mobile-menu, .hamburger, .nav-toggle, [data-mobile-nav]');
        // Mobile nav might or might not be present, but if it is, it should be visible
        if (await mobileNav.count() > 0) {
          await expect(mobileNav.first()).toBeVisible();
        }
      }

      // Ensure form is usable by testing interaction
      await page.fill('input[name="destination"]', 'Test City');
      const inputValue = await page.locator('input[name="destination"]').inputValue();
      expect(inputValue).toBe('Test City');
    });
  });

  test('should handle touch interactions on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Test touch interactions
    const submitButton = page.locator('button[type="submit"], .submit-btn').first();
    if (await submitButton.count() > 0) {
      // Simulate touch
      await submitButton.tap();
    }

    // Test scrolling behavior
    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });

    await page.waitForTimeout(500);

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });

  test('should maintain functionality across different screen sizes', async ({ page }) => {
    // Test on mobile first
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await page.fill('input[name="destination"]', 'Madrid, Spain');
    await page.fill('input[name="from"]', 'Barcelona, Spain');

    // Switch to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Verify form data persisted
    const destValue = await page.locator('input[name="destination"]').inputValue();
    const fromValue = await page.locator('input[name="from"]').inputValue();

    expect(destValue).toBe('Madrid, Spain');
    expect(fromValue).toBe('Barcelona, Spain');

    // Fill remaining fields on desktop
    await page.fill('input[name="start"]', '2025-10-15');
    await page.fill('input[name="end"]', '2025-10-20');
    await page.fill('input[name="adults"]', '2');

    // Test form submission
    const submitButton = page.locator('button[type="submit"], button[data-testid="generate-plan"]');
    if (await submitButton.count() > 0) {
      await submitButton.click();
      await page.waitForLoadState('networkidle');
    }
  });
});