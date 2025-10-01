#!/usr/bin/env node

/**
 * Playwright MCP Test Runner for Wayzo Critical Fixes
 * Enhanced test execution with priority-based testing and comprehensive reporting
 */

import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
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

class PlaywrightMCPRunner {
  constructor() {
    this.config = {
      baseURL: 'http://localhost:8000',
      backendURL: 'http://localhost:10000',
      timeout: 60000,
      retries: 2,
      outputDir: path.join(process.cwd(), 'test-results'),
      verbose: process.argv.includes('--verbose'),
      headless: !process.argv.includes('--headed'),
      browsers: this.parseBrowsers(),
      priority: this.parsePriority(),
      skipBaseline: process.argv.includes('--skip-baseline'),
      generateReport: !process.argv.includes('--no-report')
    };

    this.results = {
      baseline: { passed: 0, failed: 0, skipped: 0, errors: [] },
      high: { passed: 0, failed: 0, skipped: 0, errors: [] },
      medium: { passed: 0, failed: 0, skipped: 0, errors: [] },
      low: { passed: 0, failed: 0, skipped: 0, errors: [] },
      integration: { passed: 0, failed: 0, skipped: 0, errors: [] }
    };

    this.startTime = Date.now();
    this.setupOutputDirectory();
  }

  parseBrowsers() {
    const browserArg = process.argv.find(arg => arg.startsWith('--browsers='));
    if (browserArg) {
      return browserArg.split('=')[1].split(',');
    }
    return ['chromium']; // Default to chromium only
  }

  parsePriority() {
    const priorityArg = process.argv.find(arg => arg.startsWith('--priority='));
    if (priorityArg) {
      return priorityArg.split('=')[1];
    }
    return 'all'; // Default to all priorities
  }

  setupOutputDirectory() {
    if (!existsSync(this.config.outputDir)) {
      mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  log(message, color = 'white') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logSection(title) {
    const border = '═'.repeat(60);
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
    this.logSection('🔍 CHECKING PREREQUISITES');

    const checks = [
      {
        name: 'Node.js version (18+)',
        test: () => {
          const version = process.version;
          const major = parseInt(version.split('.')[0].slice(1));
          return major >= 18;
        },
        fix: 'Update Node.js to version 18 or higher'
      },
      {
        name: 'Playwright installation',
        test: () => {
          try {
            execSync('npx playwright --version', { stdio: 'pipe' });
            return true;
          } catch {
            return false;
          }
        },
        fix: 'Run: npm install @playwright/test'
      },
      {
        name: 'Backend dependencies',
        test: () => existsSync(path.join(process.cwd(), 'node_modules')) || existsSync(path.join(process.cwd(), 'backend', 'node_modules')),
        fix: 'Run: cd backend && npm install'
      },
      {
        name: 'Frontend files',
        test: () => {
          const frontendFiles = ['index.backend.html', 'app.js', 'style.css', 'test.html'];
          return frontendFiles.every(file =>
            existsSync(path.join(process.cwd(), '..', 'frontend', file)) ||
            existsSync(path.join(process.cwd(), 'frontend', file))
          );
        },
        fix: 'Ensure all frontend files are present'
      },
      {
        name: 'Test files',
        test: () => {
          const testFiles = [
            'tests/e2e/baseline-functionality.test.js',
            'tests/e2e/critical-fixes.test.js'
          ];
          return testFiles.every(file => existsSync(path.join(process.cwd(), file)));
        },
        fix: 'Ensure all test files are present'
      }
    ];

    for (const check of checks) {
      try {
        if (check.test()) {
          this.log(`✅ ${check.name}`, 'green');
        } else {
          this.log(`❌ ${check.name}`, 'red');
          this.log(`   Fix: ${check.fix}`, 'yellow');
          return false;
        }
      } catch (error) {
        this.log(`❌ ${check.name}: ${error.message}`, 'red');
        return false;
      }
    }

    return true;
  }

  async runPlaywrightCommand(project, testFile, grep = null) {
    const args = [
      'playwright', 'test',
      '--project', project,
      testFile,
      '--reporter=json',
      `--output-dir=${this.config.outputDir}`
    ];

    if (grep) {
      args.push('--grep', grep);
    }

    if (this.config.headless) {
      args.push('--headed=false');
    }

    return new Promise((resolve, reject) => {
      const child = spawn('npx', args, {
        stdio: this.config.verbose ? 'inherit' : 'pipe',
        cwd: process.cwd()
      });

      let output = '';
      if (!this.config.verbose) {
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });
        child.stderr?.on('data', (data) => {
          output += data.toString();
        });
      }

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output,
          exitCode: code
        });
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  async runBaselineTests() {
    if (this.config.skipBaseline) {
      this.log('⏭️ Skipping baseline tests (--skip-baseline)', 'yellow');
      return true;
    }

    this.logSection('🧪 BASELINE FUNCTIONALITY TESTS');
    this.log('These tests MUST pass before attempting any fixes', 'yellow');

    try {
      const result = await this.runPlaywrightCommand(
        'baseline-chrome',
        'tests/e2e/baseline-functionality.test.js'
      );

      if (result.success) {
        this.results.baseline.passed = 1;
        this.log('✅ Baseline tests PASSED - safe to proceed with fixes', 'green');
        return true;
      } else {
        this.results.baseline.failed = 1;
        this.results.baseline.errors.push('Baseline tests failed');
        this.log('❌ Baseline tests FAILED', 'red');
        this.log('🚨 CRITICAL: Fix baseline issues before attempting other fixes', 'red');
        return false;
      }
    } catch (error) {
      this.results.baseline.failed = 1;
      this.results.baseline.errors.push(error.message);
      this.log(`❌ Baseline test execution failed: ${error.message}`, 'red');
      return false;
    }
  }

  async runCriticalFixesTests() {
    this.logSection('🔧 CRITICAL FIXES TESTS');

    const testSuites = [
      {
        priority: 'high',
        name: 'HIGH PRIORITY Critical Fixes',
        project: 'critical-high-chrome',
        grep: 'HIGH PRIORITY',
        required: true
      },
      {
        priority: 'medium',
        name: 'MEDIUM PRIORITY Critical Fixes',
        project: 'chromium',
        grep: 'MEDIUM PRIORITY',
        required: false
      },
      {
        priority: 'low',
        name: 'LOW PRIORITY Critical Fixes',
        project: 'chromium',
        grep: 'LOW PRIORITY',
        required: false
      },
      {
        priority: 'integration',
        name: 'INTEGRATION Tests',
        project: 'integration-full',
        grep: 'INTEGRATION',
        required: true
      }
    ];

    let allPassed = true;

    for (const suite of testSuites) {
      // Skip if priority filter doesn't match
      if (this.config.priority !== 'all' && this.config.priority !== suite.priority) {
        this.log(`⏭️ Skipping ${suite.name} (priority filter)`, 'yellow');
        continue;
      }

      this.logSubsection(suite.name);

      try {
        const result = await this.runPlaywrightCommand(
          suite.project,
          'tests/e2e/critical-fixes.test.js',
          suite.grep
        );

        if (result.success) {
          this.results[suite.priority].passed = 1;
          this.log(`✅ ${suite.name} PASSED`, 'green');
        } else {
          this.results[suite.priority].failed = 1;
          this.results[suite.priority].errors.push(`${suite.name} failed`);
          this.log(`❌ ${suite.name} FAILED`, 'red');

          if (suite.required) {
            allPassed = false;
          }
        }
      } catch (error) {
        this.results[suite.priority].failed = 1;
        this.results[suite.priority].errors.push(error.message);
        this.log(`❌ ${suite.name} execution failed: ${error.message}`, 'red');

        if (suite.required) {
          allPassed = false;
        }
      }
    }

    return allPassed;
  }

  async runCrossBrowserTests() {
    if (this.config.browsers.length <= 1) {
      this.log('⏭️ Skipping cross-browser tests (single browser)', 'yellow');
      return true;
    }

    this.logSection('🌐 CROSS-BROWSER COMPATIBILITY TESTS');

    const browsers = this.config.browsers.filter(b => b !== 'chromium');
    let allPassed = true;

    for (const browser of browsers) {
      this.logSubsection(`Testing on ${browser}`);

      try {
        const result = await this.runPlaywrightCommand(
          browser,
          'tests/e2e/critical-fixes.test.js',
          'HIGH PRIORITY'
        );

        if (result.success) {
          this.log(`✅ ${browser} tests PASSED`, 'green');
        } else {
          this.log(`❌ ${browser} tests FAILED`, 'red');
          allPassed = false;
        }
      } catch (error) {
        this.log(`❌ ${browser} test execution failed: ${error.message}`, 'red');
        allPassed = false;
      }
    }

    return allPassed;
  }

  async runMobileTests() {
    this.logSection('📱 MOBILE RESPONSIVENESS TESTS');

    const mobileProjects = ['mobile-chrome', 'mobile-safari', 'tablet'];
    let allPassed = true;

    for (const project of mobileProjects) {
      this.logSubsection(`Testing ${project}`);

      try {
        const result = await this.runPlaywrightCommand(
          project,
          'tests/e2e/responsive-design.spec.js'
        );

        if (result.success) {
          this.log(`✅ ${project} tests PASSED`, 'green');
        } else {
          this.log(`⚠️ ${project} tests FAILED`, 'yellow');
          // Mobile failures are warnings, not critical
        }
      } catch (error) {
        this.log(`⚠️ ${project} test execution failed: ${error.message}`, 'yellow');
      }
    }

    return allPassed;
  }

  calculateOverallResults() {
    const totals = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0
    };

    Object.values(this.results).forEach(result => {
      totals.passed += result.passed;
      totals.failed += result.failed;
      totals.skipped += result.skipped;
    });

    totals.total = totals.passed + totals.failed + totals.skipped;
    totals.successRate = totals.total > 0 ? Math.round((totals.passed / totals.total) * 100) : 0;

    return totals;
  }

  generateReport() {
    const totals = this.calculateOverallResults();
    const duration = Math.round((Date.now() - this.startTime) / 1000);

    this.logSection('📊 TEST RESULTS SUMMARY');

    // Overall results
    this.log(`\n🎯 OVERALL RESULTS:`, 'bright');
    this.log(`   Total Tests: ${totals.total}`, 'white');
    this.log(`   Passed: ${totals.passed}`, 'green');
    this.log(`   Failed: ${totals.failed}`, totals.failed > 0 ? 'red' : 'green');
    this.log(`   Success Rate: ${totals.successRate}%`, totals.successRate >= 80 ? 'green' : 'red');
    this.log(`   Duration: ${duration}s`, 'cyan');

    // Priority breakdown
    this.log(`\n📈 PRIORITY BREAKDOWN:`, 'bright');
    Object.entries(this.results).forEach(([priority, result]) => {
      const total = result.passed + result.failed + result.skipped;
      if (total > 0) {
        this.log(`   ${priority.toUpperCase()}: ${result.passed}/${total} passed`,
          result.failed > 0 ? 'red' : 'green');
      }
    });

    // Recommendations
    this.log(`\n💡 RECOMMENDATIONS:`, 'bright');
    if (totals.successRate >= 95) {
      this.log(`   ✅ Excellent! Ready for deployment`, 'green');
    } else if (totals.successRate >= 80) {
      this.log(`   ⚠️ Good but review failed tests before deployment`, 'yellow');
    } else {
      this.log(`   ❌ High failure rate - DO NOT DEPLOY`, 'red');
      this.log(`   🔧 Focus on HIGH PRIORITY fixes first`, 'red');
    }

    // Error summary
    const allErrors = Object.values(this.results).flatMap(result => result.errors);
    if (allErrors.length > 0) {
      this.log(`\n❌ FAILED TESTS:`, 'red');
      allErrors.forEach((error, index) => {
        this.log(`   ${index + 1}. ${error}`, 'red');
      });
    }

    return totals.successRate >= 80;
  }

  async run() {
    try {
      this.log(`🧪 WAYZO PLAYWRIGHT MCP TEST SUITE`, 'bright');
      this.log(`   Priority: ${this.config.priority}`, 'cyan');
      this.log(`   Browsers: ${this.config.browsers.join(', ')}`, 'cyan');
      this.log(`   Headless: ${this.config.headless}`, 'cyan');

      // Step 1: Check prerequisites
      if (!(await this.checkPrerequisites())) {
        this.log('🚨 Prerequisites not met - aborting tests', 'red');
        process.exit(1);
      }

      // Step 2: Run baseline tests
      if (!(await this.runBaselineTests())) {
        this.log('🚨 Baseline tests failed - aborting further tests', 'red');
        process.exit(1);
      }

      // Step 3: Run critical fixes tests
      const criticalPassed = await this.runCriticalFixesTests();

      // Step 4: Run cross-browser tests
      await this.runCrossBrowserTests();

      // Step 5: Run mobile tests
      await this.runMobileTests();

      // Step 6: Generate final report
      const overallSuccess = this.generateReport();

      if (overallSuccess) {
        this.log(`\n✅ TEST SUITE COMPLETED SUCCESSFULLY`, 'green');
        process.exit(0);
      } else {
        this.log(`\n❌ TEST SUITE COMPLETED WITH FAILURES`, 'red');
        process.exit(1);
      }
    } catch (error) {
      this.log(`\n💥 FATAL ERROR: ${error.message}`, 'red');
      if (this.config.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}

// Show usage information
function showUsage() {
  console.log(`
🧪 Wayzo Playwright MCP Test Runner

Usage: node playwright-mcp-runner.mjs [options]

Options:
  --priority=<level>     Run specific priority tests (high|medium|low|all)
  --browsers=<list>      Comma-separated browser list (chromium,firefox,webkit)
  --skip-baseline        Skip baseline functionality tests
  --headed               Run tests in headed mode (visible browser)
  --verbose              Show detailed output
  --no-report            Skip report generation
  --help                 Show this help message

Examples:
  node playwright-mcp-runner.mjs                           # Run all tests
  node playwright-mcp-runner.mjs --priority=high           # Run only high priority
  node playwright-mcp-runner.mjs --browsers=chromium,firefox  # Cross-browser
  node playwright-mcp-runner.mjs --headed --verbose        # Debug mode
`);
}

// Command line handling
if (process.argv.includes('--help')) {
  showUsage();
  process.exit(0);
}

// Run the test suite
const runner = new PlaywrightMCPRunner();
runner.run().catch(error => {
  console.error('\n💥 Unhandled error:', error);
  process.exit(1);
});