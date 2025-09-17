import { test, expect } from '@playwright/test';

test('Wayzo E2E: Verify itinerary rendering', async ({ page }) => {
  await page.goto('https://wayzo-staging.onrender.com');
  await page.fill('input[name="destination"]', 'Berlin, Germany');
  await page.fill('input[name="from"]', 'Auckland, New Zealand');
  await page.fill('input[name="start"]', '2025-09-19');
  await page.fill('input[name="end"]', '2025-10-09');
  await page.fill('input[name="budget"]', '5600');
  await page.selectOption('select[name="currency"]', 'USD');
  await page.fill('input[name="adults"]', '2');
  await page.fill('input[name="children"]', '1');
  await page.fill('input[name="child_1_age"]', '5');
  await page.selectOption('select[name="level"]', 'budget');
  await page.click('button[data-testid="generate-plan"]');
  await expect(page.locator('h2:has-text("Trip Overview")')).toBeVisible();
  await expect(page.locator('h2:has-text("Budget Breakdown")')).toBeVisible();
  await expect(page.locator('div#flight-widget')).toBeVisible();
  await expect(page.locator('div#hotel-widget')).toBeVisible();
  await expect(page.locator('div#car-widget')).toBeVisible();
  await expect(page.locator('div#airport-widget')).toBeVisible();
  await expect(page.locator('div#esim-widget')).toBeVisible();
  await expect(page.locator('div[data-gyg-widget="auto"]')).toHaveCount(3);
  await expect(page.locator('table.budget-table input[type="checkbox"]')).toHaveCount(6);
  const mapLink = await page.locator('a:has-text("Open Map")');
  await expect(mapLink).toHaveAttribute('target', '_blank');
  await expect(mapLink).toHaveAttribute('href', /q=.+Brandenburg\+Gate\+Pariser\+Platz/);
  await page.click('a[href*="#hotel-widget"]');
  await page.click('a[href*="#car-widget"]');
  await page.click('a[href*="#airport-widget"]');
  await expect(page.locator('a[href*="getyourguide.com"][href*="partner_id=PUHVJ53"]')).toHaveAttribute('target', '_blank');
  await expect(page.locator('h3:has-text("Day ")')).toHaveCount(21);
  await expect(page.locator('text="Open Exploration"')).toHaveCount(0);
});

