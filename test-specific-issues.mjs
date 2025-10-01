#!/usr/bin/env node

// Direct test of specific broken issues mentioned by the user
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 ANALYZING SPECIFIC BROKEN OUTPUT ISSUES...\n');

// Issue 1: Analyzing the corrupted weather table output
console.log('1. WEATHER TABLE CORRUPTION ANALYSIS:');
const brokenWeatherOutput = `🌤️ Weather Forecast
📅 Date    🌡️ Min    🌡️ Max    🌧️ Rtails
Oct 3    6°C    13°C    54%    View
Oct 4   iew
Oct 5    6°C    11°C    47%    View
Oct 6    3w
Oct 7    5°C    14°C    44%    View
Oct 8    2°COct 9    6°C    11°C    43%    View
Oct 10    5°C 📊 Data Source: Weather information based on historical averages (5-year data).`;

console.log('ISSUES IDENTIFIED:');
console.log('- Column header shows "Rtails" instead of "Rain"');
console.log('- Row data is missing/corrupted for Oct 4 and Oct 6');
console.log('- Temperature values are bleeding across rows (Oct 8 shows "2°COct 9")');
console.log('- Table structure is completely broken');

// Issue 2: Check widgets.mjs weather generation
console.log('\n2. CHECKING WIDGETS.MJS WEATHER FUNCTION:');
try {
  const widgetsPath = join(__dirname, 'backend', 'lib', 'widgets.mjs');
  const widgetsContent = readFileSync(widgetsPath, 'utf8');

  // Look for weather table generation code
  const weatherTableMatch = widgetsContent.match(/weatherRows.*?join\(''\)/s);
  if (weatherTableMatch) {
    console.log('✅ Found weather table generation code');

    // Check for common issues in the weather table generation
    const tableCode = weatherTableMatch[0];
    if (tableCode.includes('Rain')) {
      console.log('✅ Table headers include Rain column');
    } else {
      console.log('❌ Missing Rain column header');
    }

    if (tableCode.includes('minTemp') && tableCode.includes('maxTemp')) {
      console.log('✅ Temperature columns are defined');
    } else {
      console.log('❌ Temperature columns missing or malformed');
    }

    // Check for template literal formatting issues
    if (tableCode.includes('${') && tableCode.includes('}')) {
      console.log('✅ Template literals found');
      // Count unclosed template literals
      const openBraces = (tableCode.match(/\${/g) || []).length;
      const closeBraces = (tableCode.match(/}/g) || []).length;
      if (openBraces === closeBraces) {
        console.log('✅ Template literal braces are balanced');
      } else {
        console.log(`❌ Template literal braces unbalanced: ${openBraces} open, ${closeBraces} close`);
      }
    }
  } else {
    console.log('❌ Weather table generation code not found');
  }
} catch (error) {
  console.log('❌ Failed to read widgets.mjs:', error.message);
}

// Issue 3: Check for budget calculation returning 0
console.log('\n3. BUDGET CALCULATION ANALYSIS:');
try {
  const budgetPath = join(__dirname, 'backend', 'lib', 'budget.mjs');
  const budgetContent = readFileSync(budgetPath, 'utf8');

  // Check normalizeBudget function
  if (budgetContent.includes('return 0;')) {
    console.log('❌ Found "return 0" in budget.mjs - this could cause 0 USD budget');
    const zeroReturns = budgetContent.match(/return 0;/g);
    console.log(`   Found ${zeroReturns?.length || 0} instances of "return 0"`);
  }

  // Check for proper budget calculation
  if (budgetContent.includes('normalizeBudget')) {
    console.log('✅ normalizeBudget function exists');
  }

  if (budgetContent.includes('computeBudget')) {
    console.log('✅ computeBudget function exists');
  }

} catch (error) {
  console.log('❌ Failed to read budget.mjs:', error.message);
}

// Issue 4: Check location detection service URLs
console.log('\n4. LOCATION DETECTION SERVICE ANALYSIS:');
try {
  const appPath = join(__dirname, 'frontend', 'app.js');
  const appContent = readFileSync(appPath, 'utf8');

  // Check for HTTPS URLs
  const httpUrls = appContent.match(/fetch\(['"`]http:\/\/[^'"`]+['"`]/g);
  const httpsUrls = appContent.match(/fetch\(['"`]https:\/\/[^'"`]+['"`]/g);

  if (httpUrls) {
    console.log(`❌ Found ${httpUrls.length} HTTP URLs in location detection:`, httpUrls);
  } else {
    console.log('✅ No HTTP URLs found (good)');
  }

  if (httpsUrls) {
    console.log(`✅ Found ${httpsUrls.length} HTTPS URLs:`, httpsUrls.map(url => url.replace(/^fetch\(['"`]/, '').replace(/['"`]$/, '')));
  }

  // Check for known working services
  if (appContent.includes('ipapi.co')) {
    console.log('✅ Using ipapi.co service');
  }

  if (appContent.includes('Tel Aviv-Yafo')) {
    console.log('❌ Hard-coded "Tel Aviv-Yafo" found - this might be a fallback issue');
  }

} catch (error) {
  console.log('❌ Failed to read app.js:', error.message);
}

// Issue 5: Check OpenAI API configuration
console.log('\n5. OPENAI API CONFIGURATION CHECK:');
try {
  const serverPath = join(__dirname, 'backend', 'server.mjs');
  const serverContent = readFileSync(serverPath, 'utf8');

  // Check for the corrected API call
  if (serverContent.includes('client.chat.completions.create')) {
    console.log('✅ Using correct OpenAI API: client.chat.completions.create');
  } else if (serverContent.includes('client.responses.create')) {
    console.log('❌ Still using incorrect API: client.responses.create');
  }

  // Check model configuration
  if (serverContent.includes('gpt-4o-mini-2024-07-18')) {
    console.log('✅ Using correct model: gpt-4o-mini-2024-07-18');
  } else if (serverContent.includes('gpt-5-nano-2025-08-07')) {
    console.log('❌ Still using invalid model: gpt-5-nano-2025-08-07');
  }

  // Check for fallback logic
  if (serverContent.includes('localPlanMarkdown')) {
    console.log('✅ Fallback plan generation exists');
  }

} catch (error) {
  console.log('❌ Failed to read server.mjs:', error.message);
}

console.log('\n🎯 SUMMARY OF ROOT CAUSES:');
console.log('Based on the analysis, the main issues appear to be:');
console.log('1. Weather table HTML generation has template literal or formatting issues');
console.log('2. Budget normalization might be returning 0 in certain cases');
console.log('3. Location detection may have service reliability issues');
console.log('4. OpenAI API calls might still be using incorrect syntax');
console.log('\nNext step: Test these specific functions individually to confirm fixes.');