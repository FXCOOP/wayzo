// Widget configuration for Wayzo v75
// Only tpwdgt and GYG widgets allowed, powered_by=false

export function getTPWGTWidget(destination) {
  return `<div data-tpwdgt-href="https://tpwdgt.com" data-tpwdgt-widget="travel" data-tpwdgt-powered-by="false"></div>`;
}

export function getGYGWidget(destination) {
  const query = encodeURIComponent(destination || '');
  return `<div data-gyg-href="https://widget.getyourguide.com/default/activities.frame?q=${query}&locale=en-US" data-gyg-widget="activities"></div>`;
}

export function injectWidgetsIntoSections(html, destination) {
  let result = html;
  const gygWidget = getGYGWidget(destination);
  
  // Inject GYG widget into Must-See Attractions section
  result = result.replace(/(## 🎫 Must-See Attractions)/, `${gygWidget}\n$1`);
  
  // Inject GYG widget into Daily Itineraries section  
  result = result.replace(/(## 🎭 Daily Itineraries)/, `${gygWidget}\n$1`);
  
  return result;
}

export function sanitizeAffiliateLinks(html) {
  // Remove all unauthorized affiliate links
  let processed = html;
  
  // Strip Booking.com, WayAway, TicketNetwork, Kayak, flights, car rental links
  processed = processed.replace(/https?:\/\/(www\.)?(booking\.com|wayaway|ticketnetwork|kayak\.com|flights|car rental)\S*/gi, '');
  
  // Remove any remaining affiliate widgets
  processed = processed.replace(/<div[^>]*data-(?!gyg|tpwdgt)[^>]*>/gi, '');
  
  return processed;
}

export function validateWidgets(html) {
  const errors = [];
  
  // Check for unauthorized widgets
  if (/WayAway|TicketNetwork|booking\.com|kayak\.com|flights|car rental|Search and compare hotel prices/i.test(html)) {
    errors.push('Invalid affiliate widgets detected');
  }
  
  // Check GYG localization
  if (!/widget\.getyourguide\.com.*\?q=.*&locale=en-US/.test(html)) {
    errors.push('GYG widget not properly localized');
  }
  
  // Check GYG appears in multiple sections
  const gygCount = (html.match(/widget\.getyourguide\.com/g) || []).length;
  if (gygCount < 2) {
    errors.push(`GYG widget not in multiple sections (found ${gygCount})`);
  }
  
  // Check for Maps links
  if (!/google\.com\/maps\/search/.test(html)) {
    errors.push('No Google Maps links found');
  }
  
  return errors;
}