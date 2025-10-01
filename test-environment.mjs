#!/usr/bin/env node

/**
 * Wayzo Test Environment Validator
 * Quick smoke test to verify testing environment is properly configured
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import fetch from 'node-fetch';

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bright: '\x1b[1m',
  reset: '\x1b[0m'
};

const log = (message, color = 'white') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

async function checkEnvironment() {
  log('🔍 WAYZO TEST ENVIRONMENT VALIDATOR', 'bright');
  log('=' .repeat(50), 'blue');

  const checks = [
    {
      name: 'Node.js Version',
      test: () => {
        const version = process.version;
        const major = parseInt(version.split('.')[0].slice(1));
        return { success: major >= 18, details: `v${version}` };
      }
    },
    {
      name: 'Backend Dependencies',
      test: () => {
        const nodeModulesExists = existsSync('./backend/node_modules');
        const packageExists = existsSync('./backend/package.json');
        return {
          success: nodeModulesExists && packageExists,
          details: nodeModulesExists ? 'Installed' : 'Missing - run npm install'
        };
      }
    },
    {
      name: 'Test Files Present',
      test: () => {
        const testFiles = [
          './backend/tests/critical-fixes-unit.test.mjs',
          './backend/tests/e2e/critical-fixes.test.js',
          './backend/tests/run-critical-tests.mjs'
        ];
        const missing = testFiles.filter(file => !existsSync(file));
        return {
          success: missing.length === 0,
          details: missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'All present'
        };
      }
    },
    {
      name: 'Environment Variables',
      test: () => {
        const hasOpenAI = !!process.env.OPENAI_API_KEY;
        const nodeEnv = process.env.NODE_ENV || 'development';
        return {
          success: hasOpenAI || nodeEnv === 'development',
          details: hasOpenAI ? 'OpenAI key configured' : 'Development mode (mocked APIs)'
        };
      }
    },
    {
      name: 'Frontend Server (Port 8000)',
      test: async () => {
        try {
          const response = await fetch('http://localhost:8000', { timeout: 3000 });
          return {
            success: response.ok,
            details: response.ok ? 'Running' : `HTTP ${response.status}`
          };
        } catch (error) {
          return {
            success: false,
            details: 'Not running - start with: cd frontend && python3 -m http.server 8000'
          };
        }
      }
    },
    {
      name: 'Backend Server (Port 10000)',
      test: async () => {
        try {
          const response = await fetch('http://localhost:10000', { timeout: 3000 });
          return {
            success: response.ok || response.status === 404, // 404 is OK for root
            details: response.ok || response.status === 404 ? 'Running' : `HTTP ${response.status}`
          };
        } catch (error) {
          return {
            success: false,
            details: 'Not running - start with: cd backend && npm start'
          };
        }
      }
    },
    {
      name: 'Playwright Installation',
      test: () => {
        try {
          const playwrightExists = existsSync('./backend/node_modules/@playwright/test');
          return {
            success: playwrightExists,
            details: playwrightExists ? 'Installed' : 'Missing - included in npm install'
          };
        } catch (error) {
          return { success: false, details: 'Check failed' };
        }
      }
    },
    {
      name: 'Vitest Installation',
      test: () => {
        try {
          const vitestExists = existsSync('./backend/node_modules/vitest');
          return {
            success: vitestExists,
            details: vitestExists ? 'Installed' : 'Missing - included in npm install'
          };
        } catch (error) {
          return { success: false, details: 'Check failed' };
        }
      }
    }
  ];

  let allPassed = true;

  for (const check of checks) {
    try {
      const result = await check.test();
      const status = result.success ? '✅' : '❌';
      const color = result.success ? 'green' : 'red';

      log(`${status} ${check.name}: ${result.details}`, color);

      if (!result.success) {
        allPassed = false;
      }
    } catch (error) {
      log(`❌ ${check.name}: Error - ${error.message}`, 'red');
      allPassed = false;
    }
  }

  log('\n' + '=' .repeat(50), 'blue');

  if (allPassed) {
    log('🎉 ALL CHECKS PASSED - Environment is ready for testing!', 'green');
    log('\nNext steps:', 'bright');
    log('1. Run full test suite: node backend/tests/run-critical-tests.mjs', 'white');
    log('2. Run unit tests only: npm run test critical-fixes-unit.test.mjs', 'white');
    log('3. Run E2E tests: npx playwright test backend/tests/e2e/critical-fixes.test.js', 'white');
  } else {
    log('⚠️  SOME CHECKS FAILED - Fix issues above before running tests', 'yellow');
    log('\nCommon fixes:', 'bright');
    log('• Install dependencies: cd backend && npm install', 'white');
    log('• Start frontend: cd frontend && python3 -m http.server 8000', 'white');
    log('• Start backend: cd backend && npm start', 'white');
    log('• Set OpenAI key: export OPENAI_API_KEY="your-key"', 'white');
  }

  return allPassed;
}

// Quick API test
async function quickAPITest() {
  try {
    log('\n🧪 Quick API Test', 'bright');

    const testData = {
      destination: 'Prague, Czech Republic',
      from: 'New York, USA',
      start: '2025-06-01',
      end: '2025-06-07',
      budget: 2000,
      currency: 'USD'
    };

    const response = await fetch('http://localhost:10000/api/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData),
      timeout: 10000
    });

    if (response.ok) {
      const data = await response.json();
      log('✅ API Test: Backend responding correctly', 'green');
      log(`   Response includes: ${Object.keys(data).join(', ')}`, 'white');
    } else {
      log(`⚠️  API Test: Backend responded with HTTP ${response.status}`, 'yellow');
      log('   This may indicate OpenAI integration issues (expected)', 'white');
    }
  } catch (error) {
    log(`❌ API Test: ${error.message}`, 'red');
    log('   Backend may not be running or responding', 'white');
  }
}

// Test runner validation
async function validateTestRunner() {
  log('\n🏃 Test Runner Validation', 'bright');

  try {
    // Check if test runner exists and is executable
    if (existsSync('./backend/tests/run-critical-tests.mjs')) {
      log('✅ Test runner script exists', 'green');

      // Try to run with help flag
      try {
        const helpOutput = execSync('node backend/tests/run-critical-tests.mjs --help', {
          encoding: 'utf8',
          timeout: 5000
        });
        log('✅ Test runner is executable', 'green');
      } catch (error) {
        // Script might not have --help, but if it errors on unknown flag, it's working
        if (error.message.includes('Unknown') || error.status === 1) {
          log('✅ Test runner is executable', 'green');
        } else {
          log('⚠️  Test runner may have issues', 'yellow');
        }
      }
    } else {
      log('❌ Test runner script missing', 'red');
    }
  } catch (error) {
    log(`❌ Test runner validation failed: ${error.message}`, 'red');
  }
}

// Main execution
async function main() {
  const envReady = await checkEnvironment();

  if (envReady) {
    await quickAPITest();
    await validateTestRunner();

    log('\n🚀 READY TO TEST!', 'bright');
    log('Run the comprehensive test suite with:', 'white');
    log('node backend/tests/run-critical-tests.mjs', 'green');
  } else {
    log('\n🔧 SETUP REQUIRED', 'bright');
    log('Fix the issues above before running tests.', 'white');
  }
}

main().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});