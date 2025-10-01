import { defineConfig, devices } from '@playwright/test';

/**
 * Enhanced Playwright MCP Configuration for Wayzo Critical Fixes Testing
 * Supports priority-based testing, mobile responsiveness, and cross-browser validation
 */

export default defineConfig({
  testDir: './backend/tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Always retry once for stability
  workers: process.env.CI ? 1 : undefined,

  // Enhanced reporting for critical fixes tracking
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['line']
  ],

  // Global test configuration
  use: {
    baseURL: 'http://localhost:8000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Extended timeout for complex trip generation
    actionTimeout: 30000,
    navigationTimeout: 30000,

    // Additional context options for testing
    contextOptions: {
      permissions: ['geolocation'],
      geolocation: { latitude: 40.7128, longitude: -74.0060 }, // New York default
    },
  },

  // Enhanced browser matrix for comprehensive testing
  projects: [
    // === BASELINE TESTS (Always run first) ===
    {
      name: 'baseline-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
      testMatch: '**/baseline-*.test.js',
    },

    // === HIGH PRIORITY CRITICAL FIXES ===
    {
      name: 'critical-high-chrome',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/critical-fixes.test.js',
      grep: /HIGH PRIORITY/,
      dependencies: ['baseline-chrome'],
    },

    // === CROSS-BROWSER TESTING ===
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: '**/baseline-*.test.js', // Skip baseline, focus on functionality
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: '**/critical-fixes.test.js',
      grep: /HIGH PRIORITY|MEDIUM PRIORITY/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: '**/critical-fixes.test.js',
      grep: /HIGH PRIORITY/,
    },

    // === MOBILE RESPONSIVENESS TESTING ===
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: ['**/critical-fixes.test.js', '**/responsive-*.test.js'],
      grep: /MEDIUM PRIORITY.*Mobile|Weather Table|Budget.*Duplication/,
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      testMatch: '**/responsive-*.test.js',
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro'] },
      testMatch: '**/responsive-*.test.js',
    },

    // === ADMIN DASHBOARD TESTING ===
    {
      name: 'admin-dashboard',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:8000/admin.html'
      },
      testMatch: '**/admin-*.test.js',
    },

    // === INTEGRATION TESTING ===
    {
      name: 'integration-full',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/critical-fixes.test.js',
      grep: /INTEGRATION/,
      dependencies: ['critical-high-chrome'],
    },
  ],

  // Test environment setup
  webServer: [
    {
      command: 'cd frontend && python3 -m http.server 8000',
      port: 8000,
      reuseExistingServer: !process.env.CI,
      timeout: 10000,
    },
    {
      command: 'cd backend && npm start',
      port: 10000,
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
  ],

  // Test output directories
  outputDir: 'test-results/artifacts',

  // Global setup and teardown
  globalSetup: './backend/tests/setup/global-setup.js',
  globalTeardown: './backend/tests/setup/global-teardown.js',
});