import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:10000';

async function quickTest() {
  console.log('🧪 Running Quick Wayzo v75 Test');
  
  const browser = await puppeteer.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to site
    console.log('📍 Navigating to site...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Check if loading memo is present in HTML
    const html = await page.content();
    if (!html.includes('Your itinerary<br />Generating your perfect trip')) {
      throw new Error('Loading memo not found in HTML');
    }
    console.log('✅ Loading memo found in HTML');
    
    // Fill form
    console.log('📝 Filling form...');
    await page.type('#destination', 'Berlin, Germany');
    await page.type('#start', '2025-09-12');
    await page.type('#end', '2025-09-19');
    await page.type('#totalBudget', '2000');
    
    // Test preview API
    console.log('⚡ Testing preview API...');
    await page.click('#submitBtn');
    
    // Wait for loading memo to appear
    await page.waitForSelector('#loading:not(.hidden)', { timeout: 10000 });
    console.log('✅ Loading memo appeared');
    
    // Wait for preview to load
    await page.waitForSelector('#preview', { timeout: 30000 });
    console.log('✅ Preview loaded');
    
    // Check if loading memo disappears
    await page.waitForSelector('#loading.hidden', { timeout: 10000 });
    console.log('✅ Loading memo disappeared');
    
    // Check preview content
    const previewContent = await page.$eval('#preview', el => el.innerHTML);
    if (!previewContent.includes('Berlin, Germany')) {
      throw new Error('Preview content does not contain destination');
    }
    console.log('✅ Preview content contains destination');
    
    // Test debug endpoint
    console.log('🔍 Testing debug endpoint...');
    await page.goto(`${BASE_URL}/debug/plans`, { waitUntil: 'networkidle2' });
    const debugContent = await page.evaluate(() => document.body.textContent);
    if (!debugContent.includes('[]') && !debugContent.includes('Berlin')) {
      console.log('⚠️  Debug endpoint accessible but no plans stored yet');
    } else {
      console.log('✅ Debug endpoint accessible');
    }
    
    console.log('\n🎉 Quick test passed! Core functionality working.');
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

quickTest().catch(console.error);