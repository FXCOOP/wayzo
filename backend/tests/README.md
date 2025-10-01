# WAYZO COMPREHENSIVE TESTING GUIDE

This directory contains comprehensive tests for validating fixes to 12 critical issues identified in the Wayzo trip planning application. The testing strategy is organized by priority levels and includes unit tests, integration tests, and end-to-end tests.

## Critical Issues Being Tested

### HIGH PRIORITY (Fix First)
1. **GPT API Integration Broken** - `client.responses.create()` doesn't exist, wrong model names
2. **Location Autofill Completely Broken** - `detectUserLocation()` not populating form fields
3. **Weather Table Corruption** - Malformed table with bleeding content
4. **Budget Table Duplication** - Two conflicting budget sections generated

### MEDIUM PRIORITY (Fix Second)
5. **Content Validation Missing** - No validation of generated content before display
6. **Widget Integration Problems** - Booking widgets not auto-populated with trip data
7. **Mobile Responsiveness Issues** - Tables break on mobile devices
8. **Incomplete Content Generation** - Cut-off sentences and missing data

### LOW PRIORITY (Fix Last)
9. **Date Validation Missing** - No prevention of past dates or invalid ranges
10. **Pricing Consistency Issues** - Mixed currencies and inconsistent formats
11. **Error Handling Missing** - No graceful fallbacks for failed generation
12. **Data Quality Inconsistencies** - Some sections good, others broken

## 🚨 OpenAI Integration Issues (HIGH PRIORITY #1)

The current OpenAI integration has several critical bugs that prevent it from working:

### 1. **Invalid API Method** - `client.responses.create()`
- **Problem**: The code uses `client.responses.create()` which doesn't exist in the OpenAI API
- **Location**: `server.mjs` line ~761
- **Fix**: Replace with `client.chat.completions.create()`

### 2. **Non-existent Model** - `gpt-5-nano-2025-08-07`
- **Problem**: This model doesn't exist in OpenAI's API
- **Location**: `server.mjs` line ~699
- **Fix**: Use `gpt-4o-mini` or `gpt-4o-mini-2024-07-18`

### 3. **Invalid Request Parameters**
- **Problem**: Uses `input` and `max_output_tokens` (wrong parameter names)
- **Fix**: Use `messages` and `max_tokens`

### 4. **Broken Response Parsing**
- **Problem**: Tries to parse `resp.output_text` (doesn't exist)
- **Location**: `server.mjs` line ~767
- **Fix**: Use `resp.choices[0].message.content`

## Test Structure

```
backend/tests/
├── run-critical-tests.mjs          # Main test runner
├── critical-fixes-unit.test.mjs    # Unit tests for individual functions
├── e2e/
│   ├── critical-fixes.test.js      # E2E tests for user journeys
│   └── playwright.test.js          # Existing regression tests
├── openai-integration.test.mjs     # OpenAI API tests
├── api-endpoints-openai.test.mjs   # API endpoint tests
└── README.md                       # This file
```

## Quick Start

### Prerequisites

1. **Environment Setup**:
   ```bash
   # Backend dependencies
   cd backend && npm install

   # Environment variables
   export OPENAI_API_KEY="your-openai-key"
   export NODE_ENV="development"
   ```

2. **Start Services**:
   ```bash
   # Terminal 1: Start backend
   cd backend && npm start

   # Terminal 2: Start frontend
   cd frontend && python3 -m http.server 8000
   ```

3. **Verify Services**:
   ```bash
   curl http://localhost:8000        # Frontend should respond
   curl http://localhost:10000       # Backend should respond
   ```

### Running Tests

#### Run All Tests
```bash
cd backend
node tests/run-critical-tests.mjs
```

#### Run by Priority Level
```bash
# High priority only
node tests/run-critical-tests.mjs --priority=high

# Medium priority only
node tests/run-critical-tests.mjs --priority=medium

# Low priority only
node tests/run-critical-tests.mjs --priority=low
```

#### Run Specific Test Categories
```bash
# Unit tests only
npm run test critical-fixes-unit.test.mjs

# Integration tests only
npm run test:openai

# E2E tests only
npx playwright test tests/e2e/critical-fixes.test.js

# Existing regression tests
npx playwright test tests/e2e/playwright.test.js
```

#### Development Options
```bash
# Verbose output
node tests/run-critical-tests.mjs --verbose

# Skip E2E tests (faster for development)
node tests/run-critical-tests.mjs --skip-e2e

# Watch mode for unit tests
npm run test:watch critical-fixes-unit.test.mjs
```

## 📋 Test Files Overview

### 1. Unit Tests (`critical-fixes-unit.test.mjs`)

Tests individual functions and components in isolation:

- **OpenAI API Integration**: Validates correct API methods and model names
- **Location Detection**: Tests geolocation API calls and form population
- **Weather Table Generation**: Validates HTML structure and content sanitization
- **Budget Deduplication**: Tests budget consolidation logic
- **Content Validation**: Tests validation helper functions

```bash
# Run specific unit test groups
npm run test critical-fixes-unit.test.mjs -- --grep "GPT API Integration"
npm run test critical-fixes-unit.test.mjs -- --grep "Location Autofill"
npm run test critical-fixes-unit.test.mjs -- --grep "Weather Table"
npm run test critical-fixes-unit.test.mjs -- --grep "Budget Table"
```

### 2. Integration Tests

Tests API endpoints and component interactions:

- **OpenAI Integration** (`openai-integration.test.mjs`): Full AI API workflow
- **API Endpoints** (`api-endpoints-openai.test.mjs`): HTTP endpoint testing
- **Server Functions** (`server-openai-functions.test.mjs`): Server-side logic

```bash
npm run test:openai                            # All OpenAI tests
npm run test tests/api-endpoints-openai.test.mjs
npm run test tests/server-openai-functions.test.mjs
```

### 3. End-to-End Tests (`e2e/critical-fixes.test.js`)

Tests complete user journeys using Playwright:

- **HIGH PRIORITY**: Core functionality that must work
- **MEDIUM PRIORITY**: Important features for user experience
- **LOW PRIORITY**: Nice-to-have improvements
- **INTEGRATION**: Complete user flows

```bash
# Run all E2E tests
npx playwright test tests/e2e/critical-fixes.test.js

# Run by priority
npx playwright test tests/e2e/critical-fixes.test.js --grep "HIGH PRIORITY"
npx playwright test tests/e2e/critical-fixes.test.js --grep "MEDIUM PRIORITY"
npx playwright test tests/e2e/critical-fixes.test.js --grep "LOW PRIORITY"

# Run with UI (for debugging)
npx playwright test tests/e2e/critical-fixes.test.js --ui

# Run in specific browser
npx playwright test tests/e2e/critical-fixes.test.js --project=chromium
```

### Legacy OpenAI Tests

- **`openai-integration.test.mjs`**: Core OpenAI API integration tests
- **`server-openai-functions.test.mjs`**: Tests specific functions from `server.mjs`
- **`api-endpoints-openai.test.mjs`**: Integration tests for API endpoints
- **`openai-fix-validation.test.mjs`**: Documents exact fixes needed

## 🛠️ Running the Tests

### Install Dependencies
```bash
cd backend
npm install
```

### Run All OpenAI Tests
```bash
npm run test:openai
```

### Run Specific Test Files
```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Run with coverage
npm run test:coverage

# Run only failing tests (TDD mode)
npm run test:run
```

### Run Individual Test Files
```bash
# Core integration tests
npx vitest tests/openai-integration.test.mjs

# Server function tests
npx vitest tests/server-openai-functions.test.mjs

# API endpoint tests
npx vitest tests/api-endpoints-openai.test.mjs

# Fix validation tests (start here!)
npx vitest tests/openai-fix-validation.test.mjs
```

## 🔧 TDD Process

### Current State: All Tests FAIL ❌
The tests are designed to **fail** with the current broken implementation. This is intentional and follows TDD principles.

### Expected Results After Fixes: All Tests PASS ✅
Once the OpenAI integration is properly fixed, all tests should pass.

### Step-by-Step Fix Process

1. **Start with Fix Validation Tests**
   ```bash
   npx vitest tests/openai-fix-validation.test.mjs --reporter=verbose
   ```

2. **Apply the documented fixes** (see "Exact Fixes Required" below)

3. **Run tests incrementally** to verify each fix

4. **All tests should pass** when implementation is correct

## 🔍 Exact Fixes Required

### Fix 1: Replace Invalid API Method
**File**: `server.mjs` ~line 761

**Replace this**:
```javascript
const resp = await client.responses.create({
  model: preferredModel,
  input: `${sys}\n\n${user}`,
  max_output_tokens: maxTokens,
});
```

**With this**:
```javascript
const resp = await client.chat.completions.create({
  model: preferredModel,
  messages: [{ role: 'user', content: `${sys}\n\n${user}` }],
  max_tokens: maxTokens,
});
```

### Fix 2: Replace Invalid Model
**File**: `server.mjs` ~line 699

**Replace this**:
```javascript
const preferredModel = process.env.WAYZO_MODEL || 'gpt-5-nano-2025-08-07';
```

**With this**:
```javascript
const preferredModel = process.env.WAYZO_MODEL || 'gpt-4o-mini';
```

### Fix 3: Fix Response Parsing
**File**: `server.mjs` ~line 767

**Replace this**:
```javascript
respText = resp.output_text || resp?.output?.[0]?.content?.[0]?.text || resp?.content || '';
```

**With this**:
```javascript
respText = resp.choices?.[0]?.message?.content || '';
```

### Fix 4: Remove Nano Logic
**File**: `server.mjs` ~line 702

**Replace this**:
```javascript
const isNano = preferredModel.includes('gpt-5-nano');
```

**With this**:
```javascript
const isValidModel = ['gpt-4o-mini', 'gpt-4o-2024-08-06', 'gpt-4-turbo'].includes(preferredModel);
```

### Fix 5: Update Conditional Logic
**File**: `server.mjs` ~lines 759-780

**Replace the entire `if (isNano)` block with proper chat completions API calls**

## 🧪 Test Strategy

### Mock-Based Testing
- All tests use mocked OpenAI clients
- No real API calls are made during testing
- Consistent, reliable test results

### Error Simulation
- Tests simulate the actual errors that occur with broken code
- Validates both error cases and success cases
- Ensures proper fallback behavior

### Integration Testing
- Tests full request/response cycle through API endpoints
- Validates end-to-end functionality
- Includes image upload and vision model testing

### Regression Prevention
- Tests validate that fixes don't break existing functionality
- Comprehensive coverage of edge cases
- Environment configuration validation

## 📊 Expected Test Results

### Before Fixes (Current State)
```
❌ FAIL tests/openai-integration.test.mjs
❌ FAIL tests/server-openai-functions.test.mjs
❌ FAIL tests/api-endpoints-openai.test.mjs
❌ FAIL tests/openai-fix-validation.test.mjs
```

### After Fixes (Target State)
```
✅ PASS tests/openai-integration.test.mjs
✅ PASS tests/server-openai-functions.test.mjs
✅ PASS tests/api-endpoints-openai.test.mjs
✅ PASS tests/openai-fix-validation.test.mjs
```

## 🚀 Getting Started

1. **Install dependencies**: `npm install`
2. **Run fix validation tests**: `npm run test:openai`
3. **Review failing tests** to understand issues
4. **Apply documented fixes** in exact order
5. **Re-run tests** to verify fixes
6. **All tests should pass** when complete

## 🔗 Related Files

- **Main Server**: `../server.mjs` (contains broken OpenAI integration)
- **OpenAI Client**: Lines 448-458 (getOpenAIClient function)
- **Plan Generation**: Lines 459-976 (generatePlanWithAI function)
- **Environment Config**: `.env` file (model configuration)

## 📝 Notes

- Tests use Vitest framework for fast, modern testing
- All tests are written in ES modules (`.mjs` files)
- Comprehensive mock setup in `setup.mjs`
- Test configuration in `vitest.config.mjs`

The tests serve as both validation and documentation for the required fixes. Start with the fix validation tests to understand exactly what needs to be changed.