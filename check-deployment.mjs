#!/usr/bin/env node

/**
 * Check if the location detection fix has been deployed
 */

import puppeteer from 'puppeteer';

const SITE_URL = 'https://wayzo-staging.onrender.com';

async function checkDeployment() {
  console.log('🔍 Checking if location detection fix has been deployed...\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Check the actual source code for the new API calls
    const hasNewLocationCode = await page.evaluate(() => {
      // Look for the new APIs in the page source
      const pageSource = document.documentElement.outerHTML;

      return {
        hasIpinfoIo: pageSource.includes('ipinfo.io/json'),
        hasFreeipapi: pageSource.includes('freeipapi.com'),
        hasGeolocation: pageSource.includes('navigator.geolocation'),
        hasOldIpapiCo: pageSource.includes('ipapi.co/json/'),
        hasNominatim: pageSource.includes('nominatim.openstreetmap.org')
      };
    });

    console.log('📊 DEPLOYMENT STATUS:');
    console.log('===================');
    console.log('✅ New ipinfo.io API:', hasNewLocationCode.hasIpinfoIo);
    console.log('✅ Backup freeipapi.com:', hasNewLocationCode.hasFreeipapi);
    console.log('✅ Browser geolocation:', hasNewLocationCode.hasGeolocation);
    console.log('✅ Nominatim geocoding:', hasNewLocationCode.hasNominatim);
    console.log('❌ Old ipapi.co API:', hasNewLocationCode.hasOldIpapiCo);

    if (hasNewLocationCode.hasIpinfoIo && hasNewLocationCode.hasFreeipapi) {
      console.log('\n🎉 SUCCESS: Location detection fix has been deployed!');
      return true;
    } else {
      console.log('\n⏳ PENDING: Deployment still in progress or failed');
      return false;
    }

  } catch (error) {
    console.error('❌ Check failed:', error.message);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

checkDeployment().then((deployed) => {
  if (deployed) {
    console.log('\n🚀 Ready to test location detection!');
  } else {
    console.log('\n⏳ Wait a few more minutes and check again');
  }
});