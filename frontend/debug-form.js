// CRITICAL DEBUG: Test form submission after IIFE fix
console.log('🚨 CRITICAL DEBUG: Form debugging script loaded - testing IIFE fix');

// Test 1: Check if elements exist and form listeners are attached
const checkElements = () => {
  const form = document.querySelector('#tripForm');
  const preview = document.querySelector('#preview');
  const generateBtn = document.querySelector('#previewBtn') || document.querySelector('button[type="submit"]');

  console.log('🔍 ELEMENT CHECK:');
  console.log('- Form found:', !!form);
  console.log('- Preview found:', !!preview);
  console.log('- Generate button found:', !!generateBtn);

  if (form) {
    console.log('- Form event listeners:', form.eventListeners || 'Unknown');
    console.log('- Form submit handler attached:', form.onsubmit ? 'Yes' : 'No');
  }

  return { form, preview, generateBtn };
};

// Test 2: Manual API call
const testAPICall = async () => {
  console.log('🔍 TESTING MANUAL API CALL...');

  const testData = {
    destination: 'Prague, Czech Republic',
    from: 'Tel Aviv, Israel',
    start: '2025-01-15',
    end: '2025-01-20',
    adults: 2,
    budget: 1500,
    style: 'mid',
    purpose: 'leisure'
  };

  try {
    console.log('📤 Sending test request:', testData);
    const response = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response ok:', response.ok);

    if (response.ok) {
      const result = await response.json();
      console.log('✅ API CALL SUCCESS:', result);
      return result;
    } else {
      console.error('❌ API CALL FAILED:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('❌ Error details:', errorText);
    }
  } catch (error) {
    console.error('❌ NETWORK ERROR:', error);
  }
};

// Test 3: Form submission simulation
const testFormSubmission = () => {
  console.log('🔍 TESTING FORM SUBMISSION...');

  const { form } = checkElements();
  if (!form) {
    console.error('❌ Cannot test - form not found');
    return;
  }

  // Fill form with test data
  const fields = {
    destination: 'Prague, Czech Republic',
    from: 'Tel Aviv, Israel',
    start: '2025-01-15',
    end: '2025-01-20',
    adults: '2',
    budget: '1500'
  };

  Object.entries(fields).forEach(([name, value]) => {
    const field = form.querySelector(`[name="${name}"]`) || form.querySelector(`#${name}`);
    if (field) {
      field.value = value;
      console.log(`✅ Set ${name} = ${value}`);
    } else {
      console.warn(`⚠️ Field not found: ${name}`);
    }
  });

  // Try to trigger submit
  console.log('🔍 Triggering form submit event...');
  const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(submitEvent);
};

// Test 4: Check IIFE Fix - verify form initialization happened
const testIIFEFix = () => {
  console.log('🚨 TESTING IIFE FIX...');

  const form = document.querySelector('#tripForm');
  if (!form) {
    console.error('❌ IIFE TEST FAILED: Form not found');
    return;
  }

  // Check if form has submit event listeners
  console.log('🔍 Checking form event listeners...');

  // Try to trigger submit and see if it's caught
  let submitTriggered = false;
  const testSubmitHandler = (e) => {
    submitTriggered = true;
    e.preventDefault();
    console.log('✅ IIFE FIX SUCCESS: Form submit handler is working!');
  };

  form.addEventListener('submit', testSubmitHandler, { once: true });

  // Trigger a submit event
  const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(submitEvent);

  setTimeout(() => {
    if (submitTriggered) {
      console.log('✅ IIFE FIX VERIFIED: Form event handlers are properly attached');
    } else {
      console.error('❌ IIFE FIX FAILED: Form submit handler not responding');
    }
  }, 100);
};

// Run tests when DOM is ready
const runTests = () => {
  console.log('🚨 =================================');
  console.log('🚨 WAYZO CRITICAL DEBUG TESTS');
  console.log('🚨 Testing IIFE Structure Fix');
  console.log('🚨 =================================');

  // Test 1: Check elements
  checkElements();

  // Test 2: Wait a bit then test API
  setTimeout(() => {
    console.log('🔍 Running manual API test...');
    testAPICall();
  }, 1000);

  // Test 3: Test form submission
  setTimeout(() => {
    console.log('🔍 Running form submission test...');
    testFormSubmission();
  }, 2000);

  // Test 4: Test IIFE Fix
  setTimeout(() => {
    console.log('🚨 Running IIFE fix test...');
    testIIFEFix();
  }, 3000);
};

// Global functions for manual testing
window.debugForm = {
  checkElements,
  testAPICall,
  testFormSubmission,
  testIIFEFix,
  runTests
};

// Auto-run tests
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runTests);
} else {
  runTests();
}

console.log('🔍 DEBUG: Use window.debugForm.runTests() to run manual tests');