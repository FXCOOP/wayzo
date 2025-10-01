#!/usr/bin/env node

/**
 * OpenAI Integration Test Runner
 *
 * This script runs the TDD tests for OpenAI integration issues.
 * It's designed to show current failures and validate fixes.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🚀 Wayzo OpenAI Integration Test Runner\n');

console.log('📋 Current Issues Being Tested:');
console.log('  1. ❌ Invalid API method: client.responses.create()');
console.log('  2. ❌ Non-existent model: gpt-5-nano-2025-08-07');
console.log('  3. ❌ Wrong parameters: input, max_output_tokens');
console.log('  4. ❌ Broken response parsing: resp.output_text');
console.log('');

console.log('🧪 Running TDD Tests (Expected to FAIL with current broken code):\n');

// Test files to run
const testFiles = [
  'tests/openai-fix-validation.test.mjs',
  'tests/openai-integration.test.mjs',
  'tests/server-openai-functions.test.mjs',
  'tests/api-endpoints-openai.test.mjs'
];

async function runTests() {
  try {
    console.log('Installing test dependencies if needed...');

    // Check if vitest is available
    const checkVitest = spawn('npm', ['list', 'vitest'], {
      cwd: __dirname,
      stdio: 'pipe'
    });

    checkVitest.on('close', (code) => {
      if (code !== 0) {
        console.log('Installing test dependencies...');
        const install = spawn('npm', ['install', '--save-dev', 'vitest', '@vitest/coverage-v8', 'supertest'], {
          cwd: __dirname,
          stdio: 'inherit'
        });

        install.on('close', () => {
          runVitestCommand();
        });
      } else {
        runVitestCommand();
      }
    });

  } catch (error) {
    console.error('Error setting up tests:', error);
  }
}

function runVitestCommand() {
  console.log('\n🔍 Running Tests...\n');

  const vitestArgs = [
    'run',
    'vitest',
    ...testFiles,
    '--reporter=verbose',
    '--no-coverage'
  ];

  const vitest = spawn('npx', vitestArgs, {
    cwd: __dirname,
    stdio: 'inherit'
  });

  vitest.on('close', (code) => {
    console.log('\n📊 Test Results Summary:');

    if (code !== 0) {
      console.log('❌ Tests FAILED (This is expected with current broken code!)');
      console.log('');
      console.log('🔧 Next Steps:');
      console.log('  1. Review the test failures above');
      console.log('  2. Apply the fixes documented in tests/README.md');
      console.log('  3. Re-run tests: npm run test:openai');
      console.log('  4. All tests should PASS after fixes are applied');
      console.log('');
      console.log('📚 See tests/README.md for detailed fix instructions');
    } else {
      console.log('✅ All tests PASSED! OpenAI integration is working correctly.');
      console.log('');
      console.log('🎉 The OpenAI API integration has been successfully fixed!');
    }
  });

  vitest.on('error', (error) => {
    console.error('Error running tests:', error);
    console.log('\n💡 Try running manually: npx vitest tests/openai-fix-validation.test.mjs');
  });
}

// Run the tests
runTests();