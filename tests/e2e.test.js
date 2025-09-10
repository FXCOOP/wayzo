const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'https://wayzo-staging.onrender.com';
const TEST_DESTINATIONS = [
  'Berlin, Germany',
  'London, UK', 
  'Dubai, UAE',
  'Matera, Italy',
  'Ghent, Belgium',
  'Tbilisi, Georgia'
];

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  details: []
};

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function addResult(destination, test, passed, error = null) {
  testResults.details.push({
    destination,
    test,
    passed,
    error,
    timestamp: new Date().toISOString()
  });
  
  if (passed) {
    testResults.passed++;
    log(`${destination}: ${test} - PASSED`, 'success');
  } else {
    testResults.failed++;
    testResults.errors.push(`${destination}: ${test} - ${error}`);
    log(`${destination}: ${test} - FAILED: ${error}`, 'error');
  }
}

// Test functions
async function testLoadingMemo(page, destination) {
  try {
    // Wait for loading element to appear
    await page.waitForSelector('#loading', { timeout: 5000 });
    
    // Check if loading memo is present
    const loadingContent = await page.$eval('#loading', el => el.innerHTML);
    const hasMemo = loadingContent.includes('Your itinerary') && loadingContent.includes('Generating your perfect trip');
    
    addResult(destination, 'Loading Memo', hasMemo, hasMemo ? null : 'Loading memo not found');
    return hasMemo;
  } catch (error) {
    addResult(destination, 'Loading Memo', false, error.message);
    return false;
  }
}

async function testPostLoadNote(page, destination) {
  try {
    // Wait for preview to load
    await page.waitForSelector('#preview', { timeout: 60000 });
    
    // Check if post-load note is present
    const previewContent = await page.$eval('#preview', el => el.innerHTML);
    const hasNote = previewContent.includes('Plan loaded.');
    
    addResult(destination, 'Post-Load Note', hasNote, hasNote ? null : 'Post-load note not found');
    return hasNote;
  } catch (error) {
    addResult(destination, 'Post-Load Note', false, error.message);
    return false;
  }
}

async function testNoLegacyAffiliates(page, destination) {
  try {
    const content = await page.content();
    const hasLegacyAffiliates = /WayAway|TicketNetwork|booking\.com|Search and compare hotel prices/i.test(content);
    
    addResult(destination, 'No Legacy Affiliates', !hasLegacyAffiliates, hasLegacyAffiliates ? 'Legacy affiliates found' : null);
    return !hasLegacyAffiliates;
  } catch (error) {
    addResult(destination, 'No Legacy Affiliates', false, error.message);
    return false;
  }
}

async function testGYGLocalization(page, destination) {
  try {
    const content = await page.content();
    const hasLocalizedGYG = /widget\.getyourguide\.com.*\?q=.*&locale=en-US/.test(content);
    
    addResult(destination, 'GYG Localization', hasLocalizedGYG, hasLocalizedGYG ? null : 'GYG not localized');
    return hasLocalizedGYG;
  } catch (error) {
    addResult(destination, 'GYG Localization', false, error.message);
    return false;
  }
}

async function testGYGMultiSection(page, destination) {
  try {
    const content = await page.content();
    const gygCount = (content.match(/widget\.getyourguide\.com/g) || []).length;
    const hasMultiSection = gygCount >= 2;
    
    addResult(destination, 'GYG Multi-Section', hasMultiSection, hasMultiSection ? null : `Only ${gygCount} GYG widgets found`);
    return hasMultiSection;
  } catch (error) {
    addResult(destination, 'GYG Multi-Section', false, error.message);
    return false;
  }
}

async function testMapsLinks(page, destination) {
  try {
    const content = await page.content();
    const hasMapsLinks = /google\.com\/maps\/search/.test(content);
    
    addResult(destination, 'Maps Links', hasMapsLinks, hasMapsLinks ? null : 'No Maps links found');
    return hasMapsLinks;
  } catch (error) {
    addResult(destination, 'Maps Links', false, error.message);
    return false;
  }
}

async function testNoFooterDuplicates(page, destination) {
  try {
    const content = await page.content();
    const hasFooterDuplicates = /<footer[\s\S]*?Wayzo|WZ\s*Wayzo/i.test(content);
    
    addResult(destination, 'No Footer Duplicates', !hasFooterDuplicates, hasFooterDuplicates ? 'Footer duplicates found' : null);
    return !hasFooterDuplicates;
  } catch (error) {
    addResult(destination, 'No Footer Duplicates', false, error.message);
    return false;
  }
}

async function testSpecificContent(page, destination) {
  try {
    const content = await page.content();
    const hasGenericContent = /Local Restaurant|Historic Site|City Center Hotel|Local Cafe|Traditional Restaurant|Popular Attraction|Famous Landmark|Local Market|City Center|Downtown Area/i.test(content);
    
    addResult(destination, 'Specific Content', !hasGenericContent, hasGenericContent ? 'Generic content detected' : null);
    return !hasGenericContent;
  } catch (error) {
    addResult(destination, 'Specific Content', false, error.message);
    return false;
  }
}

async function testPlanStorage(page, destination) {
  try {
    // Try to access debug endpoint
    const response = await page.goto(`${BASE_URL}/debug/plan/1`, { waitUntil: 'networkidle2' });
    
    if (response.status() === 200) {
      const content = await page.$eval('body', el => el.textContent);
      const hasStoredPlan = content.includes(destination) || content.includes('"id":1');
      
      addResult(destination, 'Plan Storage', hasStoredPlan, hasStoredPlan ? null : 'Plan not stored or accessible');
      return hasStoredPlan;
    } else {
      addResult(destination, 'Plan Storage', false, `Debug endpoint returned ${response.status()}`);
      return false;
    }
  } catch (error) {
    addResult(destination, 'Plan Storage', false, error.message);
    return false;
  }
}

// Main test function
async function testWayzo(destination) {
  log(`Starting tests for ${destination}`, 'info');
  
  const browser = await puppeteer.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to site
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
    
    // Fill form
    await page.type('#destination', destination);
    await page.select('#budget', '2000');
    await page.select('#travelers', '2');
    await page.select('#style', 'Mid-range');
    
    // Generate preview
    await page.click('#generate-preview');
    
    // Run tests
    await testLoadingMemo(page, destination);
    await testPostLoadNote(page, destination);
    await testNoLegacyAffiliates(page, destination);
    await testGYGLocalization(page, destination);
    await testGYGMultiSection(page, destination);
    await testMapsLinks(page, destination);
    await testNoFooterDuplicates(page, destination);
    await testSpecificContent(page, destination);
    
    // Test plan storage
    await testPlanStorage(page, destination);
    
    log(`Completed tests for ${destination}`, 'success');
    
  } catch (error) {
    addResult(destination, 'Test Suite', false, error.message);
    log(`Test suite failed for ${destination}: ${error.message}`, 'error');
  } finally {
    await browser.close();
  }
}

// Main execution
async function runTests() {
  log('Starting Wayzo v75 test suite', 'info');
  log(`Testing ${TEST_DESTINATIONS.length} destinations`, 'info');
  
  const startTime = Date.now();
  
  for (const destination of TEST_DESTINATIONS) {
    await testWayzo(destination);
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  // Generate report
  const report = {
    summary: {
      total: testResults.passed + testResults.failed,
      passed: testResults.passed,
      failed: testResults.failed,
      duration: `${duration}s`
    },
    errors: testResults.errors,
    details: testResults.details
  };
  
  // Save report
  const reportPath = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Print summary
  log('=== TEST SUMMARY ===', 'info');
  log(`Total tests: ${report.summary.total}`, 'info');
  log(`Passed: ${report.summary.passed}`, 'success');
  log(`Failed: ${report.summary.failed}`, report.summary.failed > 0 ? 'error' : 'success');
  log(`Duration: ${report.summary.duration}`, 'info');
  
  if (report.errors.length > 0) {
    log('=== ERRORS ===', 'error');
    report.errors.forEach(error => log(error, 'error'));
  }
  
  log(`Report saved to: ${reportPath}`, 'info');
  
  // Exit with appropriate code
  process.exit(report.summary.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  log(`Test suite crashed: ${error.message}`, 'error');
  process.exit(1);
});