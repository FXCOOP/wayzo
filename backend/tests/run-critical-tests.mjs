#!/usr/bin/env node

/**
 * Critical Issues Test Runner
 * Executes comprehensive test suite for all 12 critical fixes
 * Organized by priority levels with regression testing at each stage
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bright: '\x1b[1m',
  reset: '\x1b[0m'
};

// Test configuration
const config = {
  testTimeout: 60000, // 60 seconds per test
  retryAttempts: 2,
  verbose: process.argv.includes('--verbose'),
  skipE2E: process.argv.includes('--skip-e2e'),
  priority: process.argv.find(arg => arg.startsWith('--priority='))?.split('=')[1] || 'all'
};

class TestRunner {
  constructor() {
    this.results = {
      unit: { passed: 0, failed: 0, errors: [] },
      integration: { passed: 0, failed: 0, errors: [] },
      e2e: { passed: 0, failed: 0, errors: [] },
      total: { passed: 0, failed: 0, errors: [] }
    };
    this.startTime = Date.now();
  }

  log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logSection(title) {
    const border = '='.repeat(60);
    this.log(border, 'cyan');
    this.log(`  ${title}`, 'cyan');
    this.log(border, 'cyan');
  }

  logSubsection(title) {
    this.log(`\n${'─'.repeat(40)}`, 'blue');
    this.log(`  ${title}`, 'blue');
    this.log('─'.repeat(40), 'blue');
  }

  async checkPrerequisites() {
    this.logSection('CHECKING PREREQUISITES');

    const checks = [
      {
        name: 'Node.js version',
        test: () => {
          const version = process.version;
          const major = parseInt(version.split('.')[0].slice(1));
          return major >= 18;
        },
        errorMsg: 'Node.js 18+ required'
      },
      {
        name: 'Backend dependencies',
        test: () => existsSync(path.join(__dirname, '..', '..', 'node_modules')),
        errorMsg: 'Run `npm install` in backend directory'
      },
      {
        name: 'Test files exist',
        test: () => {
          const testFiles = [
            'critical-fixes-unit.test.mjs',
            'e2e/critical-fixes.test.js'
          ];
          return testFiles.every(file => existsSync(path.join(__dirname, file)));
        },
        errorMsg: 'Test files missing - ensure all test files are present'
      },
      {
        name: 'Environment setup',
        test: () => {
          return process.env.NODE_ENV !== 'production' || process.env.OPENAI_API_KEY;
        },
        errorMsg: 'Set OPENAI_API_KEY environment variable'
      }
    ];

    for (const check of checks) {
      try {
        if (check.test()) {
          this.log(`✅ ${check.name}`, 'green');
        } else {
          this.log(`❌ ${check.name}: ${check.errorMsg}`, 'red');
          process.exit(1);
        }
      } catch (error) {
        this.log(`❌ ${check.name}: ${error.message}`, 'red');
        process.exit(1);
      }
    }
  }

  async runCommand(command, description, options = {}) {
    this.log(`\n🔄 ${description}...`, 'yellow');

    try {
      const result = execSync(command, {
        cwd: path.join(__dirname, '..', '..'),
        encoding: 'utf8',
        timeout: options.timeout || config.testTimeout,
        stdio: config.verbose ? 'inherit' : 'pipe'
      });

      this.log(`✅ ${description} - PASSED`, 'green');
      return { success: true, output: result };
    } catch (error) {
      this.log(`❌ ${description} - FAILED`, 'red');
      if (config.verbose) {
        this.log(`Error: ${error.message}`, 'red');
        if (error.stdout) this.log(`Stdout: ${error.stdout}`, 'yellow');
        if (error.stderr) this.log(`Stderr: ${error.stderr}`, 'red');
      }
      return { success: false, error: error.message, output: error.stdout };
    }
  }

  async runUnitTests() {
    this.logSection('UNIT TESTS - Critical Fixes');

    const testCategories = [
      {
        name: 'HIGH PRIORITY: OpenAI API Integration',
        command: 'npm run test critical-fixes-unit.test.mjs -- --grep "GPT API Integration"',
        priority: 'high'
      },
      {
        name: 'HIGH PRIORITY: Location Autofill',
        command: 'npm run test critical-fixes-unit.test.mjs -- --grep "Location Autofill"',
        priority: 'high'
      },
      {
        name: 'HIGH PRIORITY: Weather Table Structure',
        command: 'npm run test critical-fixes-unit.test.mjs -- --grep "Weather Table"',
        priority: 'high'
      },
      {
        name: 'HIGH PRIORITY: Budget Duplication Prevention',
        command: 'npm run test critical-fixes-unit.test.mjs -- --grep "Budget Table Duplication"',
        priority: 'high'
      },
      {
        name: 'VALIDATION: Helper Functions',
        command: 'npm run test critical-fixes-unit.test.mjs -- --grep "VALIDATION HELPER"',
        priority: 'all'
      }
    ];

    for (const test of testCategories) {
      if (config.priority !== 'all' && test.priority !== config.priority) {
        this.log(`⏭️ Skipping ${test.name} (priority filter)`, 'yellow');
        continue;
      }

      this.logSubsection(test.name);
      const result = await this.runCommand(test.command, test.name);

      if (result.success) {
        this.results.unit.passed++;
      } else {
        this.results.unit.failed++;
        this.results.unit.errors.push({
          test: test.name,
          error: result.error
        });
      }
    }
  }

  async runIntegrationTests() {
    this.logSection('INTEGRATION TESTS - Existing Test Suite');

    const integrationTests = [
      {
        name: 'OpenAI Integration Tests',
        command: 'npm run test:openai',
        description: 'Validate OpenAI API integration fixes'
      },
      {
        name: 'API Endpoints Tests',
        command: 'npm run test tests/api-endpoints-openai.test.mjs',
        description: 'Test API endpoint functionality'
      },
      {
        name: 'Server Functions Tests',
        command: 'npm run test tests/server-openai-functions.test.mjs',
        description: 'Test server-side functions'
      }
    ];

    for (const test of integrationTests) {
      this.logSubsection(test.name);
      const result = await this.runCommand(test.command, test.description);

      if (result.success) {
        this.results.integration.passed++;
      } else {
        this.results.integration.failed++;
        this.results.integration.errors.push({
          test: test.name,
          error: result.error
        });
      }
    }
  }

  async runE2ETests() {
    if (config.skipE2E) {
      this.log('⏭️ Skipping E2E tests (--skip-e2e flag)', 'yellow');
      return;
    }

    this.logSection('E2E TESTS - Critical Fixes');

    // First, ensure the test environment is running
    this.logSubsection('Environment Check');
    await this.runCommand(
      'curl -f http://localhost:8000 || echo "Frontend not running"',
      'Check frontend server',
      { timeout: 5000 }
    );

    await this.runCommand(
      'curl -f http://localhost:10000/api/health || echo "Backend not running"',
      'Check backend server',
      { timeout: 5000 }
    );

    const e2eTestSuites = [
      {
        name: 'HIGH PRIORITY E2E Tests',
        command: 'npx playwright test tests/e2e/critical-fixes.test.js --grep "HIGH PRIORITY"',
        description: 'Test high-priority fixes end-to-end'
      },
      {
        name: 'MEDIUM PRIORITY E2E Tests',
        command: 'npx playwright test tests/e2e/critical-fixes.test.js --grep "MEDIUM PRIORITY"',
        description: 'Test medium-priority fixes end-to-end',
        priority: 'medium'
      },
      {
        name: 'LOW PRIORITY E2E Tests',
        command: 'npx playwright test tests/e2e/critical-fixes.test.js --grep "LOW PRIORITY"',
        description: 'Test low-priority fixes end-to-end',
        priority: 'low'
      },
      {
        name: 'INTEGRATION E2E Tests',
        command: 'npx playwright test tests/e2e/critical-fixes.test.js --grep "INTEGRATION"',
        description: 'Test complete user journey integration'
      },
      {
        name: 'Existing E2E Tests (Regression)',
        command: 'npx playwright test tests/e2e/playwright.test.js',
        description: 'Ensure existing functionality still works'
      }
    ];

    for (const test of e2eTestSuites) {
      if (config.priority !== 'all' && test.priority && test.priority !== config.priority) {
        this.log(`⏭️ Skipping ${test.name} (priority filter)`, 'yellow');
        continue;
      }

      this.logSubsection(test.name);
      const result = await this.runCommand(test.command, test.description, { timeout: 120000 });

      if (result.success) {
        this.results.e2e.passed++;
      } else {
        this.results.e2e.failed++;
        this.results.e2e.errors.push({
          test: test.name,
          error: result.error
        });
      }
    }
  }

  async runRegressionChecks() {
    this.logSection('REGRESSION TESTING');

    const regressionChecks = [
      {
        name: 'Trip Generation Smoke Test',
        command: 'curl -X POST http://localhost:10000/api/preview -H "Content-Type: application/json" -d \'{"destination":"Prague","from":"New York","start":"2025-06-01","end":"2025-06-07","budget":2000}\' | grep -q "itinerary"',
        description: 'Verify basic trip generation still works'
      },
      {
        name: 'Admin Panel Access Test',
        command: 'curl -f http://localhost:8000/admin.html | grep -q "Admin Dashboard"',
        description: 'Verify admin panel loads correctly'
      },
      {
        name: 'Frontend Assets Test',
        command: 'curl -f http://localhost:8000/style.css && curl -f http://localhost:8000/app.js',
        description: 'Verify frontend assets load correctly'
      }
    ];

    for (const check of regressionChecks) {
      this.logSubsection(check.name);
      const result = await this.runCommand(check.command, check.description, { timeout: 10000 });

      if (result.success) {
        this.log(`✅ ${check.name} - PASSED`, 'green');
      } else {
        this.log(`⚠️ ${check.name} - FAILED (may need manual verification)`, 'yellow');
      }
    }
  }

  calculateResults() {
    this.results.total.passed =
      this.results.unit.passed +
      this.results.integration.passed +
      this.results.e2e.passed;

    this.results.total.failed =
      this.results.unit.failed +
      this.results.integration.failed +
      this.results.e2e.failed;

    this.results.total.errors = [
      ...this.results.unit.errors,
      ...this.results.integration.errors,
      ...this.results.e2e.errors
    ];
  }

  generateReport() {
    this.calculateResults();
    const endTime = Date.now();
    const duration = Math.round((endTime - this.startTime) / 1000);

    this.logSection('TEST RESULTS SUMMARY');

    // Overall results
    const totalTests = this.results.total.passed + this.results.total.failed;
    const successRate = totalTests > 0 ? Math.round((this.results.total.passed / totalTests) * 100) : 0;

    this.log(`\n📊 OVERALL RESULTS:`, 'bright');
    this.log(`   Total Tests: ${totalTests}`, 'white');
    this.log(`   Passed: ${this.results.total.passed}`, 'green');
    this.log(`   Failed: ${this.results.total.failed}`, this.results.total.failed > 0 ? 'red' : 'green');
    this.log(`   Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'red');
    this.log(`   Duration: ${duration}s`, 'cyan');

    // Detailed breakdown
    this.log(`\n📈 BREAKDOWN:`, 'bright');
    this.log(`   Unit Tests: ${this.results.unit.passed}/${this.results.unit.passed + this.results.unit.failed}`, 'white');
    this.log(`   Integration Tests: ${this.results.integration.passed}/${this.results.integration.passed + this.results.integration.failed}`, 'white');
    this.log(`   E2E Tests: ${this.results.e2e.passed}/${this.results.e2e.passed + this.results.e2e.failed}`, 'white');

    // Error summary
    if (this.results.total.errors.length > 0) {
      this.log(`\n❌ FAILED TESTS:`, 'red');
      this.results.total.errors.forEach((error, index) => {
        this.log(`   ${index + 1}. ${error.test}`, 'red');
        if (config.verbose && error.error) {
          this.log(`      Error: ${error.error}`, 'red');
        }
      });
    }

    // Recommendations
    this.log(`\n💡 RECOMMENDATIONS:`, 'bright');
    if (successRate >= 95) {
      this.log(`   ✅ Excellent! All critical fixes are working properly.`, 'green');
      this.log(`   ✅ Safe to proceed with deployment.`, 'green');
    } else if (successRate >= 80) {
      this.log(`   ⚠️  Most tests passing. Review failed tests before deployment.`, 'yellow');
      this.log(`   ⚠️  Consider fixing remaining issues for better stability.`, 'yellow');
    } else {
      this.log(`   ❌ High failure rate. DO NOT DEPLOY until issues are resolved.`, 'red');
      this.log(`   ❌ Focus on fixing high-priority issues first.`, 'red');
    }

    // Exit code
    const shouldFail = this.results.total.failed > 0 && successRate < 80;
    if (shouldFail) {
      this.log(`\n🚨 CRITICAL ISSUES DETECTED - Exiting with error code`, 'red');
      process.exit(1);
    } else {
      this.log(`\n✅ TEST SUITE COMPLETED SUCCESSFULLY`, 'green');
      process.exit(0);
    }
  }

  async run() {
    try {
      this.log(`🧪 WAYZO CRITICAL FIXES TEST SUITE`, 'bright');
      this.log(`   Priority: ${config.priority}`, 'cyan');
      this.log(`   Skip E2E: ${config.skipE2E}`, 'cyan');
      this.log(`   Verbose: ${config.verbose}`, 'cyan');

      await this.checkPrerequisites();
      await this.runUnitTests();
      await this.runIntegrationTests();
      await this.runE2ETests();
      await this.runRegressionChecks();

      this.generateReport();
    } catch (error) {
      this.log(`\n💥 FATAL ERROR: ${error.message}`, 'red');
      if (config.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}

// Run the test suite
const runner = new TestRunner();
runner.run().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

export default TestRunner;