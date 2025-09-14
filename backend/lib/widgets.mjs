import { JSDOM } from 'jsdom';

// Affiliate Widgets Configuration
const AFFILIATE_WIDGETS = {
  // Airport Transfers
  airport_transfers: {
    name: "Airport Transfers",
    description: "Book reliable airport pickup and drop-off",
    script: `<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&show_header=true&campaign_id=627&promo_id=8951" charset="utf-8"></script>`,
    category: "transport",
    placement: "budget_breakdown"
  },
  
  // eSIM - MOVED to Useful Apps section
  esim: {
    name: "eSIM",
    description: "Get instant internet access worldwide",
    script: `<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&color_button=%23f2685f&color_focused=%23f2685f&secondary=%23FFFFFF&dark=%2311100f&light=%23FFFFFF&special=%23C4C4C4&border_radius=5&plain=false&no_labels=true&promo_id=8588&campaign_id=541" charset="utf-8"></script>`,
    category: "connectivity",
    placement: "useful_apps"
  },
  
  // Car Rentals - MOVED to Budget Breakdown section
  car_rentals: {
    name: "Car Rentals",
    description: "Rent a car for your trip",
    script: `<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&border_radius=5&plain=true&show_logo=true&color_background=%23ffca28&color_button=%2355a539&color_text=%23000000&color_input_text=%23000000&color_button_text=%23ffffff&promo_id=4480&campaign_id=10" charset="utf-8"></script>`,
    category: "transport",
    placement: "budget_breakdown"
  },
  
  // Flight Search - MOVED to Budget Breakdown section
  flight_search: {
    name: "Flight Search",
    description: "Find the best flight deals",
    script: `<script async src="https://tpwdgt.com/content?currency=usd&trs=455192&shmarker=634822&show_hotels=true&locale=en&searchUrl=www.aviasales.com%2Fsearch&primary_override=%2332a8dd&color_button=%2355a539&color_icons=%2332a8dd&dark=%23262626&light=%23FFFFFF&secondary=%23FFFFFF&special=%23C4C4C4&color_focused=%2332a8dd&border_radius=5&plain=false&promo_id=7879&campaign_id=100" charset="utf-8"></script>`,
    category: "flights",
    placement: "budget_breakdown"
  },
  
  // Hotel Booking - MOVED to Budget Breakdown section
  hotel_booking: {
    name: "Hotel Booking",
    description: "Book your accommodation",
    script: `<script async src="https://tpwdgt.com/content?currency=usd&trs=455192&shmarker=634822&show_hotels=true&locale=en&powered_by=false&searchUrl=www.aviasales.com%2Fsearch&primary_override=%2332a8dd&color_button=%2355a539&color_icons=%2332a8dd&secondary=%23FFFFFF&dark=%23262626&light=%23FFFFFF&special=%23C4C4C4&color_focused=%2332a8dd&border_radius=5&plain=false&promo_id=7873&campaign_id=101" charset="utf-8"></script>`,
    category: "accommodation",
    placement: "budget_breakdown"
  },

  // GetYourGuide Activities - Your Partner ID PUHVJ53
  getyourguide: {
    name: "Activities & Tours",
    description: "Curated tours and activities",
    script: `<div data-gyg-widget="auto" data-gyg-partner-id="PUHVJ53"></div>
<!-- GetYourGuide Analytics -->
<script async defer src="https://widget.getyourguide.com/dist/pa.umd.production.min.js" data-gyg-partner-id="PUHVJ53"></script>`,
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

// Inject widgets into HTML using jsdom for precise insertion
function injectWidgetsIntoSections(html, widgets) {
  if (!widgets || widgets.length === 0) return html;
  
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    let widgetsInjected = {
      "Budget Breakdown": 0,
      "Must-See": 0,
      "Daily Itineraries": 0,
      "Useful Apps": 0,
      "Weather": 0
    };

    // 1. REMOVE widgets from Don't Forget List section (if any exist)
    const dontForgetSection = Array.from(document.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Don't Forget List") || h.textContent.includes("🧳")
    );
    if (dontForgetSection) {
      let current = dontForgetSection.nextElementSibling;
      while (current && !current.matches('h2')) {
        if (current.classList.contains('section-widget') || 
            current.querySelector('script[src*="tpwdgt.com"]')) {
          const next = current.nextElementSibling;
          current.remove();
          current = next;
        } else {
          current = current.nextElementSibling;
        }
      }
    }

    // 2. ADD Weather widget after Trip Overview section
    const tripOverviewSection = Array.from(document.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Trip Overview") || h.textContent.includes("🎯")
    );
    if (tripOverviewSection) {
      const weatherWidget = document.createElement('div');
      weatherWidget.className = 'weather-widget';
      weatherWidget.innerHTML = `
        <h2>🌤️ Weather Forecast</h2>
        <table class="budget-table">
          <thead>
            <tr><th>Date</th><th>Min</th><th>Max</th><th>Rain%</th><th>Details</th></tr>
          </thead>
          <tbody>
            <tr><td>Day 1</td><td>18°</td><td>24°</td><td>10%</td><td><a href="https://maps.google.com/?q=weather" target="_blank">Forecast</a></td></tr>
            <tr><td>Day 2</td><td>19°</td><td>25°</td><td>5%</td><td><a href="https://maps.google.com/?q=weather" target="_blank">Forecast</a></td></tr>
            <tr><td>Day 3</td><td>17°</td><td>23°</td><td>15%</td><td><a href="https://maps.google.com/?q=weather" target="_blank">Forecast</a></td></tr>
            <tr><td>Day 4</td><td>20°</td><td>26°</td><td>0%</td><td><a href="https://maps.google.com/?q=weather" target="_blank">Forecast</a></td></tr>
            <tr><td>Day 5</td><td>18°</td><td>24°</td><td>20%</td><td><a href="https://maps.google.com/?q=weather" target="_blank">Forecast</a></td></tr>
            <tr><td>Day 6</td><td>19°</td><td>25°</td><td>5%</td><td><a href="https://maps.google.com/?q=weather" target="_blank">Forecast</a></td></tr>
            <tr><td>Day 7</td><td>21°</td><td>27°</td><td>0%</td><td><a href="https://maps.google.com/?q=weather" target="_blank">Forecast</a></td></tr>
          </tbody>
        </table>
      `;
      
      // Find next h2 after Trip Overview
      let nextSection = tripOverviewSection.nextElementSibling;
      while (nextSection && !nextSection.matches('h2')) {
        nextSection = nextSection.nextElementSibling;
      }
      
      if (nextSection) {
        nextSection.parentNode.insertBefore(weatherWidget, nextSection);
        widgetsInjected["Weather"] = 1;
      }
    }

    // 3. MOVE Flight, Hotel, Car, Airport Transfer widgets to Budget Breakdown section
    const budgetBreakdownSection = Array.from(document.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Budget Breakdown") || h.textContent.includes("💰")
    );
    if (budgetBreakdownSection) {
      const budgetWidgets = widgets.filter(w => w.placement === "budget_breakdown");
      
      budgetWidgets.forEach(widget => {
        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'section-widget';
        widgetDiv.setAttribute('data-category', widget.category);
        widgetDiv.innerHTML = `
          <div class="widget-header">
            <h4>${widget.name}</h4>
            <p>${widget.description}</p>
          </div>
          <div class="widget-content">
            ${widget.script}
          </div>
        `;
        
        // Find next h2 after Budget Breakdown
        let nextSection = budgetBreakdownSection.nextElementSibling;
        while (nextSection && !nextSection.matches('h2')) {
          nextSection = nextSection.nextElementSibling;
        }
        
        if (nextSection) {
          nextSection.parentNode.insertBefore(widgetDiv, nextSection);
          widgetsInjected["Budget Breakdown"]++;
        }
      });
    }

    // 4. ADD Airalo/eSIM widget to Useful Apps section
    const usefulAppsSection = Array.from(document.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Useful Apps") || h.textContent.includes("📱")
    );
    if (usefulAppsSection) {
      const esimWidget = widgets.find(w => w.category === "connectivity");
      if (esimWidget) {
        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'section-widget';
        widgetDiv.setAttribute('data-category', 'connectivity');
        widgetDiv.innerHTML = `
          <div class="widget-header">
            <h4>${esimWidget.name}</h4>
            <p>${esimWidget.description}</p>
          </div>
          <div class="widget-content">
            ${esimWidget.script}
          </div>
        `;
        
        // Find next h2 after Useful Apps
        let nextSection = usefulAppsSection.nextElementSibling;
        while (nextSection && !nextSection.matches('h2')) {
          nextSection = nextSection.nextElementSibling;
        }
        
        if (nextSection) {
          nextSection.parentNode.insertBefore(widgetDiv, nextSection);
          widgetsInjected["Useful Apps"]++;
        }
      }
    }

    // 5. ADD GetYourGuide widget to Must-See Attractions section
    const mustSeeSection = Array.from(document.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Must-See Attractions") || h.textContent.includes("🎫")
    );
    if (mustSeeSection) {
      const gygWidget = widgets.find(w => w.category === "activities");
      if (gygWidget) {
        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'section-widget gyg-widget';
        widgetDiv.innerHTML = gygWidget.script;
        
        // Find next h2 after Must-See Attractions
        let nextSection = mustSeeSection.nextElementSibling;
        while (nextSection && !nextSection.matches('h2')) {
          nextSection = nextSection.nextElementSibling;
        }
        
        if (nextSection) {
          nextSection.parentNode.insertBefore(widgetDiv, nextSection);
          widgetsInjected["Must-See"]++;
        }
      }
    }

    // 6. ADD GetYourGuide widgets between Day 2/3 and 4/5 in Daily Itineraries
    const dailyItinerariesSection = Array.from(document.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Daily Itineraries") || h.textContent.includes("🎭")
    );
    if (dailyItinerariesSection) {
      const gygWidget = widgets.find(w => w.category === "activities");
      if (gygWidget) {
        // Find Day 2 and Day 4 headings
        const dayHeadings = Array.from(document.querySelectorAll('h3')).filter(h => 
          h.textContent.match(/Day\s+\d+/i)
        );
        
        // Insert between Day 2 and Day 3
        const day2 = dayHeadings.find(h => h.textContent.match(/Day\s+2/i));
        const day3 = dayHeadings.find(h => h.textContent.match(/Day\s+3/i));
        if (day2 && day3) {
          const widgetDiv = document.createElement('div');
          widgetDiv.className = 'gyg-widget-inline';
          widgetDiv.innerHTML = gygWidget.script;
          day3.parentNode.insertBefore(widgetDiv, day3);
          widgetsInjected["Daily Itineraries"]++;
        }
        
        // Insert between Day 4 and Day 5
        const day4 = dayHeadings.find(h => h.textContent.match(/Day\s+4/i));
        const day5 = dayHeadings.find(h => h.textContent.match(/Day\s+5/i));
        if (day4 && day5) {
          const widgetDiv = document.createElement('div');
          widgetDiv.className = 'gyg-widget-inline';
          widgetDiv.innerHTML = gygWidget.script;
          day5.parentNode.insertBefore(widgetDiv, day5);
          widgetsInjected["Daily Itineraries"]++;
        }
      }
    }

    console.log(`Widgets injected: Budget Breakdown (${widgetsInjected["Budget Breakdown"]}), Must-See (${widgetsInjected["Must-See"]}), Daily Itineraries (${widgetsInjected["Daily Itineraries"]}), Useful Apps (${widgetsInjected["Useful Apps"]}), Weather (${widgetsInjected["Weather"]})`);
    
    return dom.serialize();
  } catch (error) {
    console.error('Widget injection error:', error);
    return html; // Return original HTML if injection fails
  }
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
  
  const widgetHTML = widgets.map(widget => {
    // Handle GetYourGuide widget differently (it's a function)
    let scriptContent = widget.script;
    if (typeof widget.script === 'function') {
      scriptContent = widget.script('destination'); // Call function with destination
    }
    
    return `
    <div class="affiliate-widget" data-category="${widget.category}" data-placement="${widget.placement}">
      <div class="widget-header">
        <h4>${widget.name}</h4>
        <p>${widget.description}</p>
      </div>
      <div class="widget-content">
        ${scriptContent}
      </div>
    </div>
  `;
  }).join('');
  
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

export { AFFILIATE_WIDGETS, getWidgetsForDestination, generateWidgetHTML, generateSectionWidgets, injectWidgetsIntoSections };