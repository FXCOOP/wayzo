#!/usr/bin/env node

/**
 * Simple Location Detection Test for Wayzo
 * Quick test to identify the CORS issue
 */

import puppeteer from 'puppeteer';

const SITE_URL = 'https://wayzo-staging.onrender.com';

async function testLocationDetection() {
  console.log('🧪 Starting Simple Location Detection Test...\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Track all console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      console.log(`[${type.toUpperCase()}]`, text);
    });

    // Track all network requests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('ipapi') || url.includes('ipify')) {
        console.log('🌐 REQUEST:', url);
      }
    });

    page.on('response', response => {
      const url = response.url();
      if (url.includes('ipapi') || url.includes('ipify')) {
        console.log(`📡 RESPONSE [${response.status()}]:`, url);
      }
    });

    console.log('🌐 Loading page...');
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait a bit for scripts to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check field status
    const fieldStatus = await page.evaluate(() => {
      const field = document.getElementById('from');
      return {
        exists: !!field,
        value: field?.value || '',
        placeholder: field?.placeholder || '',
        detectFunctionExists: typeof detectUserLocation === 'function'
      };
    });

    console.log('\n📊 FIELD STATUS:');
    console.log('Field exists:', fieldStatus.exists);
    console.log('Field value:', `"${fieldStatus.value}"`);
    console.log('Field placeholder:', `"${fieldStatus.placeholder}"`);
    console.log('detectUserLocation exists:', fieldStatus.detectFunctionExists);

    // Wait a bit more to see if location gets detected
    await new Promise(resolve => setTimeout(resolve, 10000));

    const finalStatus = await page.evaluate(() => {
      const field = document.getElementById('from');
      return {
        value: field?.value || '',
        placeholder: field?.placeholder || ''
      };
    });

    console.log('\n📊 FINAL FIELD STATUS:');
    console.log('Final value:', `"${finalStatus.value}"`);
    console.log('Final placeholder:', `"${finalStatus.placeholder}"`);

  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testLocationDetection().then(() => {
  console.log('\n✅ Test completed');
});