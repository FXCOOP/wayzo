// Affiliate Widgets Configuration
const AFFILIATE_WIDGETS = {
  // Airport Transfers
  airport_transfers: {
    name: "Airport Transfers",
    description: "Book reliable airport pickup and drop-off",
    script: `<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&show_header=true&campaign_id=627&promo_id=8951" charset="utf-8"></script>`,
    category: "transport",
    placement: "after_arrival"
  },
  
  // eSIM
  esim: {
    name: "eSIM",
    description: "Get instant internet access worldwide",
    script: `<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&color_button=%23f2685f&color_focused=%23f2685f&secondary=%23FFFFFF&dark=%2311100f&light=%23FFFFFF&special=%23C4C4C4&border_radius=5&plain=false&no_labels=true&promo_id=8588&campaign_id=541" charset="utf-8"></script>`,
    category: "connectivity",
    placement: "before_trip"
  },
  
  // Car Rentals
  car_rentals: {
    name: "Car Rentals",
    description: "Rent a car for your trip",
    script: `<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&border_radius=5&plain=true&show_logo=true&color_background=%23ffca28&color_button=%2355a539&color_text=%23000000&color_input_text=%23000000&color_button_text=%23ffffff&promo_id=4480&campaign_id=10" charset="utf-8"></script>`,
    category: "transport",
    placement: "after_arrival"
  },
  
  // Flight Search
  flight_search: {
    name: "Flight Search",
    description: "Find the best flight deals",
    script: `<script async src="https://tpwdgt.com/content?currency=usd&trs=455192&shmarker=634822&show_hotels=true&locale=en&searchUrl=www.aviasales.com%2Fsearch&primary_override=%2332a8dd&color_button=%2355a539&color_icons=%2332a8dd&dark=%23262626&light=%23FFFFFF&secondary=%23FFFFFF&special=%23C4C4C4&color_focused=%2332a8dd&border_radius=5&plain=false&promo_id=7879&campaign_id=100" charset="utf-8"></script>`,
    category: "flights",
    placement: "before_trip"
  },
  
  // Hotel Booking
  hotel_booking: {
    name: "Hotel Booking",
    description: "Book your accommodation",
    script: `<script async src="https://tpwdgt.com/content?currency=usd&trs=455192&shmarker=634822&show_hotels=true&locale=en&powered_by=false&searchUrl=www.aviasales.com%2Fsearch&primary_override=%2332a8dd&color_button=%2355a539&color_icons=%2332a8dd&secondary=%23FFFFFF&dark=%23262626&light=%23FFFFFF&special=%23C4C4C4&color_focused=%2332a8dd&border_radius=5&plain=false&promo_id=7873&campaign_id=101" charset="utf-8"></script>`,
    category: "accommodation",
    placement: "after_arrival"
  },

  // GetYourGuide Activities - Your Partner ID PUHVJ53
  getyourguide: {
    name: "Activities & Tours",
    description: "Curated tours and activities",
    script: `<div data-gyg-href="https://widget.getyourguide.com/default/activities.frame" data-gyg-locale-code="en-US" data-gyg-widget="activities" data-gyg-number-of-items="3" data-gyg-partner-id="PUHVJ53" style="margin: 20px 0;"></div><script async defer src="https://widget.getyourguide.com/dist/pa.umd.production.min.js" data-gyg-partner-id="PUHVJ53"></script>`,
    category: "activities",
    placement: "must_see"
  }
};

// Widget placement logic - INCLUDE ALL REQUESTED WIDGETS
function getWidgetsForDestination(destination, tripType, interests = []) {
  const widgets = [];
  
  // ALWAYS include ALL your requested widgets for every destination
  widgets.push(AFFILIATE_WIDGETS.flight_search);      // ✈️ Flight Search
  widgets.push(AFFILIATE_WIDGETS.hotel_booking);      // 🏨 Hotel Booking  
  widgets.push(AFFILIATE_WIDGETS.car_rentals);        // 🚗 Car Rentals
  widgets.push(AFFILIATE_WIDGETS.airport_transfers);  // 🚌 Airport Transfers
  widgets.push(AFFILIATE_WIDGETS.esim);              // 📶 eSIM
  widgets.push(AFFILIATE_WIDGETS.getyourguide);      // 🎫 GetYourGuide
  
  return widgets;
}

// Generate widget HTML with section-specific placement
function generateWidgetHTML(widgets, placement = 'inline') {
  if (!widgets || widgets.length === 0) return '';
  
  // Group widgets by category for better organization
  const groupedWidgets = {
    flights: widgets.filter(w => w.category === 'flights'),
    accommodation: widgets.filter(w => w.category === 'accommodation'),
    transport: widgets.filter(w => w.category === 'transport'),
    connectivity: widgets.filter(w => w.category === 'connectivity')
  };
  
  const widgetHTML = widgets.map(widget => `
    <div class="affiliate-widget" data-category="${widget.category}" data-placement="${widget.placement}">
      <div class="widget-header">
        <h4>${widget.name}</h4>
        <p>${widget.description}</p>
      </div>
      <div class="widget-content">
        ${widget.script}
      </div>
    </div>
  `).join('');
  
  return `
    <div class="affiliate-widgets-section">
      <h3>🚀 Book Your Trip Essentials</h3>
      <div class="widgets-grid">
        ${widgetHTML}
      </div>
    </div>
  `;
}

// Generate section-specific widget HTML
function generateSectionWidgets(section, widgets) {
  const relevantWidgets = widgets.filter(widget => {
    switch(section) {
      case 'transportation':
      case 'getting_around':
        return widget.category === 'transport' || widget.category === 'flights';
      case 'accommodation':
      case 'hotels':
        return widget.category === 'accommodation';
      case 'connectivity':
      case 'essentials':
        return widget.category === 'connectivity';
      default:
        return true;
    }
  });
  
  if (relevantWidgets.length === 0) return '';
  
  const widgetHTML = relevantWidgets.map(widget => `
    <div class="section-widget" data-category="${widget.category}">
      <div class="widget-header">
        <h4>${widget.name}</h4>
        <p>${widget.description}</p>
      </div>
      <div class="widget-content">
        ${widget.script}
      </div>
    </div>
  `).join('');
  
  return `
    <div class="section-widgets">
      ${widgetHTML}
    </div>
  `;
}

export { AFFILIATE_WIDGETS, getWidgetsForDestination, generateWidgetHTML, generateSectionWidgets };