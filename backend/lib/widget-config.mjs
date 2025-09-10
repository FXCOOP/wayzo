// Widget Configuration File - Store all widget codes to prevent loss
// This file contains all the specific widget codes provided by the user

export const WIDGET_CONFIG = {
  // Car Rentals
  carRental: {
    script: `<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&powered_by=false&border_radius=5&plain=true&show_logo=true&color_background=%23ffca28&color_button=%2355a539&color_text=%23000000&color_input_text=%23000000&color_button_text=%23ffffff&promo_id=4480&campaign_id=10" charset="utf-8"></script>`,
    category: 'transport',
    section: 'Getting Around',
    title: 'Car Rental',
    description: 'Find the best car rental deals'
  },

  // Airport Transfers
  airportTransfers: {
    script: `<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&city=68511&show_header=true&powered_by=false&campaign_id=627&promo_id=8951" charset="utf-8"></script>`,
    category: 'transport',
    section: 'Getting Around',
    title: 'Airport Transfers',
    description: 'Book reliable airport pickup and drop-off'
  },

  // eSIM
  esim: {
    script: `<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&powered_by=false&color_button=%23f2685f&color_focused=%23f2685f&secondary=%23FFFFFF&dark=%2311100f&light=%23FFFFFF&special=%23C4C4C4&border_radius=5&plain=false&no_labels=true&promo_id=8588&campaign_id=541" charset="utf-8"></script>`,
    category: 'connectivity',
    section: 'Travel Tips',
    title: 'eSIM',
    description: 'Stay connected with local eSIM'
  },

  // Cheap Flights
  flights: {
    script: `<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en_us&Checkbox_9=false&powered_by=false&primary=%230C131D&dark=%230C131D&light=%23FFFFFF&secondary=%23F1EDFC&promo_id=7293&campaign_id=200" charset="utf-8"></script>`,
    category: 'flights',
    section: 'Getting Around',
    title: 'Flight Search',
    description: 'Find the best flight deals'
  },

  // Event Tickets
  eventTickets: {
    script: `<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&bg_color=%23112266&title=Need%20tickets%3F&title_color=%23ffffff&icon_color=%230077ff&search_text=Search%20by%20artist%2C%20team%2C%20event%2C%20etc...&footer_color=%23ffffff&powered_by=false&campaign_id=72&promo_id=8505" charset="utf-8"></script>`,
    category: 'events',
    section: 'Must-See Attractions',
    title: 'Event Tickets',
    description: 'Find tickets for events and shows'
  },

  // Hotel Booking
  hotels: {
    script: `<script async src="https://tpwdgt.com/content?currency=usd&trs=455192&shmarker=634822&show_hotels=true&powered_by=false&locale=en&primary_override=%23FF8E01&color_button=%23FF8E01&color_icons=%23FF8E01&secondary=%23FFFFFF&dark=%23262626&light=%23FFFFFF&special=%23C4C4C4&color_focused=%23FF8E01&border_radius=5&plain=false&promo_id=7873&campaign_id=101" charset="utf-8"></script>`,
    category: 'accommodation',
    section: 'Accommodation',
    title: 'Hotel Booking',
    description: 'Search and compare hotel prices'
  },

  // Flight Delay Compensation
  flightDelay: {
    script: `<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&border_radius=5&plain=true&powered_by=false&promo_id=3408&campaign_id=86" charset="utf-8"></script>`,
    category: 'insurance',
    section: 'Travel Tips',
    title: 'Flight Delay Compensation',
    description: 'Claim compensation for delayed flights'
  },

  // GetYourGuide Activities
  getYourGuide: {
    script: `<div data-gyg-href="https://widget.getyourguide.com/default/activities.frame" data-gyg-locale-code="en-US" data-gyg-widget="activities" data-gyg-number-of-items="3" data-gyg-partner-id="PUHVJ53"><span>Powered by <a target="_blank" rel="sponsored" href="https://www.getyourguide.com/">GetYourGuide</a></span></div>`,
    analytics: `<script async defer src="https://widget.getyourguide.com/dist/pa.umd.production.min.js" data-gyg-partner-id="PUHVJ53"></script>`,
    category: 'activities',
    section: 'Must-See Attractions',
    title: 'Top Activities',
    description: 'Curated tours and activities'
  }
};

// Function to get locale-specific GetYourGuide widget
export function getGYGWidget(destination = '') {
  const locale = getLocaleForDestination(destination);
  return `<div data-gyg-href="https://widget.getyourguide.com/default/activities.frame" data-gyg-locale-code="${locale}" data-gyg-widget="activities" data-gyg-number-of-items="3" data-gyg-partner-id="PUHVJ53"><span>Powered by <a target="_blank" rel="sponsored" href="https://www.getyourguide.com/">GetYourGuide</a></span></div>`;
}

// Function to get locale for destination
function getLocaleForDestination(dest = '') {
  const d = (dest || '').toLowerCase();
  if (d.includes('germany') || d.includes('berlin')) return 'de-DE';
  if (d.includes('austria') || d.includes('tyrol') || d.includes('tirol') || d.includes('innsbruck')) return 'de-AT';
  if (d.includes('italy') || d.includes('venice') || d.includes('venezia')) return 'it-IT';
  if (d.includes('greece') || d.includes('santorini') || d.includes('athens')) return 'el-GR';
  if (d.includes('spain') || d.includes('madrid') || d.includes('barcelona')) return 'es-ES';
  if (d.includes('france') || d.includes('paris')) return 'fr-FR';
  if (d.includes('portugal') || d.includes('lisbon') || d.includes('porto')) return 'pt-PT';
  if (d.includes('czech') || d.includes('prague')) return 'cs-CZ';
  return 'en-US';
}