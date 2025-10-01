#!/usr/bin/env node

/**
 * Location Detection Test for Wayzo
 * Tests the location detection functionality on the deployed site
 */

import puppeteer from 'puppeteer';

const SITE_URL = 'https://wayzo-staging.onrender.com';

async function testLocationDetection() {
  console.log('🧪 Starting Location Detection Test...\n');

  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Enable console logging from the page
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();

      if (type === 'error') {
        console.log('❌ Browser Error:', text);
      } else if (text.includes('location') || text.includes('Location') || text.includes('ipapi') || text.includes('detectUserLocation')) {
        console.log(`📍 Location Log [${type}]:`, text);
      }
    });

    // Track network requests
    const networkRequests = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('ipapi.co') || url.includes('ipify.org') || url.includes('ip-api.com')) {
        console.log('🌐 Location API Request:', url);
        networkRequests.push(url);
      }
    });

    page.on('response', response => {
      const url = response.url();
      if (url.includes('ipapi.co') || url.includes('ipify.org') || url.includes('ip-api.com')) {
        console.log(`📡 Location API Response [${response.status()}]:`, url);
      }
    });

    console.log('🌐 Navigating to:', SITE_URL);
    await page.goto(SITE_URL, { waitUntil: 'networkidle2' });

    // Wait for page to fully load
    await page.waitForTimeout(3000);

    // Check if the from field exists
    const fromField = await page.$('#from');
    if (!fromField) {
      console.log('❌ CRITICAL: #from field not found on the page!');
      return;
    } else {
      console.log('✅ #from field found');
    }

    // Get initial field values
    const initialValue = await page.$eval('#from', el => el.value);
    const initialPlaceholder = await page.$eval('#from', el => el.placeholder);

    console.log('📋 Initial field state:');
    console.log('   Value:', `"${initialValue}"`);
    console.log('   Placeholder:', `"${initialPlaceholder}"`);

    // Check if detectUserLocation function exists
    const hasDetectLocationFunction = await page.evaluate(() => {
      return typeof detectUserLocation === 'function';
    });

    console.log('🔍 detectUserLocation function exists:', hasDetectLocationFunction);

    // Wait for location detection to complete (give it up to 10 seconds)
    console.log('⏱️ Waiting for location detection...');

    let locationDetected = false;
    let finalValue = '';
    let finalPlaceholder = '';

    // Check every 500ms for up to 15 seconds
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(500);

      const currentValue = await page.$eval('#from', el => el.value);
      const currentPlaceholder = await page.$eval('#from', el => el.placeholder);

      // Check if location was detected
      if (currentValue && currentValue !== initialValue && !currentValue.includes('undefined')) {
        locationDetected = true;
        finalValue = currentValue;
        finalPlaceholder = currentPlaceholder;
        console.log(`✅ Location detected after ${(i + 1) * 0.5} seconds!`);
        break;
      }

      // Check if placeholder changed indicating detection is working
      if (currentPlaceholder !== initialPlaceholder && currentPlaceholder.includes('Detecting')) {
        console.log('📍 Location detection in progress...');
      }
    }

    // Final results
    console.log('\n📊 FINAL RESULTS:');
    console.log('================');

    if (locationDetected) {
      console.log('✅ Location Detection: WORKING');
      console.log('📍 Detected Location:', `"${finalValue}"`);
      console.log('🏷️ Final Placeholder:', `"${finalPlaceholder}"`);
    } else {
      console.log('❌ Location Detection: FAILED');

      const finalValueCheck = await page.$eval('#from', el => el.value);
      const finalPlaceholderCheck = await page.$eval('#from', el => el.placeholder);

      console.log('📍 Final Value:', `"${finalValueCheck}"`);
      console.log('🏷️ Final Placeholder:', `"${finalPlaceholderCheck}"`);

      // Check for common issues
      if (finalValueCheck.includes('Tel Aviv') || finalValueCheck.includes('undefined')) {
        console.log('⚠️ Issue: Field shows incorrect default value');
      }

      if (finalPlaceholderCheck === initialPlaceholder) {
        console.log('⚠️ Issue: Placeholder never changed - detection might not be running');
      }
    }

    console.log('\n🌐 Network Requests Made:');
    if (networkRequests.length === 0) {
      console.log('❌ No location API requests detected!');
    } else {
      networkRequests.forEach(url => console.log('   ✅', url));
    }

    // Check for JavaScript errors
    const errors = await page.evaluate(() => {
      return window.__errors || [];
    });

    if (errors.length > 0) {
      console.log('\n❌ JavaScript Errors:');
      errors.forEach(error => console.log('   ', error));
    }

    // Test manual call of detectUserLocation
    console.log('\n🧪 Testing manual detectUserLocation call...');
    try {
      await page.evaluate(() => {
        if (typeof detectUserLocation === 'function') {
          detectUserLocation();
        } else {
          console.log('detectUserLocation function not available');
        }
      });

      // Wait for manual detection
      await page.waitForTimeout(5000);

      const manualValue = await page.$eval('#from', el => el.value);
      console.log('📍 Value after manual call:', `"${manualValue}"`);

    } catch (error) {
      console.log('❌ Error calling detectUserLocation manually:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testLocationDetection().then(() => {
  console.log('\n🏁 Location detection test completed');
}).catch(error => {
  console.error('❌ Test runner error:', error);
});