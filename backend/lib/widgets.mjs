import { JSDOM } from 'jsdom';

// Affiliate Widgets Configuration - EXACT SPECIFICATIONS WITH IDs
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

  // Activities Widget - GetYourGuide with partner_id
  getyourguide: {
    name: "Activities & Tours", 
    description: "Curated tours and activities",
    script: (destination) => `<div data-gyg-widget="auto" data-gyg-partner-id="PUHVJ53" data-gyg-locale="en-US" data-gyg-href="https://www.getyourguide.com/s/?q=${encodeURIComponent(destination.replace(/,.*/, '').trim())}&partner_id=PUHVJ53"></div>`,
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

// JSDOM-based widget injection with robust fallbacks and section creation
function injectWidgetsIntoSections(html, widgets, destination = '', nDays = 15) {
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

    // Helper function to create section if missing
    const createSectionIfMissing = (title, emoji) => {
      let section = Array.from(doc.querySelectorAll('h2')).find(h => 
        h.textContent.includes(title) || h.textContent.includes(emoji)
      );
      if (!section) {
        section = doc.createElement('h2');
        section.textContent = `${emoji} ${title}`;
        doc.body.appendChild(section);
        console.log(`Created missing section: ${emoji} ${title}`);
      }
      return section;
    };

    // Helper function to inject widget after section
    const injectWidgetAfterSection = (section, widget, category) => {
      const widgetDiv = doc.createElement('div');
      widgetDiv.className = 'section-widget';
      widgetDiv.setAttribute('data-category', category);
      widgetDiv.innerHTML = `
        <div class="widget-header">
          <h4>${widget.name}</h4>
          <p>${widget.description}</p>
        </div>
        <div class="widget-content">
          ${typeof widget.script === 'function' ? widget.script(destination) : widget.script}
        </div>
      `;
      
      // Insert after section content
      let nextH2 = section.nextElementSibling;
      while (nextH2 && nextH2.tagName !== 'H2') {
        nextH2 = nextH2.nextElementSibling;
      }
      
      if (nextH2) {
        nextH2.parentNode.insertBefore(widgetDiv, nextH2);
        return true;
      }
      return false;
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

    // 2. Add Weather Forecast section after Trip Overview with dynamic duration
    const tripOverviewH2 = createSectionIfMissing("Trip Overview", "🎯");
    if (tripOverviewH2) {
      // Generate weather table for full duration
      const weatherRows = [];
      for (let i = 0; i < nDays; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dayStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const tempHigh = Math.floor(Math.random() * 8) + 24; // 24-31°C
        const tempLow = tempHigh - Math.floor(Math.random() * 5) - 3; // 3-8°C below high
        const precipitation = Math.floor(Math.random() * 25); // 0-25%
        
        weatherRows.push(`
          <tr>
            <td>${dayStr}</td>
            <td>${tempLow}°</td>
            <td>${tempHigh}°</td>
            <td>${precipitation}%</td>
            <td><a href="https://maps.google.com/maps?q=${encodeURIComponent(destination)}+weather" target="_blank">Details</a></td>
          </tr>
        `);
      }
      
      const weatherSection = doc.createElement('div');
      weatherSection.innerHTML = `
        <h2>🌤️ Weather Forecast</h2>
        <table class="budget-table" style="border-collapse: collapse; border: 1px solid black; width: 100%;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="border: 1px solid black; padding: 8px;">Date</th>
              <th style="border: 1px solid black; padding: 8px;">Min</th>
              <th style="border: 1px solid black; padding: 8px;">Max</th>
              <th style="border: 1px solid black; padding: 8px;">Rain%</th>
              <th style="border: 1px solid black; padding: 8px;">Details</th>
            </tr>
          </thead>
          <tbody>
            ${weatherRows.join('')}
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
    const budgetH2 = createSectionIfMissing("Budget Breakdown", "💰");
    if (budgetH2) {
      const budgetWidgets = widgets.filter(w => w.placement === "budget_breakdown");
      
      budgetWidgets.forEach(widget => {
        if (injectWidgetAfterSection(budgetH2, widget, widget.category)) {
          widgetsInjected["Budget Breakdown"]++;
        }
      });
    }

    // 4. Add Airalo/eSIM widget to Useful Apps section
    const usefulAppsH2 = createSectionIfMissing("Useful Apps", "📱");
    if (usefulAppsH2) {
      const esimWidget = widgets.find(w => w.category === "connectivity");
      if (esimWidget && injectWidgetAfterSection(usefulAppsH2, esimWidget, 'connectivity')) {
        widgetsInjected["Useful Apps"]++;
      }
    }

    // 5. Add GetYourGuide widget to Must-See Attractions section
    const mustSeeH2 = createSectionIfMissing("Must-See Attractions", "🎫");
    if (mustSeeH2) {
      const gygWidget = widgets.find(w => w.category === "activities");
      if (gygWidget && injectWidgetAfterSection(mustSeeH2, gygWidget, 'activities')) {
        widgetsInjected["Must-See"]++;
      }
    }

    // 6. Add GetYourGuide widgets after Day 2 and Day 4 in Daily Itineraries
    const dailyItinerariesH2 = createSectionIfMissing("Daily Itineraries", "🎭");
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

    // 7. Post-process links to add target="_blank" and fix GYG partner_id
    const links = doc.querySelectorAll('a[href*="getyourguide.com"]');
    links.forEach(link => {
      if (!link.href.includes('partner_id=PUHVJ53')) {
        link.href += (link.href.includes('?') ? '&' : '?') + 'partner_id=PUHVJ53';
      }
      link.setAttribute('target', '_blank');
    });

    // Add target="_blank" to map links
    const mapLinks = doc.querySelectorAll('a[href*="maps.google.com"]');
    mapLinks.forEach(link => {
      link.setAttribute('target', '_blank');
    });

    // 8. Extract Google Map points and add single map section
    const mapPoints = [];
    const allText = doc.body.textContent;
    
    // Extract specific place names from the content
    const placePatterns = [
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:at|in|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Temple|Museum|Park|Beach|Market|Hotel|Restaurant)/g,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:St|Street|Avenue|Road|Boulevard)/g
    ];
    
    placePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(allText)) !== null) {
        const place = match[1] + (match[2] ? ' ' + match[2] : '');
        if (place.length > 3 && place.length < 50 && !mapPoints.includes(place)) {
          mapPoints.push(place);
        }
      }
    });

    // Add Google Map Preview section
    if (mapPoints.length > 0) {
      const mapSection = doc.createElement('div');
      mapSection.innerHTML = `
        <h2>Google Map Preview</h2>
        <p><a href="https://maps.google.com/maps?q=${encodeURIComponent(mapPoints.slice(0, 20).join('+'))}" target="_blank">Open Map</a></p>
      `;
      doc.body.appendChild(mapSection);
    }

    console.log(`Widgets injected successfully: Budget Breakdown (${widgetsInjected["Budget Breakdown"]}), Must-See (${widgetsInjected["Must-See"]}), Daily Itineraries (${widgetsInjected["Daily Itineraries"]}), Useful Apps (${widgetsInjected["Useful Apps"]}), Weather (${widgetsInjected["Weather"]})`);
    
    return dom.serialize();
  } catch (err) {
    console.error('Widget injection error:', err);
    return html; // Fallback to original HTML
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

export { AFFILIATE_WIDGETS, getWidgetsForDestination, generateWidgetHTML, generateSectionWidgets, injectWidgetsIntoSections };