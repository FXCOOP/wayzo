#!/usr/bin/env node

/**
 * Critical API Integration Test for Wayzo Staging
 * Tests the deployed application at https://wayzo-staging.onrender.com
 *
 * FOCUS: Identify exactly where the OpenAI API call chain is breaking
 */

import fs from 'fs';

const STAGING_URL = 'https://wayzo-staging.onrender.com';
const TEST_DATA = {
  destination: 'Prague, Czech Republic',
  from: 'Tel Aviv, Israel',
  start: '2025-10-15',
  end: '2025-10-20',
  adults: 2,
  children: 0,
  budget: 1500,
  currency: 'EUR',
  level: 'mid',
  dateMode: 'exact',
  dietary: [],
  interests: ['culture', 'food']
};

console.log('🔴 CRITICAL API INTEGRATION TEST - Wayzo Staging');
console.log('='.repeat(60));
console.log(`Testing: ${STAGING_URL}`);
console.log('Issue: User reports "still not calling the api"');
console.log('='.repeat(60));

async function testHealthEndpoints() {
  console.log('\n1️⃣ TESTING HEALTH ENDPOINTS');
  console.log('-'.repeat(40));

  const endpoints = [
    '/healthz',
    '/version',
    '/api/debug'
  ];

  for (const endpoint of endpoints) {
    try {
      const url = `${STAGING_URL}${endpoint}`;
      console.log(`Testing: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Wayzo-Test-Agent'
        }
      });

      const text = await response.text();
      console.log(`✅ ${endpoint}: HTTP ${response.status}`);

      if (endpoint === '/api/debug') {
        try {
          const data = JSON.parse(text);
          console.log(`   OpenAI Key: ${data.hasOpenAIKey ? '✅' : '❌'}`);
          console.log(`   Key Length: ${data.keyLength || 'N/A'}`);
          console.log(`   Client Init: ${data.clientInitialized ? '✅' : '❌'}`);
          console.log(`   Model: ${data.preferredModel || 'N/A'}`);
        } catch (e) {
          console.log(`   Response: ${text.substring(0, 200)}`);
        }
      } else {
        console.log(`   Response: ${text.substring(0, 100)}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint}: ${error.message}`);
    }
  }
}

async function testFrontendAccess() {
  console.log('\n2️⃣ TESTING FRONTEND ACCESS');
  console.log('-'.repeat(40));

  try {
    const response = await fetch(STAGING_URL, {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Wayzo-Test-Agent'
      }
    });

    console.log(`Frontend access: HTTP ${response.status}`);
    const html = await response.text();

    // Check if the main application files are loaded
    const checks = [
      { name: 'app.js', pattern: /app\.js/i },
      { name: 'form element', pattern: /tripForm/i },
      { name: 'API calls', pattern: /\/api\/preview/i },
      { name: 'fetch calls', pattern: /fetch.*\/api/i }
    ];

    for (const check of checks) {
      const found = check.pattern.test(html);
      console.log(`   ${check.name}: ${found ? '✅' : '❌'}`);
    }

    // Save HTML for manual inspection
    fs.writeFileSync('./staging-homepage.html', html);
    console.log('   📄 Homepage saved as staging-homepage.html');

  } catch (error) {
    console.log(`❌ Frontend access failed: ${error.message}`);
  }
}

async function testPreviewAPI() {
  console.log('\n3️⃣ TESTING PREVIEW API (/api/preview)');
  console.log('-'.repeat(40));

  try {
    const url = `${STAGING_URL}/api/preview`;
    console.log(`Testing: ${url}`);
    console.log(`Request data:`, JSON.stringify(TEST_DATA, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Wayzo-Test-Agent'
      },
      body: JSON.stringify(TEST_DATA)
    });

    console.log(`Preview API: HTTP ${response.status}`);

    const responseText = await response.text();
    console.log(`Response length: ${responseText.length} characters`);

    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('✅ Preview API successful!');
        console.log(`   ID: ${data.id || 'N/A'}`);
        console.log(`   Has teaser_html: ${data.teaser_html ? '✅' : '❌'}`);
        console.log(`   Has affiliates: ${data.affiliates ? '✅' : '❌'}`);
        console.log(`   Version: ${data.version || 'N/A'}`);

        // Save preview response
        fs.writeFileSync('./staging-preview-response.json', JSON.stringify(data, null, 2));
        console.log('   📄 Preview response saved as staging-preview-response.json');

        return data.id; // Return ID for full plan test
      } catch (parseError) {
        console.log(`❌ Invalid JSON response: ${parseError.message}`);
        console.log(`Raw response: ${responseText.substring(0, 500)}`);
      }
    } else {
      console.log(`❌ Preview API failed: ${response.status} ${response.statusText}`);
      console.log(`Error response: ${responseText.substring(0, 500)}`);
    }

  } catch (error) {
    console.log(`❌ Preview API error: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.log('   🚨 CONNECTION REFUSED - Server might be down');
    } else if (error.code === 'ENOTFOUND') {
      console.log('   🚨 DOMAIN NOT FOUND - DNS issue');
    }
  }

  return null;
}

async function testFullPlanAPI(planId) {
  console.log('\n4️⃣ TESTING FULL PLAN API (/api/plan)');
  console.log('-'.repeat(40));

  try {
    const url = `${STAGING_URL}/api/plan`;
    console.log(`Testing: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Wayzo-Test-Agent'
      },
      body: JSON.stringify(TEST_DATA)
    });

    console.log(`Full Plan API: HTTP ${response.status}`);

    const responseText = await response.text();
    console.log(`Response length: ${responseText.length} characters`);

    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('✅ Full Plan API successful!');
        console.log(`   ID: ${data.id || 'N/A'}`);
        console.log(`   Has html: ${data.html ? '✅' : '❌'}`);
        console.log(`   Uses OpenAI: ${data.html && data.html.includes('Day 1') ? '✅' : '❌'}`);

        // Save full plan response
        fs.writeFileSync('./staging-fullplan-response.json', JSON.stringify(data, null, 2));
        console.log('   📄 Full plan response saved as staging-fullplan-response.json');

      } catch (parseError) {
        console.log(`❌ Invalid JSON response: ${parseError.message}`);
        console.log(`Raw response: ${responseText.substring(0, 500)}`);
      }
    } else {
      console.log(`❌ Full Plan API failed: ${response.status} ${response.statusText}`);
      console.log(`Error response: ${responseText.substring(0, 500)}`);
    }

  } catch (error) {
    console.log(`❌ Full Plan API error: ${error.message}`);
  }
}

async function testCORSAndPreflight() {
  console.log('\n5️⃣ TESTING CORS AND PREFLIGHT');
  console.log('-'.repeat(40));

  try {
    // Test OPTIONS preflight request
    const preflightResponse = await fetch(`${STAGING_URL}/api/preview`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://wayzo-staging.onrender.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    console.log(`CORS Preflight: HTTP ${preflightResponse.status}`);
    console.log(`   CORS Headers:`);
    console.log(`     Access-Control-Allow-Origin: ${preflightResponse.headers.get('access-control-allow-origin') || 'Not set'}`);
    console.log(`     Access-Control-Allow-Methods: ${preflightResponse.headers.get('access-control-allow-methods') || 'Not set'}`);
    console.log(`     Access-Control-Allow-Headers: ${preflightResponse.headers.get('access-control-allow-headers') || 'Not set'}`);

  } catch (error) {
    console.log(`❌ CORS test failed: ${error.message}`);
  }
}

async function performBrowserSimulation() {
  console.log('\n6️⃣ BROWSER SIMULATION TEST');
  console.log('-'.repeat(40));

  try {
    // Simulate browser behavior - get page first, then make API call
    console.log('Step 1: Loading main page...');
    const pageResponse = await fetch(STAGING_URL, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (pageResponse.ok) {
      console.log('✅ Page loaded successfully');

      console.log('Step 2: Making API call from same origin...');
      const apiResponse = await fetch(`${STAGING_URL}/api/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': STAGING_URL,
          'Referer': STAGING_URL,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify(TEST_DATA)
      });

      console.log(`API from same origin: HTTP ${apiResponse.status}`);
      if (apiResponse.ok) {
        console.log('✅ Same-origin API call successful');
      } else {
        console.log('❌ Same-origin API call failed');
        const errorText = await apiResponse.text();
        console.log(`   Error: ${errorText.substring(0, 200)}`);
      }
    } else {
      console.log('❌ Failed to load main page');
    }

  } catch (error) {
    console.log(`❌ Browser simulation failed: ${error.message}`);
  }
}

async function main() {
  console.log(`\n🚀 Starting comprehensive API test at ${new Date().toISOString()}`);

  // Run all tests
  await testHealthEndpoints();
  await testFrontendAccess();
  const planId = await testPreviewAPI();
  await testFullPlanAPI(planId);
  await testCORSAndPreflight();
  await performBrowserSimulation();

  console.log('\n' + '='.repeat(60));
  console.log('🔍 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('Files created:');
  console.log('  - staging-homepage.html (frontend HTML)');
  console.log('  - staging-preview-response.json (API response)');
  console.log('  - staging-fullplan-response.json (full plan response)');
  console.log('\n🎯 KEY FINDINGS TO REPORT:');
  console.log('1. Check if /api/debug shows OpenAI configuration');
  console.log('2. Check if /api/preview returns valid response');
  console.log('3. Check if frontend HTML contains correct API calls');
  console.log('4. Check for any CORS issues');
  console.log('5. Verify if server is responding at all');
  console.log('\n📊 This test will identify exactly where the API chain breaks!');
}

// Run the test
main().catch(console.error);