const { test, expect } = require('@playwright/test');

// Wayzo v62 End-to-End Tests
test.describe('Wayzo E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the staging environment
    await page.goto('https://wayzo-staging.onrender.com');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('Verify itinerary rendering with all widgets', async ({ page }) => {
    // Fill out the form
    await page.fill('input[name="destination"]', 'Jerusalem, Israel');
    await page.fill('input[name="from"]', 'New York, USA');
    await page.fill('input[name="start"]', '2025-09-18');
    await page.fill('input[name="end"]', '2025-10-03');
    await page.fill('input[name="budget"]', '3000');
    await page.selectOption('select[name="currency"]', 'USD');
    await page.fill('input[name="adults"]', '2');
    await page.fill('input[name="children"]', '0');
    await page.selectOption('select[name="level"]', 'budget');
    await page.fill('textarea[name="prefs"]', 'Explore the historical and cultural richness of Jerusalem');
    await page.fill('textarea[name="dietary"]', 'no restrictions');
    await page.fill('textarea[name="brief"]', 'Budget-friendly trip with focus on historical sites');

    // Click generate plan button
    await page.click('button[data-testid="generate-plan"]');

    // Wait for the plan to generate
    await page.waitForSelector('h2:has-text("Trip Overview")', { timeout: 30000 });

    // Verify all required sections are present
    await expect(page.locator('h2:has-text("Trip Overview")')).toBeVisible();
    await expect(page.locator('h2:has-text("Weather Forecast")')).toBeVisible();
    await expect(page.locator('h2:has-text("Budget Breakdown")')).toBeVisible();
    await expect(page.locator('h2:has-text("Getting Around")')).toBeVisible();
    await expect(page.locator('h2:has-text("Accommodation")')).toBeVisible();
    await expect(page.locator('h2:has-text("Must-See Attractions")')).toBeVisible();
    await expect(page.locator('h2:has-text("Dining Guide")')).toBeVisible();
    await expect(page.locator('h2:has-text("Daily Itineraries")')).toBeVisible();
    await expect(page.locator('h2:has-text("Don\'t Forget List")')).toBeVisible();
    await expect(page.locator('h2:has-text("Travel Tips")')).toBeVisible();
    await expect(page.locator('h2:has-text("Useful Apps")')).toBeVisible();
    await expect(page.locator('h2:has-text("Emergency Info")')).toBeVisible();
    await expect(page.locator('h2:has-text("Google Map Preview")')).toBeVisible();

    // Verify all widgets are present with correct IDs
    await expect(page.locator('div#flight-widget')).toBeVisible();
    await expect(page.locator('div#hotel-widget')).toBeVisible();
    await expect(page.locator('div#car-widget')).toBeVisible();
    await expect(page.locator('div#airport-widget')).toBeVisible();
    await expect(page.locator('div#esim-widget')).toBeVisible();
    
    // Verify GetYourGuide widgets (3 total: 1 in Must-See, 2 in Daily Itineraries)
    await expect(page.locator('div[data-gyg-widget="auto"]')).toHaveCount(3);

    // Verify budget table has checkboxes
    await expect(page.locator('table.budget-table input[type="checkbox"]')).toHaveCount(6);

    // Verify Google Map link has target="_blank"
    const mapLink = page.locator('a:has-text("Open Map")');
    await expect(mapLink).toHaveAttribute('target', '_blank');
    await expect(mapLink).toHaveAttribute('href', /q=.+Western\+Wall/);

    // Verify internal anchor links work
    await page.click('a[href*="#hotel-widget"]');
    await page.click('a[href*="#car-widget"]');
    await page.click('a[href*="#airport-widget"]');

    // Verify GetYourGuide links have partner_id and target="_blank"
    const gygLinks = page.locator('a[href*="getyourguide.com"][href*="partner_id=PUHVJ53"]');
    await expect(gygLinks.first()).toHaveAttribute('target', '_blank');

    // Verify all 16 days are present
    await expect(page.locator('h3:has-text("Day ")')).toHaveCount(16);

    // Verify no generic content
    await expect(page.locator('text="continue similar patterns"')).toHaveCount(0);
    await expect(page.locator('text="free day"')).toHaveCount(0);
    await expect(page.locator('text="open exploration"')).toHaveCount(0);

    // Verify weather table has correct number of days
    const weatherRows = page.locator('table.weather-table tbody tr');
    await expect(weatherRows).toHaveCount(16);

    // Verify no images are present
    await expect(page.locator('img')).toHaveCount(0);
  });

  test('Verify widget functionality', async ({ page }) => {
    // Generate a plan first
    await page.fill('input[name="destination"]', 'Tokyo, Japan');
    await page.fill('input[name="from"]', 'Los Angeles, USA');
    await page.fill('input[name="start"]', '2025-10-01');
    await page.fill('input[name="end"]', '2025-10-08');
    await page.fill('input[name="budget"]', '4000');
    await page.selectOption('select[name="currency"]', 'USD');
    await page.fill('input[name="adults"]', '2');
    await page.fill('input[name="children"]', '0');
    await page.selectOption('select[name="level"]', 'mid');
    
    await page.click('button[data-testid="generate-plan"]');
    await page.waitForSelector('h2:has-text("Trip Overview")', { timeout: 30000 });

    // Test widget interactions
    const flightWidget = page.locator('div#flight-widget');
    await expect(flightWidget).toBeVisible();
    
    const hotelWidget = page.locator('div#hotel-widget');
    await expect(hotelWidget).toBeVisible();
    
    const carWidget = page.locator('div#car-widget');
    await expect(carWidget).toBeVisible();
    
    const airportWidget = page.locator('div#airport-widget');
    await expect(airportWidget).toBeVisible();
    
    const esimWidget = page.locator('div#esim-widget');
    await expect(esimWidget).toBeVisible();

    // Verify widgets are interactive (have proper data attributes)
    await expect(flightWidget).toHaveAttribute('data-flight-widget', 'search');
    await expect(hotelWidget).toHaveAttribute('data-hotel-widget', 'search');
    await expect(carWidget).toHaveAttribute('data-car-widget', 'rental');
    await expect(airportWidget).toHaveAttribute('data-airport-widget', 'transfer');
    await expect(esimWidget).toHaveAttribute('data-airalo-widget', 'esim');
  });

  test('Verify budget checkboxes functionality', async ({ page }) => {
    // Generate a plan
    await page.fill('input[name="destination"]', 'Paris, France');
    await page.fill('input[name="from"]', 'London, UK');
    await page.fill('input[name="start"]', '2025-11-01');
    await page.fill('input[name="end"]', '2025-11-05');
    await page.fill('input[name="budget"]', '2000');
    await page.selectOption('select[name="currency"]', 'EUR');
    await page.fill('input[name="adults"]', '2');
    await page.fill('input[name="children"]', '0');
    await page.selectOption('select[name="level"]', 'luxury');
    
    await page.click('button[data-testid="generate-plan"]');
    await page.waitForSelector('h2:has-text("Budget Breakdown")', { timeout: 30000 });

    // Test checkbox functionality
    const checkboxes = page.locator('table.budget-table input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(6);

    // Click first checkbox
    await checkboxes.first().click();
    await expect(checkboxes.first()).toBeChecked();

    // Verify label styling changes when checked
    const firstLabel = page.locator('table.budget-table label').first();
    await expect(firstLabel).toHaveCSS('text-decoration', 'line-through');
  });

  test('Verify responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.fill('input[name="destination"]', 'Barcelona, Spain');
    await page.fill('input[name="from"]', 'Madrid, Spain');
    await page.fill('input[name="start"]', '2025-12-01');
    await page.fill('input[name="end"]', '2025-12-04');
    await page.fill('input[name="budget"]', '1500');
    await page.selectOption('select[name="currency"]', 'EUR');
    await page.fill('input[name="adults"]', '2');
    await page.fill('input[name="children"]', '0');
    await page.selectOption('select[name="level"]', 'budget');
    
    await page.click('button[data-testid="generate-plan"]');
    await page.waitForSelector('h2:has-text("Trip Overview")', { timeout: 30000 });

    // Verify mobile layout
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('table.budget-table')).toBeVisible();
    await expect(page.locator('.section-widget')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('h2:has-text("Budget Breakdown")')).toBeVisible();
  });

  test('Verify error handling', async ({ page }) => {
    // Test with invalid data
    await page.fill('input[name="destination"]', '');
    await page.fill('input[name="budget"]', '0');
    
    await page.click('button[data-testid="generate-plan"]');
    
    // Should show error or validation message
    await expect(page.locator('.error, .alert, [role="alert"]')).toBeVisible();
  });

  test('Verify PDF generation', async ({ page }) => {
    // Generate a plan first
    await page.fill('input[name="destination"]', 'Rome, Italy');
    await page.fill('input[name="from"]', 'Milan, Italy');
    await page.fill('input[name="start"]', '2025-09-01');
    await page.fill('input[name="end"]', '2025-09-05');
    await page.fill('input[name="budget"]', '2500');
    await page.selectOption('select[name="currency"]', 'EUR');
    await page.fill('input[name="adults"]', '2');
    await page.fill('input[name="children"]', '0');
    await page.selectOption('select[name="level"]', 'mid');
    
    await page.click('button[data-testid="generate-plan"]');
    await page.waitForSelector('h2:has-text("Trip Overview")', { timeout: 30000 });

    // Test PDF download
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download PDF")');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toContain('wayzo-trip-plan.pdf');
  });

  test('Verify performance and loading', async ({ page }) => {
    const startTime = Date.now();
    
    await page.fill('input[name="destination"]', 'Amsterdam, Netherlands');
    await page.fill('input[name="from"]', 'Berlin, Germany');
    await page.fill('input[name="start"]', '2025-08-01');
    await page.fill('input[name="end"]', '2025-08-07');
    await page.fill('input[name="budget"]', '1800');
    await page.selectOption('select[name="currency"]', 'EUR');
    await page.fill('input[name="adults"]', '2');
    await page.fill('input[name="children"]', '0');
    await page.selectOption('select[name="level"]', 'budget');
    
    await page.click('button[data-testid="generate-plan"]');
    await page.waitForSelector('h2:has-text("Trip Overview")', { timeout: 30000 });
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    
    // Plan generation should complete within 30 seconds
    expect(loadTime).toBeLessThan(30000);
    
    // Verify no console errors
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });
    
    expect(logs).toHaveLength(0);
  });
});