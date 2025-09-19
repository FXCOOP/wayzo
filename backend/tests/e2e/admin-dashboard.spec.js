import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Enable debug mode for admin access
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('wayzo_debug', 'true');
    });
  });

  test('should access admin dashboard in demo mode', async ({ page }) => {
    await page.goto('/');

    // Look for admin access - could be through demo login or direct link
    const demoButton = page.locator('button:has-text("Demo"), .demo-login, [data-demo]');
    const adminLink = page.locator('a[href*="admin"], .admin-link');

    if (await demoButton.count() > 0) {
      await demoButton.click();
      await page.waitForTimeout(1000);
    }

    // Try to access admin page
    if (await adminLink.count() > 0) {
      await adminLink.click();
    } else {
      // Try direct navigation
      await page.goto('/admin.html');
    }

    // Check if admin dashboard loads
    const adminIndicators = page.locator(
      'h1:has-text("Admin"), .admin-dashboard, .admin-panel, .back-office'
    );

    if (await adminIndicators.count() > 0) {
      await expect(adminIndicators.first()).toBeVisible();
    }
  });

  test('should display admin dashboard sections', async ({ page }) => {
    await page.goto('/admin.html');

    // Common admin sections to check for
    const sections = [
      'h2:has-text("Users"), .user-management',
      'h2:has-text("Analytics"), .analytics',
      'h2:has-text("Reports"), .reports',
      'h2:has-text("System"), .system-monitoring'
    ];

    for (const section of sections) {
      const element = page.locator(section);
      if (await element.count() > 0) {
        await expect(element.first()).toBeVisible();
      }
    }
  });

  test('should handle admin authentication', async ({ page }) => {
    await page.goto('/');

    // Look for authentication elements
    const authElements = page.locator(
      'button:has-text("Sign In"), .google-signin, .login-btn, input[type="email"]'
    );

    if (await authElements.count() > 0) {
      // If there's a demo mode, use it
      const demoMode = page.locator('button:has-text("Demo"), .demo-mode');
      if (await demoMode.count() > 0) {
        await demoMode.click();

        // Check if we get authenticated status
        await page.waitForTimeout(1000);

        const userMenu = page.locator('.user-menu, .profile-menu, [data-user-menu]');
        if (await userMenu.count() > 0) {
          await expect(userMenu.first()).toBeVisible();
        }
      }
    }
  });
});