/**
 * Vitest Configuration for Wayzo Backend OpenAI Integration Tests
 *
 * This configuration sets up proper testing environment for TDD tests
 * targeting the broken OpenAI integration issues.
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Test files
    include: [
      'tests/**/*.test.{js,mjs,ts}',
      'tests/**/*.spec.{js,mjs,ts}'
    ],

    // Exclude E2E tests (they have their own config)
    exclude: [
      'tests/e2e/**/*',
      'node_modules/**/*',
      'dist/**/*'
    ],

    // Global setup
    globals: true,

    // Test timeout (important for API tests)
    testTimeout: 10000,

    // Mock configuration
    clearMocks: true,
    restoreMocks: true,

    // Environment variables for testing
    env: {
      NODE_ENV: 'test',
      OPENAI_API_KEY: 'sk-test1234567890abcdef',
      WAYZO_MODEL: 'gpt-5-nano-2025-08-07' // Intentionally broken for TDD
    },

    // Coverage settings
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'server.mjs',
        'lib/**/*.mjs'
      ],
      exclude: [
        'tests/**/*',
        'node_modules/**/*'
      ]
    },

    // Reporter configuration
    reporter: ['verbose', 'json'],

    // Setup files
    setupFiles: ['./tests/setup.mjs']
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@lib': path.resolve(__dirname, 'lib'),
      '@tests': path.resolve(__dirname, 'tests')
    }
  }
});