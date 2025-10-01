#!/usr/bin/env node

/**
 * Playwright MCP Test Setup Validator
 * Validates that the testing framework is properly configured
 */

import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
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
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bright: '\x1b[1m',
  reset: '\x1b[0m'
};

class TestSetupValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      errors: []
    };
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

  checkItem(name, testFn, fixMsg = '') {
    try {
      if (testFn()) {
        this.log(`✅ ${name}`, 'green');
        this.results.passed++;
        return true;
      } else {
        this.log(`❌ ${name}`, 'red');
        if (fixMsg) {
          this.log(`   Fix: ${fixMsg}`, 'yellow');
        }
        this.results.failed++;
        this.results.errors.push(name);
        return false;
      }
    } catch (error) {
      this.log(`❌ ${name}: ${error.message}`, 'red');
      if (fixMsg) {
        this.log(`   Fix: ${fixMsg}`, 'yellow');
      }
      this.results.failed++;
      this.results.errors.push(`${name}: ${error.message}`);
      return false;
    }
  }

  warningItem(name, testFn, warningMsg = '') {
    try {
      if (testFn()) {
        this.log(`✅ ${name}`, 'green');
        this.results.passed++;
        return true;
      } else {
        this.log(`⚠️ ${name}`, 'yellow');
        if (warningMsg) {
          this.log(`   Note: ${warningMsg}`, 'yellow');
        }
        this.results.warnings++;
        return false;
      }
    } catch (error) {
      this.log(`⚠️ ${name}: ${error.message}`, 'yellow');
      if (warningMsg) {
        this.log(`   Note: ${warningMsg}`, 'yellow');
      }
      this.results.warnings++;
      return false;
    }
  }

  validate() {
    this.logSection('🧪 PLAYWRIGHT MCP TESTING FRAMEWORK VALIDATION');

    // 1. Essential Files
    this.logSection('📁 Essential Files Check');

    this.checkItem(
      'Playwright config exists',
      () => existsSync(path.join(process.cwd(), 'playwright.config.js')),
      'Create playwright.config.js with enhanced MCP configuration'
    );

    this.checkItem(
      'Package.json has test scripts',
      () => {
        const packagePath = path.join(process.cwd(), 'backend', 'package.json');
        if (!existsSync(packagePath)) return false;
        const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
        return pkg.scripts && pkg.scripts['test:baseline'] && pkg.scripts['test:critical-high'];
      },
      'Update package.json with MCP test scripts'
    );

    this.checkItem(
      'Baseline tests exist',
      () => existsSync(path.join(process.cwd(), 'backend', 'tests', 'e2e', 'baseline-functionality.test.js')),
      'Create baseline-functionality.test.js'
    );

    this.checkItem(
      'Critical fixes tests exist',
      () => existsSync(path.join(process.cwd(), 'backend', 'tests', 'e2e', 'critical-fixes.test.js')),
      'Critical fixes tests already exist'
    );

    this.checkItem(
      'Responsive design tests exist',
      () => existsSync(path.join(process.cwd(), 'backend', 'tests', 'e2e', 'responsive-design.spec.js')),
      'Responsive design tests already exist'
    );

    this.checkItem(
      'Global setup exists',
      () => existsSync(path.join(process.cwd(), 'backend', 'tests', 'setup', 'global-setup.js')),
      'Create global-setup.js for test environment'
    );

    this.checkItem(
      'Global teardown exists',
      () => existsSync(path.join(process.cwd(), 'backend', 'tests', 'setup', 'global-teardown.js')),
      'Create global-teardown.js for cleanup'
    );

    this.checkItem(
      'MCP runner exists',
      () => existsSync(path.join(process.cwd(), 'backend', 'tests', 'playwright-mcp-runner.mjs')),
      'Create playwright-mcp-runner.mjs'
    );

    this.checkItem(
      'Testing guide exists',
      () => existsSync(path.join(process.cwd(), 'backend', 'tests', 'PLAYWRIGHT-MCP-TESTING-GUIDE.md')),
      'Create comprehensive testing guide'
    );

    // 2. Dependencies
    this.logSection('📦 Dependencies Check');

    this.checkItem(
      'Node.js version 18+',
      () => {
        const version = process.version;
        const major = parseInt(version.split('.')[0].slice(1));
        return major >= 18;
      },
      'Update Node.js to version 18 or higher'
    );

    this.checkItem(
      'Playwright installed',
      () => {
        try {
          execSync('npx playwright --version', { stdio: 'pipe' });
          return true;
        } catch {
          return false;
        }
      },
      'Run: npm install @playwright/test'
    );

    this.warningItem(
      'Backend dependencies installed',
      () => existsSync(path.join(process.cwd(), 'backend', 'node_modules')),
      'Run: cd backend && npm install'
    );

    // 3. Frontend Files
    this.logSection('🌐 Frontend Files Check');

    const frontendFiles = [
      'index.backend.html',
      'app.js',
      'style.css',
      'test.html',
      'admin.html',
      'translations.js'
    ];

    frontendFiles.forEach(file => {
      this.checkItem(
        `Frontend file: ${file}`,
        () => existsSync(path.join(process.cwd(), 'frontend', file)),
        `Ensure ${file} exists in frontend directory`
      );
    });

    // 4. Backend Files
    this.logSection('⚙️ Backend Files Check');

    this.checkItem(
      'Backend server exists',
      () => existsSync(path.join(process.cwd(), 'backend', 'server.mjs')),
      'Ensure server.mjs exists in backend directory'
    );

    this.checkItem(
      'Backend package.json exists',
      () => existsSync(path.join(process.cwd(), 'backend', 'package.json')),
      'Ensure package.json exists in backend directory'
    );

    // 5. Test Configuration Validation
    this.logSection('⚙️ Test Configuration Validation');

    this.checkItem(
      'Playwright config has MCP enhancements',
      () => {
        const configPath = path.join(process.cwd(), 'playwright.config.js');
        if (!existsSync(configPath)) return false;
        const config = readFileSync(configPath, 'utf8');
        return config.includes('baseline-chrome') &&
               config.includes('critical-high-chrome') &&
               config.includes('mobile-chrome');
      },
      'Update playwright.config.js with MCP project configurations'
    );

    this.checkItem(
      'Package.json has all MCP scripts',
      () => {
        const packagePath = path.join(process.cwd(), 'backend', 'package.json');
        if (!existsSync(packagePath)) return false;
        const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
        const requiredScripts = [
          'test:baseline',
          'test:critical-high',
          'test:critical-medium',
          'test:critical-low',
          'test:integration',
          'test:cross-browser',
          'test:mobile',
          'test:complete-regression'
        ];
        return requiredScripts.every(script => pkg.scripts && pkg.scripts[script]);
      },
      'Add all MCP test scripts to package.json'
    );

    // 6. Runtime Environment Check
    this.logSection('🖥️ Runtime Environment Check');

    this.warningItem(
      'Frontend server can start',
      () => {
        try {
          // Just check if the command exists and directory is accessible
          const frontendDir = path.join(process.cwd(), 'frontend');
          return existsSync(frontendDir);
        } catch {
          return false;
        }
      },
      'Ensure you can run: cd frontend && python3 -m http.server 8000'
    );

    this.warningItem(
      'Backend can start',
      () => {
        try {
          const backendDir = path.join(process.cwd(), 'backend');
          const serverExists = existsSync(path.join(backendDir, 'server.mjs'));
          const nodeModulesExists = existsSync(path.join(backendDir, 'node_modules'));
          return serverExists && nodeModulesExists;
        } catch {
          return false;
        }
      },
      'Ensure you can run: cd backend && npm start'
    );

    // 7. Test Priority Mapping
    this.logSection('🎯 Test Priority Mapping Validation');

    this.checkItem(
      'HIGH PRIORITY tests configured',
      () => {
        const testFile = path.join(process.cwd(), 'backend', 'tests', 'e2e', 'critical-fixes.test.js');
        if (!existsSync(testFile)) return false;
        const content = readFileSync(testFile, 'utf8');
        return content.includes('HIGH PRIORITY FIXES') &&
               content.includes('GPT API Integration') &&
               content.includes('Location Autofill') &&
               content.includes('Weather Table') &&
               content.includes('Budget Table Duplication');
      },
      'Ensure all HIGH PRIORITY fixes have dedicated tests'
    );

    this.checkItem(
      'MEDIUM PRIORITY tests configured',
      () => {
        const testFile = path.join(process.cwd(), 'backend', 'tests', 'e2e', 'critical-fixes.test.js');
        if (!existsSync(testFile)) return false;
        const content = readFileSync(testFile, 'utf8');
        return content.includes('MEDIUM PRIORITY FIXES');
      },
      'Ensure MEDIUM PRIORITY fixes have dedicated tests'
    );

    this.checkItem(
      'LOW PRIORITY tests configured',
      () => {
        const testFile = path.join(process.cwd(), 'backend', 'tests', 'e2e', 'critical-fixes.test.js');
        if (!existsSync(testFile)) return false;
        const content = readFileSync(testFile, 'utf8');
        return content.includes('LOW PRIORITY FIXES');
      },
      'Ensure LOW PRIORITY fixes have dedicated tests'
    );

    // Generate final report
    this.generateFinalReport();
  }

  generateFinalReport() {
    const total = this.results.passed + this.results.failed;
    const successRate = total > 0 ? Math.round((this.results.passed / total) * 100) : 0;

    this.logSection('📊 VALIDATION SUMMARY');

    this.log(`\\n🎯 OVERALL RESULTS:`, 'bright');
    this.log(`   Total Checks: ${total}`, 'white');
    this.log(`   Passed: ${this.results.passed}`, 'green');
    this.log(`   Failed: ${this.results.failed}`, this.results.failed > 0 ? 'red' : 'green');
    this.log(`   Warnings: ${this.results.warnings}`, 'yellow');
    this.log(`   Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'red');

    if (this.results.errors.length > 0) {
      this.log(`\\n❌ FAILED CHECKS:`, 'red');
      this.results.errors.forEach((error, index) => {
        this.log(`   ${index + 1}. ${error}`, 'red');
      });
    }

    this.log(`\\n💡 RECOMMENDATIONS:`, 'bright');
    if (successRate >= 95) {
      this.log(`   ✅ Excellent! Testing framework is properly configured`, 'green');
      this.log(`   ✅ Ready to run: npm run test:baseline`, 'green');
      this.log(`   📖 See: backend/tests/PLAYWRIGHT-MCP-TESTING-GUIDE.md`, 'green');
    } else if (successRate >= 80) {
      this.log(`   ⚠️ Mostly configured but some issues remain`, 'yellow');
      this.log(`   🔧 Fix the failed checks above before running tests`, 'yellow');
    } else {
      this.log(`   ❌ Major configuration issues detected`, 'red');
      this.log(`   🛠️ Follow the setup instructions to complete configuration`, 'red');
    }

    this.log(`\\n🚀 NEXT STEPS:`, 'bright');
    if (successRate >= 95) {
      this.log(`   1. Start servers: cd frontend && python3 -m http.server 8000`, 'cyan');
      this.log(`   2. Start backend: cd backend && npm start`, 'cyan');
      this.log(`   3. Run baseline: npm run test:baseline`, 'cyan');
      this.log(`   4. Begin fixing: npm run test:critical-high`, 'cyan');
    } else {
      this.log(`   1. Fix failed checks listed above`, 'cyan');
      this.log(`   2. Re-run: node tests/validate-test-setup.mjs`, 'cyan');
      this.log(`   3. Once passing, start testing workflow`, 'cyan');
    }

    // Exit code
    if (successRate >= 80) {
      this.log(`\\n✅ VALIDATION COMPLETED SUCCESSFULLY`, 'green');
      process.exit(0);
    } else {
      this.log(`\\n❌ VALIDATION FAILED - Fix issues before proceeding`, 'red');
      process.exit(1);
    }
  }
}

// Run validation
const validator = new TestSetupValidator();
validator.validate();