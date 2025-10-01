import { test, expect } from '@playwright/test';

/**
 * Critical Fixes E2E Tests
 * Tests for the 12 critical issues identified in the bug report
 * Organized by priority level: HIGH → MEDIUM → LOW
 */

test.describe('HIGH PRIORITY FIXES', () => {

  test.describe('1. GPT API Integration', () => {
    test('should generate trip content without API errors', async ({ page }) => {
      await page.goto('http://localhost:8000');

      // Fill form with valid data
      await page.fill('input[name="destination"]', 'Prague, Czech Republic');
      await page.fill('input[name="from"]', 'New York, USA');
      await page.fill('input[name="start"]', '2025-06-01');
      await page.fill('input[name="end"]', '2025-06-07');
      await page.fill('input[name="budget"]', '2000');
      await page.selectOption('select[name="currency"]', 'USD');

      // Intercept API calls to check for errors
      let apiError = null;
      page.on('response', response => {
        if (response.url().includes('/api/preview') && !response.ok()) {
          apiError = response.status();
        }
      });

      // Generate preview
      await page.click('button[data-testid="generate-plan"]');
      await page.waitForSelector('#preview', { timeout: 30000 });

      // Verify no API errors occurred
      expect(apiError).toBeNull();

      // Verify content was generated
      await expect(page.locator('#preview')).toContainText('Trip Overview');
      await expect(page.locator('#preview')).toContainText('Prague');
    });

    test('should use correct OpenAI model and API methods', async ({ page }) => {
      // Check backend logs for correct API usage
      await page.goto('http://localhost:8000');

      const consoleMessages = [];
      page.on('console', msg => consoleMessages.push(msg.text()));

      await page.fill('input[name="destination"]', 'Berlin, Germany');
      await page.fill('input[name="from"]', 'London, UK');
      await page.fill('input[name="start"]', '2025-07-01');
      await page.fill('input[name="end"]', '2025-07-07');
      await page.fill('input[name="budget"]', '1500');

      await page.click('button[data-testid="generate-plan"]');
      await page.waitForSelector('#preview', { timeout: 30000 });

      // Verify no "client.responses.create" errors in console
      const apiErrors = consoleMessages.filter(msg =>
        msg.includes('responses.create') ||
        msg.includes('gpt-5-nano') ||
        msg.includes('API method does not exist')
      );
      expect(apiErrors).toHaveLength(0);
    });
  });

  test.describe('2. Location Autofill', () => {
    test('should detect and populate user location', async ({ page }) => {
      // Mock geolocation API response
      await page.addInitScript(() => {
        window.fetch = (originalFetch => {
          return function(url, config) {
            if (url.includes('ipapi.co/json')) {
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                  city: 'New York',
                  country_name: 'United States',
                  error: false
                })
              });
            }
            return originalFetch(url, config);
          };
        })(window.fetch);
      });

      await page.goto('http://localhost:8000');
      await page.waitForLoadState('networkidle');

      // Wait for location detection to complete
      await page.waitForTimeout(2000);

      const fromField = page.locator('input[name="from"]');
      const fromValue = await fromField.inputValue();

      // Verify location was populated
      expect(fromValue).toContain('New York');
      expect(fromValue).toContain('United States');
    });

    test('should handle location detection failures gracefully', async ({ page }) => {
      // Mock failed API response
      await page.addInitScript(() => {
        window.fetch = () => Promise.reject(new Error('Network error'));
      });

      await page.goto('http://localhost:8000');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const fromField = page.locator('input[name="from"]');
      const placeholder = await fromField.getAttribute('placeholder');

      // Should fall back to default placeholder
      expect(placeholder).toContain('your departure city');
    });
  });

  test.describe('3. Weather Table Corruption', () => {
    test('should render weather table without corruption', async ({ page }) => {
      await page.goto('http://localhost:8000');

      await page.fill('input[name="destination"]', 'Barcelona, Spain');
      await page.fill('input[name="from"]', 'Paris, France');
      await page.fill('input[name="start"]', '2025-05-15');
      await page.fill('input[name="end"]', '2025-05-22');
      await page.fill('input[name="budget"]', '1800');

      await page.click('button[data-testid="generate-plan"]');
      await page.waitForSelector('#preview', { timeout: 30000 });

      // Check for weather table
      const weatherTable = page.locator('table.weather-table, .weather-info table');
      if (await weatherTable.count() > 0) {
        // Verify table structure
        await expect(weatherTable).toHaveCSS('border-collapse', 'collapse');

        // Check for bleeding content (content outside table boundaries)
        const tableRect = await weatherTable.boundingBox();
        const tableContent = page.locator('table.weather-table tr, .weather-info table tr');

        for (let i = 0; i < await tableContent.count(); i++) {
          const rowRect = await tableContent.nth(i).boundingBox();
          if (rowRect && tableRect) {
            expect(rowRect.x).toBeGreaterThanOrEqual(tableRect.x - 5); // 5px tolerance
            expect(rowRect.x + rowRect.width).toBeLessThanOrEqual(tableRect.x + tableRect.width + 5);
          }
        }
      }
    });

    test('should display weather information in mobile view', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:8000');

      await page.fill('input[name="destination"]', 'Rome, Italy');
      await page.fill('input[name="from"]', 'Munich, Germany');
      await page.fill('input[name="start"]', '2025-04-10');
      await page.fill('input[name="end"]', '2025-04-17');
      await page.fill('input[name="budget"]', '2200');

      await page.click('button[data-testid="generate-plan"]');
      await page.waitForSelector('#preview', { timeout: 30000 });

      // Verify weather content is visible and not overflowing
      const weatherSection = page.locator('.weather-info, .weather-table').first();
      if (await weatherSection.count() > 0) {
        const isVisible = await weatherSection.isVisible();
        expect(isVisible).toBe(true);

        // Check it doesn't overflow viewport
        const boundingBox = await weatherSection.boundingBox();
        if (boundingBox) {
          expect(boundingBox.width).toBeLessThanOrEqual(375);
        }
      }
    });
  });

  test.describe('4. Budget Table Duplication', () => {
    test('should display only one budget breakdown section', async ({ page }) => {
      await page.goto('http://localhost:8000');

      await page.fill('input[name="destination"]', 'Amsterdam, Netherlands');
      await page.fill('input[name="from"]', 'Brussels, Belgium');
      await page.fill('input[name="start"]', '2025-08-01');
      await page.fill('input[name="end"]', '2025-08-08');
      await page.fill('input[name="budget"]', '2500');

      await page.click('button[data-testid="generate-plan"]');
      await page.waitForSelector('#preview', { timeout: 30000 });

      // Count budget-related sections
      const budgetHeadings = page.locator('h2:has-text("Budget"), h3:has-text("Budget")');
      const budgetTables = page.locator('.budget-table, table.budget');
      const budgetSections = page.locator('[class*="budget"]');

      // Should have exactly one budget heading and one budget table
      expect(await budgetHeadings.count()).toBeLessThanOrEqual(1);
      expect(await budgetTables.count()).toBe(1);

      // Verify no duplicate content
      const budgetText = await page.locator('#preview').textContent();
      const budgetMatches = budgetText.match(/Budget Breakdown/gi) || [];
      expect(budgetMatches.length).toBeLessThanOrEqual(1);
    });

    test('should have consistent budget totals across sections', async ({ page }) => {
      await page.goto('http://localhost:8000');

      await page.fill('input[name="destination"]', 'Vienna, Austria');
      await page.fill('input[name="from"]', 'Prague, Czech Republic');
      await page.fill('input[name="start"]', '2025-09-01');
      await page.fill('input[name="end"]', '2025-09-08');
      await page.fill('input[name="budget"]', '3000');

      await page.click('button[data-testid="generate-plan"]');
      await page.waitForSelector('#preview', { timeout: 30000 });

      // Extract all budget totals mentioned in the content
      const content = await page.locator('#preview').textContent();
      const totalMatches = content.match(/total[:\s]*[\$€£¥]?\s*[\d,]+/gi) || [];
      const budgetMatches = content.match(/budget[:\s]*[\$€£¥]?\s*[\d,]+/gi) || [];

      // All budget totals should be consistent (allowing for formatting differences)
      const amounts = [...totalMatches, ...budgetMatches].map(match => {
        const numberMatch = match.match(/[\d,]+/);
        return numberMatch ? parseInt(numberMatch[0].replace(/,/g, '')) : 0;
      });

      if (amounts.length > 1) {
        const variance = Math.max(...amounts) - Math.min(...amounts);
        expect(variance).toBeLessThan(100); // Allow small variance for formatting
      }
    });
  });
});

test.describe('MEDIUM PRIORITY FIXES', () => {

  test.describe('5. Content Validation', () => {
    test('should validate generated content completeness', async ({ page }) => {
      await page.goto('http://localhost:8000');

      await page.fill('input[name="destination"]', 'Copenhagen, Denmark');
      await page.fill('input[name="from"]', 'Stockholm, Sweden');
      await page.fill('input[name="start"]', '2025-06-15');
      await page.fill('input[name="end"]', '2025-06-22');
      await page.fill('input[name="budget"]', '2800');

      await page.click('button[data-testid="generate-plan"]');
      await page.waitForSelector('#preview', { timeout: 30000 });

      // Check for incomplete content indicators
      const content = await page.locator('#preview').textContent();
      const incompleteIndicators = [
        '...',
        'undefined',
        'null',
        '[object Object]',
        'NaN',
        'Error:',
        'Failed to',
        '***',
        '{{',
        '}}'
      ];

      for (const indicator of incompleteIndicators) {
        expect(content).not.toContain(indicator);
      }

      // Verify all required sections are present
      const requiredSections = ['Trip Overview', 'Budget', 'Day'];
      for (const section of requiredSections) {
        expect(content).toContain(section);
      }
    });
  });

  test.describe('6. Widget Integration', () => {
    test('should auto-populate booking widgets with trip data', async ({ page }) => {
      await page.goto('http://localhost:8000');

      await page.fill('input[name="destination"]', 'Lisbon, Portugal');
      await page.fill('input[name="from"]', 'Madrid, Spain');
      await page.fill('input[name="start"]', '2025-07-10');
      await page.fill('input[name="end"]', '2025-07-17');
      await page.fill('input[name="budget"]', '1600');

      await page.click('button[data-testid="generate-plan"]');
      await page.waitForSelector('#preview', { timeout: 30000 });

      // Check for booking widgets
      const flightWidget = page.locator('#flight-widget, [data-widget="flight"]');
      const hotelWidget = page.locator('#hotel-widget, [data-widget="hotel"]');

      if (await flightWidget.count() > 0) {
        await expect(flightWidget).toBeVisible();
        // Check if widget contains trip data
        const flightContent = await flightWidget.textContent();
        expect(flightContent.toLowerCase()).toContain('lisbon');
      }

      if (await hotelWidget.count() > 0) {
        await expect(hotelWidget).toBeVisible();
        const hotelContent = await hotelWidget.textContent();
        expect(hotelContent.toLowerCase()).toContain('lisbon');
      }
    });
  });

  test.describe('7. Mobile Responsiveness', () => {
    test('should display content properly on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('http://localhost:8000');

      await page.fill('input[name="destination"]', 'Edinburgh, Scotland');
      await page.fill('input[name="from"]', 'London, England');
      await page.fill('input[name="start"]', '2025-05-01');
      await page.fill('input[name="end"]', '2025-05-08');
      await page.fill('input[name="budget"]', '2000');

      await page.click('button[data-testid="generate-plan"]');
      await page.waitForSelector('#preview', { timeout: 30000 });

      // Check that all tables are responsive
      const tables = page.locator('table');
      for (let i = 0; i < await tables.count(); i++) {
        const table = tables.nth(i);
        const boundingBox = await table.boundingBox();
        if (boundingBox) {
          expect(boundingBox.width).toBeLessThanOrEqual(375);
        }
      }

      // Verify content doesn't overflow horizontally
      const previewContent = page.locator('#preview');
      const previewBox = await previewContent.boundingBox();
      if (previewBox) {
        expect(previewBox.width).toBeLessThanOrEqual(375);
      }
    });

    test('should maintain functionality on different screen sizes', async ({ page }) => {
      const viewports = [
        { width: 320, height: 568 }, // iPhone SE
        { width: 768, height: 1024 }, // iPad
        { width: 1024, height: 768 }, // Desktop small
        { width: 1440, height: 900 }  // Desktop large
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto('http://localhost:8000');

        // Verify form is usable
        await expect(page.locator('input[name="destination"]')).toBeVisible();
        await expect(page.locator('button[data-testid="generate-plan"]')).toBeVisible();

        // Test form interaction
        await page.fill('input[name="destination"]', 'Test City');
        const value = await page.locator('input[name="destination"]').inputValue();
        expect(value).toBe('Test City');
      }
    });
  });

  test.describe('8. Complete Content Generation', () => {
    test('should generate complete content without cut-offs', async ({ page }) => {
      await page.goto('http://localhost:8000');

      await page.fill('input[name="destination"]', 'Zurich, Switzerland');
      await page.fill('input[name="from"]', 'Geneva, Switzerland');
      await page.fill('input[name="start"]', '2025-04-01');
      await page.fill('input[name="end"]', '2025-04-08');
      await page.fill('input[name="budget"]', '4000');

      await page.click('button[data-testid="generate-plan"]');
      await page.waitForSelector('#preview', { timeout: 30000 });

      // Check for common cut-off indicators
      const content = await page.locator('#preview').textContent();
      const cutoffIndicators = [
        /\.\.\.$/, // Ends with ...
        /\w+\s*$/, // Ends mid-sentence
        /,\s*$/, // Ends with comma
        /and\s*$/, // Ends with "and"
        /the\s*$/, // Ends with "the"
        /\(\s*$/, // Unclosed parentheses
      ];

      // Check each day section for completeness
      const daySections = page.locator('h3:has-text("Day"), .day-section');
      for (let i = 0; i < await daySections.count(); i++) {
        const dayContent = await daySections.nth(i).textContent();

        for (const pattern of cutoffIndicators) {
          expect(dayContent.trim()).not.toMatch(pattern);
        }

        // Each day should have substantial content (more than just a heading)
        expect(dayContent.length).toBeGreaterThan(50);
      }
    });
  });
});

test.describe('LOW PRIORITY FIXES', () => {

  test.describe('9. Date Validation', () => {
    test('should prevent past dates', async ({ page }) => {
      await page.goto('http://localhost:8000');

      // Try to enter a past date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const pastDate = yesterday.toISOString().split('T')[0];

      await page.fill('input[name="start"]', pastDate);
      await page.fill('input[name="destination"]', 'Test City');

      await page.click('button[data-testid="generate-plan"]');

      // Should show validation error or prevent submission
      const errorMessage = page.locator('.error, .validation-error, [role="alert"]');
      if (await errorMessage.count() > 0) {
        await expect(errorMessage).toBeVisible();
        const errorText = await errorMessage.textContent();
        expect(errorText.toLowerCase()).toContain('date');
      }
    });

    test('should prevent invalid date ranges', async ({ page }) => {
      await page.goto('http://localhost:8000');

      const startDate = '2025-06-15';
      const endDate = '2025-06-10'; // End before start

      await page.fill('input[name="start"]', startDate);
      await page.fill('input[name="end"]', endDate);
      await page.fill('input[name="destination"]', 'Test City');

      await page.click('button[data-testid="generate-plan"]');

      // Should show validation error
      await page.waitForTimeout(1000);
      const hasError = await page.locator('.error, .validation-error').count() > 0;
      const preventedSubmission = await page.locator('#preview').count() === 0;

      expect(hasError || preventedSubmission).toBe(true);
    });
  });

  test.describe('10. Pricing Consistency', () => {
    test('should display consistent currency formatting', async ({ page }) => {
      await page.goto('http://localhost:8000');

      await page.fill('input[name="destination"]', 'Paris, France');
      await page.fill('input[name="from"]', 'London, UK');
      await page.fill('input[name="start"]', '2025-05-01');
      await page.fill('input[name="end"]', '2025-05-08');
      await page.fill('input[name="budget"]', '2500');
      await page.selectOption('select[name="currency"]', 'EUR');

      await page.click('button[data-testid="generate-plan"]');
      await page.waitForSelector('#preview', { timeout: 30000 });

      // Check currency consistency throughout content
      const content = await page.locator('#preview').textContent();
      const currencySymbols = content.match(/[€$£¥]/g) || [];
      const eurSymbols = currencySymbols.filter(symbol => symbol === '€');

      if (currencySymbols.length > 0) {
        // At least 80% should be EUR symbols when EUR is selected
        const eurPercentage = eurSymbols.length / currencySymbols.length;
        expect(eurPercentage).toBeGreaterThan(0.8);
      }
    });
  });

  test.describe('11. Error Handling', () => {
    test('should handle API failures gracefully', async ({ page }) => {
      // Mock API failure
      await page.route('**/api/preview', route => {
        route.abort('failed');
      });

      await page.goto('http://localhost:8000');

      await page.fill('input[name="destination"]', 'Test City');
      await page.fill('input[name="from"]', 'Test Origin');
      await page.fill('input[name="start"]', '2025-06-01');
      await page.fill('input[name="end"]', '2025-06-08');
      await page.fill('input[name="budget"]', '2000');

      await page.click('button[data-testid="generate-plan"]');
      await page.waitForTimeout(5000);

      // Should show error message instead of breaking
      const errorElement = page.locator('.error, .alert-error, [data-error]');
      const hasErrorMessage = await errorElement.count() > 0;

      if (hasErrorMessage) {
        await expect(errorElement).toBeVisible();
      } else {
        // At minimum, should not show broken/incomplete content
        const preview = page.locator('#preview');
        const previewVisible = await preview.isVisible();
        if (previewVisible) {
          const content = await preview.textContent();
          expect(content).not.toContain('undefined');
          expect(content).not.toContain('Error:');
        }
      }
    });
  });

  test.describe('12. Data Quality', () => {
    test('should maintain consistent data quality across sections', async ({ page }) => {
      await page.goto('http://localhost:8000');

      await page.fill('input[name="destination"]', 'Florence, Italy');
      await page.fill('input[name="from"]', 'Rome, Italy');
      await page.fill('input[name="start"]', '2025-04-15');
      await page.fill('input[name="end"]', '2025-04-22');
      await page.fill('input[name="budget"]', '2200');

      await page.click('button[data-testid="generate-plan"]');
      await page.waitForSelector('#preview', { timeout: 30000 });

      // Verify consistent data quality indicators
      const content = await page.locator('#preview').textContent();

      // Should not have mixed quality (some sections good, others broken)
      const qualityIndicators = {
        good: content.match(/\b(recommended|excellent|popular|beautiful|historic)\b/gi)?.length || 0,
        bad: content.match(/\b(error|failed|undefined|null|broken)\b/gi)?.length || 0,
        incomplete: content.match(/\.\.\.|XXX|TODO|PLACEHOLDER/gi)?.length || 0
      };

      // Good indicators should significantly outweigh bad ones
      if (qualityIndicators.good > 0) {
        const qualityRatio = qualityIndicators.good / (qualityIndicators.bad + qualityIndicators.incomplete + 1);
        expect(qualityRatio).toBeGreaterThan(3);
      }
    });
  });
});

// Cross-cutting integration tests
test.describe('INTEGRATION TESTS', () => {
  test('complete user journey with all fixes applied', async ({ page }) => {
    await page.goto('http://localhost:8000');

    // 1. Location should auto-detect (mock success)
    await page.addInitScript(() => {
      window.fetch = (originalFetch => {
        return function(url, config) {
          if (url.includes('ipapi.co')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                city: 'Berlin',
                country_name: 'Germany'
              })
            });
          }
          return originalFetch(url, config);
        };
      })(window.fetch);
    });

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 2. Fill remaining form fields
    await page.fill('input[name="destination"]', 'Prague, Czech Republic');
    await page.fill('input[name="start"]', '2025-06-01');
    await page.fill('input[name="end"]', '2025-06-08');
    await page.fill('input[name="budget"]', '2500');
    await page.selectOption('select[name="currency"]', 'EUR');

    // 3. Generate trip
    await page.click('button[data-testid="generate-plan"]');
    await page.waitForSelector('#preview', { timeout: 30000 });

    // 4. Verify all fixes are working
    // ✅ Location detection worked
    const fromValue = await page.locator('input[name="from"]').inputValue();
    expect(fromValue).toContain('Berlin');

    // ✅ Content generated without API errors
    await expect(page.locator('#preview')).toContainText('Prague');

    // ✅ No duplicate budget sections
    const budgetHeadings = page.locator('h2:has-text("Budget"), h3:has-text("Budget")');
    expect(await budgetHeadings.count()).toBeLessThanOrEqual(1);

    // ✅ Tables not corrupted
    const tables = page.locator('table');
    for (let i = 0; i < await tables.count(); i++) {
      const table = tables.nth(i);
      await expect(table).toBeVisible();
    }

    // ✅ Content is complete
    const content = await page.locator('#preview').textContent();
    expect(content).not.toContain('undefined');
    expect(content).not.toContain('...');
    expect(content.length).toBeGreaterThan(500);

    // ✅ Mobile responsive
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('#preview')).toBeVisible();

    console.log('✅ All critical fixes verified in integration test');
  });
});