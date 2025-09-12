// FIXED Widget Configuration - September 6 golden period restoration
// Simplified, non-duplicative widget injection system

export const WIDGET_CONFIG = {
  // GetYourGuide Activities Widget - PRIMARY WIDGET (working from September 6)
  getYourGuide: {
    script: `<div data-gyg-href="https://widget.getyourguide.com/default/activities.frame" data-gyg-locale-code="en-US" data-gyg-widget="activities" data-gyg-number-of-items="3" data-gyg-partner-id="PUHVJ53" style="margin: 20px 0;"><span style="font-size: 12px; color: #666;">Powered by <a target="_blank" rel="sponsored" href="https://www.getyourguide.com/" style="color: #007bff;">GetYourGuide</a></span></div>`,
    category: 'activities',
    section: 'Must-See Attractions',
    title: 'Top Activities & Tours',
    description: 'Curated tours and activities for your destination'
  },

  // Weather Widget - SECONDARY WIDGET (simple, always works)
  weather: {
    script: `<div id="weatherWidget" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;"><h4>🌤️ Current Weather</h4><p style="color: #666;">Check local weather conditions for your trip</p><a href="https://weather.com" target="_blank" style="color: #007bff;">View Detailed Forecast</a></div>`,
    category: 'weather',
    section: 'Travel Tips',
    title: 'Weather Information',
    description: 'Current weather and forecast for your destination'
  }
};

// FIXED: Simple GetYourGuide widget generator (destination-aware)
export function getGYGWidget(destination) {
  const locale = getLocaleForDestination(destination);
  const q = encodeURIComponent(String(destination || '').trim());
  
  return `<div data-gyg-href="https://widget.getyourguide.com/default/activities.frame?q=${q}&locale=${locale}" data-gyg-locale-code="${locale}" data-gyg-widget="activities" data-gyg-number-of-items="3" data-gyg-partner-id="PUHVJ53" style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
  <h4 style="margin-top: 0; color: #333;">🎫 Recommended Activities</h4>
  <div style="font-size: 12px; color: #666; margin-top: 10px;">
    Powered by <a target="_blank" rel="sponsored" href="https://www.getyourguide.com/" style="color: #007bff; text-decoration: none;">GetYourGuide</a>
  </div>
</div>

<script async defer src="https://widget.getyourguide.com/dist/pa.umd.production.min.js" data-gyg-partner-id="PUHVJ53"></script>`;
}

// FIXED: Non-duplicative widget injection (September 6 approach)
export function injectWidgetsIntoSections(html, destination) {
  if (!html || !destination) return html;
  
  let result = html;
  
  // Inject GYG widget ONLY under Must-See Attractions (single injection)
  const gygWidget = getGYGWidget(destination);
  
  // Check if widget already exists to prevent duplicates
  if (!result.includes('data-gyg-widget')) {
    result = result.replace(
      /(## 🎫 Must-See Attractions[^\n]*\n)/,
      `$1\n${gygWidget}\n`
    );
  }
  
  return result;
}

// FIXED: Clean affiliate link sanitization (remove external booking links)
export function sanitizeAffiliateLinks(html) {
  if (!html) return html;
  
  // Remove external booking links that compete with our widgets
  let processed = html;
  
  // Remove specific external booking domains
  const externalDomains = [
    'booking\\.com',
    'expedia\\.com',
    'kayak\\.com',
    'priceline\\.com',
    'hotels\\.com',
    'agoda\\.com',
    'tripadvisor\\.com/book',
    'viator\\.com',
    'ticketmaster\\.com'
  ];
  
  const linkPattern = new RegExp(`https?:\\/\\/(www\\.)?(${externalDomains.join('|')})\\S*`, 'gi');
  processed = processed.replace(linkPattern, '');
  
  // Remove empty link tags
  processed = processed.replace(/<a[^>]*>\s*<\/a>/gi, '');
  processed = processed.replace(/\[\]\([^)]*\)/g, '');
  
  return processed;
}

// FIXED: Get locale for destination (expanded mapping)
export function getLocaleForDestination(destination) {
  if (!destination) return 'en-US';
  
  const dest = destination.toLowerCase();
  
  // European destinations
  if (dest.includes('germany') || dest.includes('münchen') || dest.includes('munich') || dest.includes('berlin')) return 'de-DE';
  if (dest.includes('austria') || dest.includes('tyrol') || dest.includes('tirol') || dest.includes('innsbruck') || dest.includes('salzburg')) return 'de-AT';
  if (dest.includes('france') || dest.includes('paris') || dest.includes('lyon') || dest.includes('marseille')) return 'fr-FR';
  if (dest.includes('italy') || dest.includes('rome') || dest.includes('venice') || dest.includes('milan') || dest.includes('florence')) return 'it-IT';
  if (dest.includes('spain') || dest.includes('madrid') || dest.includes('barcelona') || dest.includes('seville')) return 'es-ES';
  if (dest.includes('portugal') || dest.includes('lisbon') || dest.includes('porto')) return 'pt-PT';
  if (dest.includes('netherlands') || dest.includes('amsterdam') || dest.includes('holland')) return 'nl-NL';
  if (dest.includes('greece') || dest.includes('athens') || dest.includes('santorini') || dest.includes('mykonos')) return 'el-GR';
  if (dest.includes('czech') || dest.includes('prague') || dest.includes('brno')) return 'cs-CZ';
  if (dest.includes('poland') || dest.includes('warsaw') || dest.includes('krakow')) return 'pl-PL';
  
  // Asian destinations
  if (dest.includes('japan') || dest.includes('tokyo') || dest.includes('osaka') || dest.includes('kyoto')) return 'ja-JP';
  if (dest.includes('china') || dest.includes('beijing') || dest.includes('shanghai')) return 'zh-CN';
  if (dest.includes('korea') || dest.includes('seoul') || dest.includes('busan')) return 'ko-KR';
  if (dest.includes('thailand') || dest.includes('bangkok') || dest.includes('phuket')) return 'th-TH';
  
  // Default to English for all other destinations
  return 'en-US';
}

// FIXED: Simple widget validation
export function validateWidgetInjection(html) {
  if (!html) return false;
  
  // Check if widgets are properly injected
  const hasGYGWidget = html.includes('data-gyg-widget');
  const hasGYGScript = html.includes('widget.getyourguide.com');
  
  return hasGYGWidget && hasGYGScript;
}

// FIXED: Widget deduplication
export function deduplicateWidgets(html) {
  if (!html) return html;
  
  let result = html;
  
  // Remove duplicate GYG widgets (keep only the first one)
  const gygWidgetPattern = /<div[^>]*data-gyg-widget[^>]*>[\s\S]*?<\/div>/gi;
  const gygMatches = result.match(gygWidgetPattern);
  
  if (gygMatches && gygMatches.length > 1) {
    // Keep only the first match, remove the rest
    for (let i = 1; i < gygMatches.length; i++) {
      result = result.replace(gygMatches[i], '');
    }
  }
  
  // Remove duplicate GYG scripts
  const scriptPattern = /<script[^>]*widget\.getyourguide\.com[^>]*><\/script>/gi;
  const scriptMatches = result.match(scriptPattern);
  
  if (scriptMatches && scriptMatches.length > 1) {
    // Keep only the first script, remove the rest
    for (let i = 1; i < scriptMatches.length; i++) {
      result = result.replace(scriptMatches[i], '');
    }
  }
  
  return result;
}

export default {
  WIDGET_CONFIG,
  getGYGWidget,
  injectWidgetsIntoSections,
  sanitizeAffiliateLinks,
  getLocaleForDestination,
  validateWidgetInjection,
  deduplicateWidgets
};