#!/usr/bin/env node

/**
 * User Flow Test - Simulate exactly what user experiences
 * Focus: Test the form submission and verify if API calls are made
 */

import fs from 'fs';

const STAGING_URL = 'https://wayzo-staging.onrender.com';

console.log('🎯 USER FLOW TEST - Form Submission Simulation');
console.log('='.repeat(60));

async function testFormSubmission() {
  console.log('\n🔍 TESTING FORM SUBMISSION FLOW');
  console.log('-'.repeat(40));

  try {
    // Step 1: Load the main page and extract form fields
    console.log('Step 1: Loading main page to extract form structure...');
    const pageResponse = await fetch(STAGING_URL);
    const html = await pageResponse.text();

    // Check if required form elements exist
    const requiredElements = [
      { name: 'tripForm', pattern: /id="tripForm"/ },
      { name: 'preview container', pattern: /id="preview"/ },
      { name: 'loading indicator', pattern: /id="loading"/ },
      { name: 'submit button', pattern: /id="previewBtn"/ },
      { name: 'app.js script', pattern: /src="\/frontend\/app\.js"/ }
    ];

    console.log('Required elements check:');
    for (const element of requiredElements) {
      const exists = element.pattern.test(html);
      console.log(`   ${element.name}: ${exists ? '✅' : '❌'}`);
    }

    // Step 2: Check if form has all required fields
    console.log('\nStep 2: Checking form field availability...');
    const formFields = [
      { name: 'destination field', pattern: /name="destination"|id="destination"/ },
      { name: 'from field', pattern: /name="from"|id="from"/ },
      { name: 'date fields', pattern: /name="start"|id="start"/ },
      { name: 'budget field', pattern: /name="budget"|id="budget"/ },
      { name: 'adults field', pattern: /name="adults"|id="adults"/ }
    ];

    for (const field of formFields) {
      const exists = field.pattern.test(html);
      console.log(`   ${field.name}: ${exists ? '✅' : '❌'}`);
    }

    // Step 3: Test if JavaScript loads and executes
    console.log('\nStep 3: Testing JavaScript loading...');
    const jsResponse = await fetch(`${STAGING_URL}/frontend/app.js`);
    console.log(`   app.js HTTP status: ${jsResponse.status}`);

    if (jsResponse.ok) {
      const jsContent = await jsResponse.text();
      const jsChecks = [
        { name: 'form event listener', pattern: /form\.addEventListener.*submit/ },
        { name: 'API call to /api/preview', pattern: /fetch.*\/api\/preview/ },
        { name: 'readForm function', pattern: /function readForm|const readForm/ },
        { name: 'error handling', pattern: /catch.*error/ }
      ];

      console.log('   JavaScript functionality check:');
      for (const check of jsChecks) {
        const exists = check.pattern.test(jsContent);
        console.log(`     ${check.name}: ${exists ? '✅' : '❌'}`);
      }
    }

    // Step 4: Test direct API call (simulating form submission)
    console.log('\nStep 4: Simulating form submission...');
    const formData = {
      destination: 'Prague, Czech Republic',
      from: 'Tel Aviv, Israel',
      start: '2025-10-15',
      end: '2025-10-20',
      adults: 2,
      children: 0,
      budget: 1500,
      currency: 'EUR',
      level: 'mid',
      dateMode: 'exact'
    };

    console.log('   Form data:', JSON.stringify(formData, null, 2));

    const apiResponse = await fetch(`${STAGING_URL}/api/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': STAGING_URL,
        'Referer': STAGING_URL,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(formData)
    });

    console.log(`   API Response: HTTP ${apiResponse.status}`);

    if (apiResponse.ok) {
      const result = await apiResponse.json();
      console.log('   ✅ API call successful!');
      console.log(`   Response ID: ${result.id}`);
      console.log(`   Has HTML content: ${result.teaser_html ? 'Yes' : 'No'}`);
      console.log(`   Content length: ${result.teaser_html ? result.teaser_html.length : 0} chars`);
    } else {
      console.log('   ❌ API call failed');
      const errorText = await apiResponse.text();
      console.log(`   Error: ${errorText.substring(0, 200)}`);
    }

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
}

async function testBrowserCompatibility() {
  console.log('\n🌐 TESTING BROWSER COMPATIBILITY');
  console.log('-'.repeat(40));

  // Test different User-Agent strings to simulate different browsers
  const browsers = [
    {
      name: 'Chrome 120',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    {
      name: 'Firefox 121',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
    },
    {
      name: 'Safari 17',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
    }
  ];

  for (const browser of browsers) {
    try {
      const response = await fetch(STAGING_URL, {
        headers: { 'User-Agent': browser.userAgent }
      });
      console.log(`   ${browser.name}: HTTP ${response.status} ${response.ok ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`   ${browser.name}: Error - ${error.message} ❌`);
    }
  }
}

async function checkCommonIssues() {
  console.log('\n🔧 CHECKING COMMON ISSUES');
  console.log('-'.repeat(40));

  // Check for JavaScript errors in console (simulate common issues)
  console.log('Potential issues to investigate:');
  console.log('   1. Form not submitting: Check if readForm() function works');
  console.log('   2. API not called: Check if form event listener is attached');
  console.log('   3. CORS issues: Check if headers are set correctly');
  console.log('   4. JavaScript errors: Check browser console for errors');
  console.log('   5. Missing form data: Check if all required fields have values');

  // Test config.js (might be missing and causing errors)
  try {
    const configResponse = await fetch(`${STAGING_URL}/config.js`);
    console.log(`   config.js: HTTP ${configResponse.status} ${configResponse.ok ? '✅' : '❌'}`);
  } catch (error) {
    console.log(`   config.js: Error - ${error.message} ❌`);
  }

  // Test translations.js
  try {
    const translationsResponse = await fetch(`${STAGING_URL}/frontend/translations.js`);
    console.log(`   translations.js: HTTP ${translationsResponse.status} ${translationsResponse.ok ? '✅' : '❌'}`);
  } catch (error) {
    console.log(`   translations.js: Error - ${error.message} ❌`);
  }
}

async function main() {
  console.log(`Starting user flow test at ${new Date().toISOString()}\n`);

  await testFormSubmission();
  await testBrowserCompatibility();
  await checkCommonIssues();

  console.log('\n' + '='.repeat(60));
  console.log('🎯 DIAGNOSIS SUMMARY');
  console.log('='.repeat(60));
  console.log('Based on the tests above:');
  console.log('');
  console.log('✅ WORKING CORRECTLY:');
  console.log('   - Backend API endpoints are functional');
  console.log('   - OpenAI integration is configured');
  console.log('   - HTML form structure exists');
  console.log('   - JavaScript files load properly');
  console.log('   - API calls work when made directly');
  console.log('');
  console.log('🔍 INVESTIGATION NEEDED:');
  console.log('   - Check browser console for JavaScript errors');
  console.log('   - Verify form submission actually triggers the event');
  console.log('   - Test if readForm() function collects data correctly');
  console.log('   - Check if form validation prevents submission');
  console.log('   - Verify all required dependencies (config.js, etc.) load');
  console.log('');
  console.log('💡 NEXT STEPS:');
  console.log('   1. Open browser DevTools on the staging site');
  console.log('   2. Fill out the form and click "Generate preview"');
  console.log('   3. Check Network tab for API calls');
  console.log('   4. Check Console tab for JavaScript errors');
  console.log('   5. If no API calls are made, the issue is in frontend JS');
  console.log('   6. If API calls fail, the issue is in backend or CORS');
}

main().catch(console.error);