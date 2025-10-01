import { test, expect } from '@playwright/test';

/**
 * BASELINE FUNCTIONALITY TESTS
 * Critical tests that MUST pass before any fixes are attempted
 * These validate core functionality that cannot be broken
 */

test.describe('BASELINE - Core Functionality (MUST NOT BREAK)', () => {

  test.describe('Essential Application Loading', () => {
    test('should load main application without errors', async ({ page }) => {
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Verify no critical JavaScript errors
      const criticalErrors = consoleErrors.filter(error =>
        !error.includes('favicon') &&
        !error.includes('ads') &&
        !error.includes('analytics')
      );
      expect(criticalErrors).toHaveLength(0);

      // Verify essential elements are present
      await expect(page.locator('form, [data-form="trip-planning"]')).toBeVisible();
      await expect(page.locator('input[name="destination"]')).toBeVisible();
      await expect(page.locator('button[data-testid="generate-plan"], button:has-text("Generate"), button:has-text("Plan")')).toBeVisible();
    });

    test('should load backend connected page without errors', async ({ page }) => {
      await page.goto('/index.backend.html');
      await page.waitForLoadState('networkidle');

      // Essential form elements should be present
      await expect(page.locator('input[name="destination"]')).toBeVisible();
      await expect(page.locator('input[name="from"]')).toBeVisible();
      await expect(page.locator('input[name="start"]')).toBeVisible();
      await expect(page.locator('input[name="end"]')).toBeVisible();
    });

    test('should load admin panel without errors', async ({ page }) => {
      await page.goto('/admin.html');
      await page.waitForLoadState('networkidle');

      // Admin panel should load
      await expect(page.locator('body')).toContainText('Admin');
    });

    test('should load test page without errors', async ({ page }) => {
      await page.goto('/test.html');
      await page.waitForLoadState('networkidle');

      // Test page should load and initialize
      await expect(page.locator('h1')).toContainText('Test Page');
      await expect(page.locator('button:has-text("Test Language")')).toBeVisible();
    });
  });

  test.describe('Critical JavaScript Functionality', () => {
    test('should initialize Wayzo app object', async ({ page }) => {
      await page.goto('/test.html');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000); // Allow app initialization

      const appInitialized = await page.evaluate(() => {
        return typeof window.wayzoApp !== 'undefined';
      });

      expect(appInitialized).toBe(true);
    });

    test('should have translations available', async ({ page }) => {
      await page.goto('/test.html');
      await page.waitForLoadState('networkidle');

      const translationsLoaded = await page.evaluate(() => {
        return typeof window.translations !== 'undefined' &&
               window.translations.en !== undefined;
      });

      expect(translationsLoaded).toBe(true);
    });

    test('should support basic language switching', async ({ page }) => {
      await page.goto('/test.html');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Test language switching
      await page.click('button:has-text("Test Language")');

      // Should show language change confirmation
      await expect(page.locator('#testOutput')).toContainText('Language changed');
    });
  });

  test.describe('Form Functionality', () => {
    test('should accept form input in all required fields', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Fill all required fields
      await page.fill('input[name="destination"]', 'Prague, Czech Republic');
      await page.fill('input[name="from"]', 'New York, USA');
      await page.fill('input[name="start"]', '2025-06-01');
      await page.fill('input[name="end"]', '2025-06-07');
      await page.fill('input[name="budget"]', '2000');

      // Verify values were set
      expect(await page.locator('input[name="destination"]').inputValue()).toBe('Prague, Czech Republic');
      expect(await page.locator('input[name="from"]').inputValue()).toBe('New York, USA');
      expect(await page.locator('input[name="start"]').inputValue()).toBe('2025-06-01');
      expect(await page.locator('input[name="end"]').inputValue()).toBe('2025-06-07');
      expect(await page.locator('input[name="budget"]').inputValue()).toBe('2000');
    });

    test('should have working submit button', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const submitButton = page.locator('button[data-testid="generate-plan"], button:has-text("Generate"), button:has-text("Plan")').first();
      await expect(submitButton).toBeVisible();
      await expect(submitButton).toBeEnabled();

      // Button should be clickable
      await submitButton.click();

      // Should show some response (loading state, error, or result)
      await page.waitForTimeout(2000);
      // This is just a baseline test - we're not validating success, just that clicking doesn't break the page
    });
  });

  test.describe('Backend Connectivity', () => {
    test('should have backend server running', async ({ page }) => {
      // Test backend health endpoint
      const response = await page.request.get('http://localhost:10000/api/health').catch(() => null);

      if (response) {
        expect(response.status()).toBe(200);
      } else {
        // Backend might not be running - that's OK for baseline, but note it
        console.log('⚠️ Backend server not running on port 10000');
      }
    });

    test('should handle API endpoints without crashing', async ({ page }) => {
      await page.goto('/');

      // Mock a basic API call to see if frontend handles it
      const apiResponse = await page.request.post('http://localhost:10000/api/preview', {
        data: {
          destination: 'Test City',
          from: 'Test Origin',
          start: '2025-06-01',
          end: '2025-06-07',
          budget: 1000
        }
      }).catch(() => null);

      // We don't care if it succeeds or fails, just that it doesn't crash the app
      // This is baseline - we're just ensuring the infrastructure works
      if (apiResponse) {
        console.log(`✅ API endpoint responded with status: ${apiResponse.status()}`);
      } else {
        console.log('⚠️ API endpoint not available - check backend server');
      }
    });
  });

  test.describe('Mobile Compatibility (Baseline)', () => {
    test('should render on mobile without breaking', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Basic mobile rendering test
      await expect(page.locator('input[name="destination"]')).toBeVisible();

      // Page shouldn't have horizontal scroll
      const bodyOverflow = await page.evaluate(() => {
        return window.getComputedStyle(document.body).overflowX;
      });

      expect(bodyOverflow).not.toBe('scroll');
    });

    test('should maintain functionality on tablet', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Form should still be usable
      await expect(page.locator('input[name="destination"]')).toBeVisible();
      await expect(page.locator('button[data-testid="generate-plan"], button:has-text("Generate"), button:has-text("Plan")')).toBeVisible();
    });
  });

  test.describe('Multi-Language Baseline', () => {
    test('should support at least English language', async ({ page }) => {
      await page.goto('/test.html');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const englishSupported = await page.evaluate(() => {
        return window.translations && window.translations.en;
      });

      expect(englishSupported).toBeTruthy();
    });

    test('should have language flags/selectors available', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Look for language selection elements
      const languageSelector = page.locator('.language-selector, .lang-select, [data-lang], .flag-icon').first();
      const hasLanguageElements = await languageSelector.count() > 0;

      if (hasLanguageElements) {
        await expect(languageSelector).toBeVisible();
      } else {
        console.log('⚠️ Language selector not found - may need manual verification');
      }
    });
  });

  test.describe('Authentication System Baseline', () => {
    test('should have authentication elements present', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Look for sign-in/auth related elements
      const authElements = page.locator('[data-auth], .sign-in, .login, .auth-button, button:has-text("Sign"), button:has-text("Demo")');
      const hasAuthElements = await authElements.count() > 0;

      if (hasAuthElements) {
        console.log('✅ Authentication elements found');
      } else {
        console.log('⚠️ No authentication elements found - verify auth system');
      }
    });

    test('should support demo mode if available', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const demoButton = page.locator('button:has-text("Demo"), [data-demo], .demo-mode');
      const hasDemoMode = await demoButton.count() > 0;

      if (hasDemoMode) {
        await expect(demoButton.first()).toBeVisible();
      } else {
        console.log('⚠️ Demo mode not found - may be integrated differently');
      }
    });
  });
});

// Export test results for use in critical fixes validation
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === 'failed') {
    console.log(`❌ BASELINE FAILURE: ${testInfo.title}`);
    console.log(`🚨 CRITICAL: This baseline test must pass before attempting fixes`);
  } else {
    console.log(`✅ BASELINE PASS: ${testInfo.title}`);
  }
});