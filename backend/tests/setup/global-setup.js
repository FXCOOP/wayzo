/**
 * Global Test Setup for Wayzo Playwright MCP Testing
 * Runs before all tests to ensure environment is ready
 */

import { chromium } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export default async function globalSetup() {
  console.log('🔧 Starting Wayzo test environment setup...');

  // Create test results directory
  const testResultsDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
  }

  // Verify environment prerequisites
  await verifyEnvironment();

  // Setup test database (if needed)
  await setupTestDatabase();

  // Warm up servers and verify connectivity
  await warmupServers();

  // Setup debug mode for testing
  await setupDebugMode();

  console.log('✅ Global test setup completed successfully');
}

async function verifyEnvironment() {
  console.log('🔍 Verifying test environment...');

  try {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].slice(1));
    if (majorVersion < 18) {
      throw new Error(`Node.js 18+ required, got ${nodeVersion}`);
    }

    // Check if backend dependencies are installed
    const backendNodeModules = path.join(process.cwd(), 'backend', 'node_modules');
    if (!fs.existsSync(backendNodeModules)) {
      console.log('📦 Installing backend dependencies...');
      execSync('npm install', { cwd: path.join(process.cwd(), 'backend'), stdio: 'inherit' });
    }

    // Check if frontend files exist
    const frontendDir = path.join(process.cwd(), 'frontend');
    const requiredFiles = ['index.backend.html', 'app.js', 'style.css', 'test.html'];
    for (const file of requiredFiles) {
      const filePath = path.join(frontendDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required frontend file missing: ${file}`);
      }
    }

    console.log('✅ Environment verification completed');
  } catch (error) {
    console.error('❌ Environment verification failed:', error.message);
    throw error;
  }
}

async function setupTestDatabase() {
  console.log('🗄️ Setting up test database...');

  try {
    // Clear any existing test database
    const testDbPath = path.join(process.cwd(), 'backend', 'test.db');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize database with test data if backend is available
    const backendExists = fs.existsSync(path.join(process.cwd(), 'backend', 'server.mjs'));
    if (backendExists) {
      console.log('✅ Backend server available for database setup');
    } else {
      console.log('⚠️ Backend server not found - database setup skipped');
    }
  } catch (error) {
    console.log('⚠️ Test database setup failed (non-critical):', error.message);
  }
}

async function warmupServers() {
  console.log('🌡️ Warming up servers...');

  try {
    // Test frontend server
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('http://localhost:8000', { waitUntil: 'networkidle', timeout: 10000 });
      console.log('✅ Frontend server responding');
    } catch (error) {
      console.log('⚠️ Frontend server not responding - will be started by webServer config');
    }

    // Test backend server
    try {
      const response = await page.request.get('http://localhost:10000/api/health', { timeout: 5000 });
      if (response.ok()) {
        console.log('✅ Backend server responding');
      } else {
        console.log('⚠️ Backend server responded with error status');
      }
    } catch (error) {
      console.log('⚠️ Backend server not responding - will be started by webServer config');
    }

    await browser.close();
  } catch (error) {
    console.log('⚠️ Server warmup failed (non-critical):', error.message);
  }
}

async function setupDebugMode() {
  console.log('🐛 Setting up debug mode...');

  try {
    // Create debug configuration for tests
    const debugConfig = {
      enableConsoleLogging: true,
      captureScreenshots: true,
      captureVideo: true,
      detailedErrorReporting: true,
      testStartTime: new Date().toISOString(),
    };

    const debugConfigPath = path.join(process.cwd(), 'test-results', 'debug-config.json');
    fs.writeFileSync(debugConfigPath, JSON.stringify(debugConfig, null, 2));

    console.log('✅ Debug mode configured');
  } catch (error) {
    console.log('⚠️ Debug mode setup failed (non-critical):', error.message);
  }
}

// Export configuration for use by tests
export const testConfig = {
  baseURL: 'http://localhost:8000',
  backendURL: 'http://localhost:10000',
  defaultTimeout: 30000,
  retryAttempts: 2,

  // Critical fixes test priorities
  priorities: {
    high: ['GPT API Integration', 'Location Autofill', 'Weather Table', 'Budget Duplication'],
    medium: ['Content Validation', 'Widget Integration', 'Mobile Responsiveness', 'Complete Content'],
    low: ['Date Validation', 'Pricing Consistency', 'Error Handling', 'Data Quality']
  },

  // Test data templates
  testTrips: {
    basic: {
      destination: 'Prague, Czech Republic',
      from: 'New York, USA',
      start: '2025-06-01',
      end: '2025-06-07',
      budget: '2000',
      currency: 'USD'
    },
    european: {
      destination: 'Barcelona, Spain',
      from: 'Paris, France',
      start: '2025-05-15',
      end: '2025-05-22',
      budget: '1800',
      currency: 'EUR'
    },
    longTrip: {
      destination: 'Tokyo, Japan',
      from: 'Los Angeles, USA',
      start: '2025-07-01',
      end: '2025-07-14',
      budget: '4500',
      currency: 'USD'
    }
  }
};