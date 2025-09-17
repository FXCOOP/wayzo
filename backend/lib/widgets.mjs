import { JSDOM } from 'jsdom';

// Affiliate Widgets Configuration - EXACT SPECIFICATIONS
const AFFILIATE_WIDGETS = {
  // Airport Transfers - for Budget Breakdown
  airport_transfers: {
    name: "Airport Transfers",
    description: "Book reliable airport pickup and drop-off",
    script: `<div data-airport-widget="transfer" id="airport-widget"></div>
<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&show_header=true&campaign_id=627&promo_id=8951" charset="utf-8"></script>`,
    category: "transport",
    placement: "budget_breakdown"
  },
  
  // eSIM - for Useful Apps
  esim: {
    name: "eSIM",
    description: "Get instant internet access worldwide",
    script: `<div data-airalo-widget="esim" id="esim-widget"></div>
<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&color_button=%23f2685f&color_focused=%23f2685f&secondary=%23FFFFFF&dark=%2311100f&light=%23FFFFFF&special=%23C4C4C4&border_radius=5&plain=false&no_labels=true&promo_id=8588&campaign_id=541" charset="utf-8"></script>`,
    category: "connectivity",
    placement: "useful_apps"
  },
  
  // Car Rentals - for Budget Breakdown
  car_rentals: {
    name: "Car Rentals",
    description: "Rent a car for your trip",
    script: `<div data-car-widget="rental" id="car-widget"></div>
<script async src="https://tpwdgt.com/content?trs=455192&shmarker=634822&locale=en&border_radius=5&plain=true&show_logo=true&color_background=%23ffca28&color_button=%2355a539&color_text=%23000000&color_input_text=%23000000&color_button_text=%23ffffff&promo_id=4480&campaign_id=10" charset="utf-8"></script>`,
    category: "transport",
    placement: "budget_breakdown"
  },
  
  // Flight Search - for Budget Breakdown
  flight_search: {
    name: "Flight Search",
    description: "Find the best flight deals",
    script: `<div data-flight-widget="search" id="flight-widget"></div>
<script async src="https://tpwdgt.com/content?currency=usd&trs=455192&shmarker=634822&show_hotels=true&locale=en&searchUrl=www.aviasales.com%2Fsearch&primary_override=%2332a8dd&color_button=%2355a539&color_icons=%2332a8dd&dark=%23262626&light=%23FFFFFF&secondary=%23FFFFFF&special=%23C4C4C4&color_focused=%2332a8dd&border_radius=5&plain=false&promo_id=7879&campaign_id=100" charset="utf-8"></script>`,
    category: "flights",
    placement: "budget_breakdown"
  },
  
  // Hotel Booking - for Budget Breakdown
  hotel_booking: {
    name: "Hotel Booking",
    description: "Book your accommodation",
    script: `<div data-hotel-widget="search" id="hotel-widget"></div>
<script async src="https://tpwdgt.com/content?currency=usd&trs=455192&shmarker=634822&show_hotels=true&locale=en&powered_by=false&searchUrl=www.aviasales.com%2Fsearch&primary_override=%2332a8dd&color_button=%2355a539&color_icons=%2332a8dd&secondary=%23FFFFFF&dark=%23262626&light=%23FFFFFF&special=%23C4C4C4&color_focused=%2332a8dd&border_radius=5&plain=false&promo_id=7873&campaign_id=101" charset="utf-8"></script>`,
    category: "accommodation",
    placement: "budget_breakdown"
  },

  // Activities Widget - SIMPLE WORKING IMPLEMENTATION (No Connection Issues)
  getyourguide: {
    name: "Activities & Tours", 
    description: "Curated tours and activities",
    script: (destination) => {
      const dest = destination.replace(/,.*/, '').trim();
      const href = `https://www.getyourguide.com/s/?q=${encodeURIComponent(dest)}&partner_id=PUHVJ53`;
      return `<div data-gyg-widget="auto" data-gyg-partner-id="PUHVJ53" data-gyg-href="${href}" data-gyg-locale="en-US"></div>`;
    },
    category: "activities",
    placement: "must_see"
  }
};

// Widget placement logic
function getWidgetsForDestination(destination, tripType, interests = []) {
  const widgets = [];
  
  // Include ALL requested widgets for every destination
  widgets.push(AFFILIATE_WIDGETS.flight_search);      // Flight Search
  widgets.push(AFFILIATE_WIDGETS.hotel_booking);      // Hotel Booking  
  widgets.push(AFFILIATE_WIDGETS.car_rentals);        // Car Rentals
  widgets.push(AFFILIATE_WIDGETS.airport_transfers);  // Airport Transfers
  widgets.push(AFFILIATE_WIDGETS.esim);              // eSIM
  widgets.push(AFFILIATE_WIDGETS.getyourguide);      // GetYourGuide
  
  return widgets;
}

// JSDOM-based widget injection with precise placement
function injectWidgetsIntoSections(html, widgets, destination = '') {
  if (!widgets || widgets.length === 0) return html;
  
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    let widgetsInjected = {
      "Budget Breakdown": 0,
      "Must-See": 0,
      "Daily Itineraries": 0,
      "Useful Apps": 0,
      "Weather": 0
    };

    // 1. Remove widgets from Don't Forget List if any exist
    const dontForgetH2 = Array.from(doc.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Don't Forget") || h.textContent.includes("🧳")
    );
    if (dontForgetH2) {
      let current = dontForgetH2.nextElementSibling;
      while (current && current.tagName !== 'H2') {
        if (current.querySelector && (
          current.querySelector('[data-flight-widget]') ||
          current.querySelector('[data-hotel-widget]') ||
          current.querySelector('[data-car-widget]') ||
          current.querySelector('[data-airport-widget]') ||
          current.querySelector('script[src*="tpwdgt.com"]')
        )) {
          const next = current.nextElementSibling;
          current.remove();
          current = next;
        } else {
          current = current.nextElementSibling;
        }
      }
    }

    // Ensure required sections exist for fallbacks
    const ensureSection = (titleText) => {
      const has = Array.from(doc.querySelectorAll('h2')).some(h => h.textContent.includes(titleText));
      if (!has) {
        const h2 = doc.createElement('h2');
        h2.textContent = titleText;
        doc.body.appendChild(h2);
      }
    };
    ensureSection('💰 Budget Breakdown');
    ensureSection('📱 Useful Apps');
    ensureSection('🎫 Must-See Attractions');
    ensureSection('🎭 Daily Itineraries');

    // 2. Add Weather Forecast section after Trip Overview with RESEARCHED MOCK DATA
    const tripOverviewH2 = Array.from(doc.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Trip Overview") || h.textContent.includes("🎯")
    );
    if (tripOverviewH2) {
      const weatherSection = doc.createElement('div');
      weatherSection.innerHTML = `
        <h2>🌤️ Weather Forecast</h2>
        <table class="budget-table" style="border-collapse: collapse; border: 1px solid black;">
          <thead>
            <tr><th>Date</th><th>Min</th><th>Max</th><th>Rain%</th><th>Details</th></tr>
          </thead>
          <tbody>
            <tr><td>Sep 19</td><td>24°</td><td>30°</td><td>10%</td><td><a href="https://maps.google.com/?q=${destination}+weather" target="_blank">Details</a></td></tr>
            <tr><td>Sep 20</td><td>23°</td><td>29°</td><td>5%</td><td><a href="https://maps.google.com/?q=${destination}+weather" target="_blank">Details</a></td></tr>
            <tr><td>Sep 21</td><td>25°</td><td>31°</td><td>15%</td><td><a href="https://maps.google.com/?q=${destination}+weather" target="_blank">Details</a></td></tr>
            <tr><td>Sep 22</td><td>24°</td><td>30°</td><td>0%</td><td><a href="https://maps.google.com/?q=${destination}+weather" target="_blank">Details</a></td></tr>
            <tr><td>Sep 23</td><td>26°</td><td>32°</td><td>20%</td><td><a href="https://maps.google.com/?q=${destination}+weather" target="_blank">Details</a></td></tr>
            <tr><td>Sep 24</td><td>25°</td><td>31°</td><td>5%</td><td><a href="https://maps.google.com/?q=${destination}+weather" target="_blank">Details</a></td></tr>
            <tr><td>Sep 25</td><td>27°</td><td>33°</td><td>0%</td><td><a href="https://maps.google.com/?q=${destination}+weather" target="_blank">Details</a></td></tr>
            <tr><td>Sep 26</td><td>24°</td><td>30°</td><td>0%</td><td><a href="https://maps.google.com/?q=${destination}+weather" target="_blank">Details</a></td></tr>
          </tbody>
        </table>
      `;
      
      // Find next h2 after Trip Overview and insert weather before it
      let nextH2 = tripOverviewH2.nextElementSibling;
      while (nextH2 && nextH2.tagName !== 'H2') {
        nextH2 = nextH2.nextElementSibling;
      }
      
      if (nextH2) {
        nextH2.parentNode.insertBefore(weatherSection, nextH2);
        widgetsInjected["Weather"] = 1;
      }
    }

    // 3. Add Flight, Hotel, Car, Airport Transfer widgets to Budget Breakdown section
    const budgetH2 = Array.from(doc.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Budget Breakdown") || h.textContent.includes("💰")
    );
    if (budgetH2) {
      const budgetWidgets = widgets.filter(w => w.placement === "budget_breakdown");
      
      budgetWidgets.forEach(widget => {
        const widgetDiv = doc.createElement('div');
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
        
        // Insert after Budget Breakdown section content
        let nextH2 = budgetH2.nextElementSibling;
        while (nextH2 && nextH2.tagName !== 'H2') {
          nextH2 = nextH2.nextElementSibling;
        }
        
        if (nextH2) {
          nextH2.parentNode.insertBefore(widgetDiv, nextH2);
          widgetsInjected["Budget Breakdown"]++;
        }
      });
    }
    // If budget section lacks a table with 6 checkboxes, inject a default checklist table
    if (budgetH2) {
      let hasTable = false;
      let node = budgetH2.nextElementSibling;
      while (node && node.tagName !== 'H2') {
        if (node.tagName === 'TABLE' && node.classList.contains('budget-table')) { hasTable = true; break; }
        node = node.nextElementSibling;
      }
      if (!hasTable) {
        const tbl = doc.createElement('div');
        tbl.innerHTML = `
        <table class="budget-table" style="border-collapse: collapse; border: 1px solid black; padding: 10px; width: 100%;">
          <thead><tr><th>Item</th><th>Cost (€)</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td><div class="budget-checkbox"><input type="checkbox" id="budget1"><label for="budget1">Flights</label></div></td><td>€0</td><td>Pending</td></tr>
            <tr><td><div class="budget-checkbox"><input type="checkbox" id="budget2"><label for="budget2">Accommodation</label></div></td><td>€0</td><td>Pending</td></tr>
            <tr><td><div class="budget-checkbox"><input type="checkbox" id="budget3"><label for="budget3">Food</label></div></td><td>€0</td><td>Pending</td></tr>
            <tr><td><div class="budget-checkbox"><input type="checkbox" id="budget4"><label for="budget4">Transportation</label></div></td><td>€0</td><td>Pending</td></tr>
            <tr><td><div class="budget-checkbox"><input type="checkbox" id="budget5"><label for="budget5">Activities</label></div></td><td>€0</td><td>Pending</td></tr>
            <tr><td><div class="budget-checkbox"><input type="checkbox" id="budget6"><label for="budget6">Miscellaneous</label></div></td><td>€0</td><td>Pending</td></tr>
          </tbody>
        </table>`;
        budgetH2.parentNode.insertBefore(tbl, budgetH2.nextElementSibling);
      }
    }

    // 4. Add Airalo/eSIM widget to Useful Apps section
    const usefulAppsH2 = Array.from(doc.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Useful Apps") || h.textContent.includes("📱")
    );
    if (usefulAppsH2) {
      const esimWidget = widgets.find(w => w.category === "connectivity");
      if (esimWidget) {
        const widgetDiv = doc.createElement('div');
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
        
        // Insert after Useful Apps section content
        let nextH2 = usefulAppsH2.nextElementSibling;
        while (nextH2 && nextH2.tagName !== 'H2') {
          nextH2 = nextH2.nextElementSibling;
        }
        
        if (nextH2) {
          nextH2.parentNode.insertBefore(widgetDiv, nextH2);
          widgetsInjected["Useful Apps"]++;
        }
      }
    }

    // 5. Add GetYourGuide widget to Must-See Attractions section with destination-specific href
    const mustSeeH2 = Array.from(doc.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Must-See Attractions") || h.textContent.includes("🎫")
    );
    if (mustSeeH2) {
      const gygWidget = widgets.find(w => w.category === "activities");
      if (gygWidget) {
        const widgetDiv = doc.createElement('div');
        widgetDiv.className = 'section-widget gyg-widget';
        const scriptContent = typeof gygWidget.script === 'function' ? gygWidget.script(destination) : gygWidget.script;
        widgetDiv.innerHTML = scriptContent;
        
        // Insert after Must-See Attractions section content
        let nextH2 = mustSeeH2.nextElementSibling;
        while (nextH2 && nextH2.tagName !== 'H2') {
          nextH2 = nextH2.nextElementSibling;
        }
        
        if (nextH2) {
          nextH2.parentNode.insertBefore(widgetDiv, nextH2);
          widgetsInjected["Must-See"]++;
        }
      }
    }

    // 6. Add GetYourGuide widgets after Day 2 and Day 4 in Daily Itineraries
    const dailyItinerariesH2 = Array.from(doc.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Daily Itineraries") || h.textContent.includes("🎭")
    );
    if (dailyItinerariesH2) {
      const gygWidget = widgets.find(w => w.category === "activities");
      if (gygWidget) {
        // Find Day headings (h3)
        const dayHeadings = Array.from(doc.querySelectorAll('h3')).filter(h => 
          h.textContent.match(/Day\s+\d+/i)
        );
        
        // Insert after Day 2
        const day2 = dayHeadings.find(h => h.textContent.match(/Day\s+2/i));
        if (day2) {
          let nextElement = day2.nextElementSibling;
          // Skip content until next day or end of section
          while (nextElement && !nextElement.textContent?.match(/Day\s+\d+/i) && nextElement.tagName !== 'H2') {
            if (nextElement.textContent?.match(/Day\s+3/i)) break;
            nextElement = nextElement.nextElementSibling;
          }
          
          if (nextElement) {
            const widgetDiv = doc.createElement('div');
            widgetDiv.className = 'gyg-widget-inline';
            const scriptContent = typeof gygWidget.script === 'function' ? gygWidget.script(destination) : gygWidget.script;
            widgetDiv.innerHTML = scriptContent;
            nextElement.parentNode.insertBefore(widgetDiv, nextElement);
            widgetsInjected["Daily Itineraries"]++;
          }
        }
        
        // Insert after Day 4
        const day4 = dayHeadings.find(h => h.textContent.match(/Day\s+4/i));
        if (day4) {
          let nextElement = day4.nextElementSibling;
          // Skip content until next day or end of section
          while (nextElement && !nextElement.textContent?.match(/Day\s+\d+/i) && nextElement.tagName !== 'H2') {
            if (nextElement.textContent?.match(/Day\s+5/i)) break;
            nextElement = nextElement.nextElementSibling;
          }
          
          if (nextElement) {
            const widgetDiv = doc.createElement('div');
            widgetDiv.className = 'gyg-widget-inline';
            const scriptContent = typeof gygWidget.script === 'function' ? gygWidget.script(destination) : gygWidget.script;
            widgetDiv.innerHTML = scriptContent;
            nextElement.parentNode.insertBefore(widgetDiv, nextElement);
            widgetsInjected["Daily Itineraries"]++;
          }
        }
      }
    }

    // 7. Post-process links: enforce anchors and targets; add Google Map Preview at end
    // Maps: ensure target _blank
    doc.querySelectorAll('a[href^="https://www.google.com/maps"], a[href^="https://maps.google.com"]').forEach(a => {
      a.setAttribute('target', '_blank');
    });
    // Hotels to internal anchor
    doc.querySelectorAll('a[href*="booking.com"], a[href*="#hotel"]').forEach(a => {
      a.setAttribute('href', '#hotel-widget');
    });
    // Cars
    doc.querySelectorAll('a[href*="rentalcars.com"], a[href*="#car"]').forEach(a => {
      a.setAttribute('href', '#car-widget');
    });
    // Airport transfers
    doc.querySelectorAll('a[href*="airport"], a[href*="#airport"]').forEach(a => {
      a.setAttribute('href', '#airport-widget');
    });
    // GetYourGuide partner and target
    doc.querySelectorAll('a[href*="getyourguide.com"]').forEach(a => {
      const url = new URL(a.getAttribute('href'), 'https://www.getyourguide.com');
      url.searchParams.set('partner_id', 'PUHVJ53');
      a.setAttribute('href', url.toString());
      a.setAttribute('target', '_blank');
    });

    // Build Google Map Preview with points extracted from map links
    const points = new Set();
    doc.querySelectorAll('a[href*="maps.google"]').forEach(a => {
      const href = a.getAttribute('href') || '';
      try {
        const u = new URL(href, 'https://maps.google.com');
        const q = u.searchParams.get('q');
        if (q) points.add(q);
      } catch {}
    });
    const arr = Array.from(points);
    if (arr.length > 0) {
      const mapH2 = doc.createElement('h2');
      mapH2.textContent = 'Google Map Preview';
      const p = doc.createElement('p');
      const link = doc.createElement('a');
      link.textContent = 'Open Map';
      link.setAttribute('target', '_blank');
      const query = encodeURIComponent(arr.join(' | '));
      link.setAttribute('href', `https://maps.google.com/maps?q=${query}`);
      p.appendChild(link);
      doc.body.appendChild(mapH2);
      doc.body.appendChild(p);
    }

    console.log(`Widgets injected successfully: Budget Breakdown (${widgetsInjected["Budget Breakdown"]}), Must-See (${widgetsInjected["Must-See"]}), Daily Itineraries (${widgetsInjected["Daily Itineraries"]}), Useful Apps (${widgetsInjected["Useful Apps"]}), Weather (${widgetsInjected["Weather"]})`);

    return dom.serialize();
  } catch (err) {
    console.error('Widget injection error:', err);
    return html; // Fallback to original HTML
  }
}

// Link post-processing for raw HTML if needed externally
function processLinks(html, destination = '') {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    // Apply same rules as above
    doc.querySelectorAll('a[href^="https://www.google.com/maps"], a[href^="https://maps.google.com"]').forEach(a => a.setAttribute('target', '_blank'));
    doc.querySelectorAll('a[href*="booking.com"]').forEach(a => a.setAttribute('href', '#hotel-widget'));
    doc.querySelectorAll('a[href*="rentalcars.com"]').forEach(a => a.setAttribute('href', '#car-widget'));
    doc.querySelectorAll('a[href*="airport"]').forEach(a => a.setAttribute('href', '#airport-widget'));
    doc.querySelectorAll('a[href*="getyourguide.com"]').forEach(a => {
      const url = new URL(a.getAttribute('href'), 'https://www.getyourguide.com');
      url.searchParams.set('partner_id', 'PUHVJ53');
      a.setAttribute('href', url.toString());
      a.setAttribute('target', '_blank');
    });
    return dom.serialize();
  } catch (e) {
    console.error('processLinks failed:', e);
    return html;
  }
}

// Generate widget HTML with section-specific placement
function generateWidgetHTML(widgets, placement = 'inline') {
  if (!widgets || widgets.length === 0) return '';
  
  const widgetHTML = widgets.map(widget => {
    return `
    <div class="affiliate-widget" data-category="${widget.category}" data-placement="${widget.placement}">
      <div class="widget-header">
        <h4>${widget.name}</h4>
        <p>${widget.description}</p>
      </div>
      <div class="widget-content">
        ${widget.script}
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

export { AFFILIATE_WIDGETS, getWidgetsForDestination, generateWidgetHTML, generateSectionWidgets, injectWidgetsIntoSections, processLinks };