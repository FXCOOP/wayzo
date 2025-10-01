#!/usr/bin/env node

// Direct test of API endpoints to validate fixes
console.log('🔍 TESTING API ENDPOINTS FOR FIXED ISSUES\n');

// Test the debug endpoint to check OpenAI configuration
async function testDebugEndpoint() {
  try {
    console.log('1. Testing /api/debug endpoint...');
    const response = await fetch('http://localhost:10000/api/debug');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Debug endpoint response:', JSON.stringify(data, null, 2));

    if (data.hasOpenAIKey) {
      console.log('✅ OpenAI API key is configured');
    } else {
      console.log('❌ OpenAI API key is missing');
    }

    if (data.preferredModel === 'gpt-4o-mini-2024-07-18') {
      console.log('✅ Using correct model: gpt-4o-mini-2024-07-18');
    } else {
      console.log(`❌ Wrong model: ${data.preferredModel}`);
    }

    if (data.clientInitialized) {
      console.log('✅ OpenAI client is initialized');
    } else {
      console.log('❌ OpenAI client failed to initialize');
    }

  } catch (error) {
    console.log('❌ Debug endpoint test failed:', error.message);
  }
}

// Test a simple plan generation to check budget and weather fixes
async function testPlanGeneration() {
  try {
    console.log('\n2. Testing plan generation with Czech Republic...');

    const testPayload = {
      destination: 'Prague, Czech Republic',
      start: '2025-10-03',
      end: '2025-10-10',
      budget: '', // Empty budget to test normalization fix
      currency: 'USD',
      adults: 2,
      children: 0,
      level: 'mid',
      prefs: 'historical sites, food',
      mode: 'preview'
    };

    console.log('Test payload:', JSON.stringify(testPayload, null, 2));

    const response = await fetch('http://localhost:10000/api/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log('✅ Preview generation successful');
    console.log('Preview ID:', data.id);
    console.log('Affiliates:', Object.keys(data.affiliates || {}));

    if (data.teaser_html) {
      console.log('✅ Teaser HTML generated');

      // Check if budget shows a reasonable value instead of 0
      if (data.teaser_html.includes('$0') || data.teaser_html.includes('0 USD')) {
        console.log('❌ Budget still showing $0 - fix may not be applied');
      } else {
        console.log('✅ Budget appears to have reasonable values');
      }
    }

  } catch (error) {
    console.log('❌ Plan generation test failed:', error.message);
  }
}

// Test a full plan generation to check weather table
async function testFullPlanGeneration() {
  try {
    console.log('\n3. Testing full plan generation...');

    const testPayload = {
      destination: 'Prague, Czech Republic',
      start: '2025-10-03',
      end: '2025-10-10',
      budget: 2500,
      currency: 'USD',
      adults: 2,
      children: 0,
      level: 'mid',
      prefs: 'historical sites, food'
    };

    const response = await fetch('http://localhost:10000/api/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log('✅ Full plan generation successful');

    if (data.html) {
      console.log('✅ HTML generated');

      // Check for weather table issues
      if (data.html.includes('🌤️ Weather Forecast')) {
        console.log('✅ Weather forecast section found');

        // Check for corrupted table headers
        if (data.html.includes('Rtails') || data.html.includes('3w') || data.html.includes('iew')) {
          console.log('❌ Weather table still has corruption issues');
        } else {
          console.log('✅ Weather table appears to be properly formatted');
        }

        // Check for proper rain column
        if (data.html.includes('🌧️ Rain')) {
          console.log('✅ Rain column header found');
        } else {
          console.log('❌ Rain column header missing');
        }
      } else {
        console.log('❌ Weather forecast section not found');
      }

      // Check budget breakdown
      if (data.html.includes('💰') && data.html.includes('Budget')) {
        console.log('✅ Budget breakdown section found');

        if (data.html.includes('$0') || data.html.includes('0 USD')) {
          console.log('❌ Budget still shows $0 values');
        } else {
          console.log('✅ Budget appears to have realistic values');
        }
      }
    }

    if (data.markdown) {
      console.log('✅ Markdown generated');
      console.log('Plan length:', data.markdown.length, 'characters');
    }

  } catch (error) {
    console.log('❌ Full plan generation test failed:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting API endpoint validation tests...\n');

  await testDebugEndpoint();
  await testPlanGeneration();
  await testFullPlanGeneration();

  console.log('\n📋 TEST SUMMARY:');
  console.log('If all tests passed, the following issues should be resolved:');
  console.log('1. Budget calculation no longer returns 0 USD');
  console.log('2. Weather table corruption is fixed');
  console.log('3. OpenAI API is using correct model and syntax');
  console.log('4. Location detection has better error handling');
}

// Check if server is running first
async function checkServerHealth() {
  try {
    const response = await fetch('http://localhost:10000/healthz');
    if (response.ok) {
      console.log('✅ Backend server is running');
      return true;
    }
  } catch (error) {
    console.log('❌ Backend server is not running on localhost:10000');
    console.log('Please start the server with: cd backend && node server.mjs');
    return false;
  }
  return false;
}

// Main execution
checkServerHealth().then(isRunning => {
  if (isRunning) {
    runAllTests();
  }
});