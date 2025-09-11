import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_DESTINATIONS = [
  'Berlin, Germany',
  'London, UK', 
  'Dubai, UAE',
  'Matera, Italy',
  'Ghent, Belgium',
  'Tbilisi, Georgia'
];

const BASE_URL = 'http://localhost:10000';

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

async function testWayzo(destination) {
  console.log(`\n🧪 Testing ${destination}...`);
  
  const browser = await puppeteer.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to site
    console.log('  📍 Navigating to site...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Fill form
    console.log('  📝 Filling form...');
    await page.type('#destination', destination);
    await page.type('#start', '2025-09-12');
    await page.type('#end', '2025-09-19');
    await page.type('#totalBudget', '2000');
    
    // Generate preview
    console.log('  ⚡ Generating preview...');
    await page.click('#submitBtn');
    
    // Wait for loading memo
    console.log('  ⏳ Waiting for loading memo...');
    await page.waitForSelector('#loading', { timeout: 10000 });
    
    const loadingText = await page.$eval('#loading', el => el.textContent);
    if (!loadingText.includes('Your itinerary') || !loadingText.includes('Generating your perfect trip')) {
      throw new Error('Missing loading memo');
    }
    
    // Wait for preview to load
    console.log('  📋 Waiting for preview...');
    await page.waitForSelector('#preview', { timeout: 60000 });
    
    // Check preview content (should be teaser, not full plan)
    const previewContent = await page.$eval('#preview', el => el.innerHTML);
    if (!previewContent.includes('Berlin, Germany') && !previewContent.includes('Summary')) {
      throw new Error('Preview content not loaded');
    }
    
    // Generate full plan
    console.log('  🚀 Generating full plan...');
    await page.click('#buyBtn'); // Use buy button for full AI plan
    
    // Wait for plan to load
    await page.waitForSelector('#preview', { timeout: 60000 });
    
    // Check for post-load note (only after full plan)
    const finalContent = await page.$eval('#preview', el => el.innerHTML);
    if (!finalContent.includes('Plan loaded.')) {
      throw new Error('Missing post-load note');
    }
    
    // Get final HTML content
    const html = await page.content();
    
    // Validate content
    console.log('  ✅ Validating content...');
    
    // Check for invalid affiliate widgets
    if (/WayAway|TicketNetwork|booking\.com|kayak\.com|flights|car rental|Search and compare hotel prices/i.test(html)) {
      throw new Error('Invalid affiliate widgets present');
    }
    
    // Check GYG localization
    if (!/widget\.getyourguide\.com.*\?q=.*&locale=en-US/.test(html)) {
      throw new Error('GYG widget not localized');
    }
    
    // Check GYG appears in multiple sections
    const gygCount = (html.match(/widget\.getyourguide\.com/g) || []).length;
    if (gygCount < 2) {
      throw new Error(`GYG widget not in multiple sections (found ${gygCount})`);
    }
    
    // Check for Maps links
    if (!/google\.com\/maps\/search/.test(html)) {
      throw new Error('No Google Maps links found');
    }
    
    // Check for generic content
    if (/Local Restaurant|Historic Site|City Center Hotel/i.test(html)) {
      throw new Error('Generic content detected');
    }
    
    // Check for price disclaimer
    if (!/Check current prices/i.test(html)) {
      throw new Error('Missing price disclaimer');
    }
    
    // Test debug endpoint
    console.log('  🔍 Testing debug endpoint...');
    await page.goto(`${BASE_URL}/debug/plans`, { waitUntil: 'networkidle2' });
    const debugContent = await page.evaluate(() => document.body.textContent);
    if (!debugContent.includes(destination)) {
      throw new Error('Plan not stored in database');
    }
    
    console.log(`  ✅ All tests passed for ${destination}`);
    testResults.passed++;
    
  } catch (error) {
    console.log(`  ❌ Test failed for ${destination}: ${error.message}`);
    testResults.failed++;
    testResults.errors.push({ destination, error: error.message });
  } finally {
    await browser.close();
  }
}

async function runTests() {
  console.log('🚀 Starting Wayzo v75 Local Tests');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log(`🎯 Destinations: ${TEST_DESTINATIONS.join(', ')}`);
  
  const startTime = Date.now();
  
  for (const destination of TEST_DESTINATIONS) {
    await testWayzo(destination);
  }
  
  const duration = Date.now() - startTime;
  
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⏱️  Duration: ${Math.round(duration / 1000)}s`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Errors:');
    testResults.errors.forEach(({ destination, error }) => {
      console.log(`  • ${destination}: ${error}`);
    });
  }
  
  // Save test results
  const resultsFile = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    duration,
    results: testResults
  }, null, 2));
  
  console.log(`\n📄 Results saved to: ${resultsFile}`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All tests passed! Ready for deployment.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review errors before deploying.');
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run tests
runTests().catch(console.error);