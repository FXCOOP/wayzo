// Widget Configuration File - Store all widget codes to prevent loss
// This file contains all the specific widget codes provided by the user

export const WIDGET_CONFIG = {
  // Car Rentals - Custom inline widget
  carRental: {
    script: `<div class="affiliate-widget">
      <div class="widget-content">
        <h4>🚗 Car Rental</h4>
        <p>Find the best car rental deals</p>
        <a href="https://www.kayak.com/cars" target="_blank" rel="sponsored" class="affiliate-button">Search Car Rentals</a>
      </div>
    </div>`,
    category: 'transport',
    section: 'Getting Around',
    title: 'Car Rental',
    description: 'Find the best car rental deals'
  },

  // Airport Transfers - Custom inline widget
  airportTransfers: {
    script: `<div class="affiliate-widget">
      <div class="widget-content">
        <h4>🚌 Airport Transfers</h4>
        <p>Book reliable airport pickup and drop-off</p>
        <a href="https://www.kayak.com/airport-transfers" target="_blank" rel="sponsored" class="affiliate-button">Book Transfer</a>
      </div>
    </div>`,
    category: 'transport',
    section: 'Getting Around',
    title: 'Airport Transfers',
    description: 'Book reliable airport pickup and drop-off'
  },

  // eSIM - Custom inline widget
  esim: {
    script: `<div class="affiliate-widget">
      <div class="widget-content">
        <h4>📱 eSIM</h4>
        <p>Stay connected with local eSIM</p>
        <a href="https://www.airalo.com" target="_blank" rel="sponsored" class="affiliate-button">Get eSIM</a>
      </div>
    </div>`,
    category: 'connectivity',
    section: 'Travel Tips',
    title: 'eSIM',
    description: 'Stay connected with local eSIM'
  },

  // Cheap Flights - Custom inline widget
  flights: {
    script: `<div class="affiliate-widget">
      <div class="widget-content">
        <h4>✈️ Flight Search</h4>
        <p>Find the best flight deals</p>
        <a href="https://www.kayak.com/flights" target="_blank" rel="sponsored" class="affiliate-button">Search Flights</a>
      </div>
    </div>`,
    category: 'flights',
    section: 'Getting Around',
    title: 'Flight Search',
    description: 'Find the best flight deals'
  },

  // Event Tickets - Custom inline widget
  eventTickets: {
    script: `<div class="affiliate-widget">
      <div class="widget-content">
        <h4>🎫 Event Tickets</h4>
        <p>Find tickets for events and shows</p>
        <a href="https://www.ticketmaster.com" target="_blank" rel="sponsored" class="affiliate-button">Find Events</a>
      </div>
    </div>`,
    category: 'events',
    section: 'Must-See Attractions',
    title: 'Event Tickets',
    description: 'Find tickets for events and shows'
  },

  // Hotel Booking - Custom inline widget
  hotels: {
    script: `<div class="affiliate-widget">
      <div class="widget-content">
        <h4>🏨 Hotel Booking</h4>
        <p>Search and compare hotel prices</p>
        <a href="https://www.kayak.com/hotels" target="_blank" rel="sponsored" class="affiliate-button">Search Hotels</a>
      </div>
    </div>`,
    category: 'accommodation',
    section: 'Accommodation',
    title: 'Hotel Booking',
    description: 'Search and compare hotel prices'
  },

  // Flight Delay Compensation - Custom inline widget
  flightDelay: {
    script: `<div class="affiliate-widget">
      <div class="widget-content">
        <h4>🛡️ Flight Delay Compensation</h4>
        <p>Claim compensation for delayed flights</p>
        <a href="https://www.flightright.com" target="_blank" rel="sponsored" class="affiliate-button">Check Eligibility</a>
      </div>
    </div>`,
    category: 'insurance',
    section: 'Travel Tips',
    title: 'Flight Delay Compensation',
    description: 'Claim compensation for delayed flights'
  },

  // GetYourGuide Activities Widget - Keep original (works fine)
  getYourGuide: {
    script: `<div data-gyg-href="https://widget.getyourguide.com/default/activities.frame" data-gyg-locale-code="en-US" data-gyg-widget="activities" data-gyg-number-of-items="3" data-gyg-partner-id="PUHVJ53"><span>Powered by <a target="_blank" rel="sponsored" href="https://www.getyourguide.com/">GetYourGuide</a></span></div>`,
    analytics: `<script async defer src="https://widget.getyourguide.com/dist/pa.umd.production.min.js" data-gyg-partner-id="PUHVJ53"></script>`,
    category: 'activities',
    section: 'Must-See Attractions',
    title: 'Top Activities',
    description: 'Curated tours and activities'
  }
};

// GetYourGuide widget generator
export function getGYGWidget(destination) {
  return `<div data-gyg-href="https://widget.getyourguide.com/default/activities.frame" data-gyg-locale-code="en-US" data-gyg-widget="activities" data-gyg-number-of-items="3" data-gyg-partner-id="PUHVJ53"><span>Powered by <a target="_blank" rel="sponsored" href="https://www.getyourguide.com/">GetYourGuide</a></span></div>`;
}

// Get locale for destination
export function getLocaleForDestination(destination) {
  const country = destination.toLowerCase();
  if (country.includes('germany') || country.includes('deutschland')) return 'de-DE';
  if (country.includes('france')) return 'fr-FR';
  if (country.includes('spain') || country.includes('españa')) return 'es-ES';
  if (country.includes('italy') || country.includes('italia')) return 'it-IT';
  if (country.includes('japan')) return 'ja-JP';
  if (country.includes('china')) return 'zh-CN';
  if (country.includes('korea')) return 'ko-KR';
  return 'en-US';
}