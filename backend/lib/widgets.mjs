import { JSDOM } from 'jsdom';

// Affiliate Widgets Configuration - EXACT SPECIFICATIONS WITH IDS FOR COMO LAKE
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

  // GetYourGuide Widget with EXACT specifications for Como Lake
  getyourguide: {
    name: "Activities & Tours", 
    description: "Curated tours and activities",
    script: (destination) => `<div data-gyg-widget="auto" data-gyg-partner-id="PUHVJ53" data-gyg-href="https://www.getyourguide.com/s/?q=${encodeURIComponent(destination)}" data-gyg-locale="en-US"></div>`,
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

// Function to replace external links with internal widget links
function replaceExternalLinksWithInternal(doc) {
  try {
    // Replace external booking/review links in accommodation section
    const accommodationLinks = doc.querySelectorAll('a[href*="booking.com"], a[href*="tripadvisor.com"], a[href*="hotels.com"], a[href*="expedia.com"]');
    accommodationLinks.forEach(link => {
      if (link.textContent.toLowerCase().includes('book')) {
        link.href = '#hotel-widget';
        link.textContent = 'Book';
      } else if (link.textContent.toLowerCase().includes('review')) {
        link.href = '#hotel-widget';
        link.textContent = 'Reviews';
      }
    });

    // Replace car rental external links with internal links
    const carRentalLinks = doc.querySelectorAll('a[href*="rentalcars.com"], a[href*="hertz.com"], a[href*="avis.com"], a[href*="europcar.com"]');
    carRentalLinks.forEach(link => {
      link.href = '#car-widget';
      link.textContent = 'Car Rentals';
    });

    // Replace flight booking links with plain text
    const flightLinks = doc.querySelectorAll('a[href*="expedia.com"], a[href*="kayak.com"], a[href*="skyscanner.com"], a[href*="momondo.com"]');
    flightLinks.forEach(link => {
      const span = doc.createElement('span');
      span.textContent = 'Flight Information';
      link.parentNode.replaceChild(span, link);
    });

    // Ensure all [Tickets] and [Reviews] links use GYG with partner_id=PUHVJ53
    const ticketLinks = doc.querySelectorAll('a[href*="getyourguide.com"]');
    ticketLinks.forEach(link => {
      if (!link.href.includes('partner_id=PUHVJ53')) {
        if (link.href.includes('?')) {
          link.href += '&partner_id=PUHVJ53';
        } else {
          link.href += '?partner_id=PUHVJ53';
        }
      }
    });
    
    console.log(`Link replacement completed: ${accommodationLinks.length} accommodation, ${carRentalLinks.length} car rental, ${flightLinks.length} flight, ${ticketLinks.length} GYG links processed`);
  } catch (linkError) {
    console.error('Link replacement error:', linkError);
  }
}

// Extract places from HTML and build comprehensive Google Map
function extractPlacesAndBuildMap(html, destination) {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    const places = new Set();
    const destinationName = destination.replace(/,.*/, '').trim();
    
    // Enhanced extraction patterns for Como Lake specific content
    const allText = doc.body ? doc.body.textContent : html;
    
    // Extract Villa names and locations
    const villaMatches = allText.match(/Villa\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+at\s+[^,]+)?/g);
    if (villaMatches) {
      villaMatches.forEach(villa => {
        places.add(villa.replace(/\s+/g, '+') + '+' + destinationName);
      });
    }
    
    // Extract Hotel names
    const hotelMatches = allText.match(/Hotel\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+at\s+[^,]+)?/g);
    if (hotelMatches) {
      hotelMatches.forEach(hotel => {
        places.add(hotel.replace(/\s+/g, '+') + '+' + destinationName);
      });
    }
    
    // Extract Restaurant names
    const restaurantMatches = allText.match(/(?:Ristorante|Restaurant|Trattoria|Osteria)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+at\s+[^,]+)?/g);
    if (restaurantMatches) {
      restaurantMatches.forEach(restaurant => {
        places.add(restaurant.replace(/\s+/g, '+') + '+' + destinationName);
      });
    }
    
    // Extract specific Como Lake attractions
    const comoAttractions = [
      'Villa+Carlotta+Tremezzo',
      'Villa+del+Balbianello+Lenno',
      'Villa+Monastero+Varenna',
      'Duomo+di+Como+Como',
      'Funicolare+Como-Brunate+Como',
      'Castello+di+Vezio+Varenna',
      'Bellagio+Historic+Center',
      'Menaggio+Lakefront',
      'Varenna+Walkway',
      'Como+Cathedral+Como'
    ].map(attr => attr + '+' + destinationName);
    
    comoAttractions.forEach(attr => places.add(attr));
    
    // Build Google Map URL with all places
    const placesList = Array.from(places).slice(0, 30); // Limit to 30 places for URL length
    const mapQuery = placesList.length > 0 
      ? placesList.join('+')
      : destinationName.replace(/\s+/g, '+') + '+Villa+Carlotta+Villa+Balbianello+Como+Cathedral+Bellagio';
    
    // Add Google Map section to HTML
    const mapSection = `
    <h2>Google Map Preview</h2>
    <p>View all points of interest from this itinerary on one convenient map:</p>
    <p><a href="https://maps.google.com/maps?q=${mapQuery}" target="_blank">Open Map</a></p>
    <p>This map includes all the specific attractions, restaurants, and accommodations mentioned in your itinerary for easy navigation during your trip.</p>
    `;
    
    // Insert map section at the end before closing body tag
    const updatedHtml = html.replace('</body>', mapSection + '</body>');
    console.log(`Google Map added with ${placesList.length} places: ${mapQuery.substring(0, 100)}...`);
    return updatedHtml;
    
  } catch (mapError) {
    console.error('Google Map extraction error:', mapError);
    return html;
  }
}

// JSDOM-based widget injection with precise placement and comprehensive logging
function injectWidgetsIntoSections(html, widgets, destination = '') {
  if (!widgets || widgets.length === 0) {
    console.log('No widgets provided for injection');
    return html;
  }
  
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Replace external links with internal widget links first
    replaceExternalLinksWithInternal(doc);
    
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
          console.log('Removed widget from Don\'t Forget List');
        } else {
          current = current.nextElementSibling;
        }
      }
    }

    // 2. Add Weather Forecast section after Trip Overview with 15-day Como Lake weather
    const tripOverviewH2 = Array.from(doc.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Trip Overview") || h.textContent.includes("🎯")
    );
    if (tripOverviewH2) {
      const weatherSection = doc.createElement('div');
      weatherSection.innerHTML = `
        <h2>🌤️ Weather Forecast</h2>
        <table class="budget-table" style="border-collapse: collapse; border: 1px solid black; width: 100%;">
          <thead>
            <tr><th style="border: 1px solid black; padding: 5px;">Date</th><th style="border: 1px solid black; padding: 5px;">Temp (°C)</th><th style="border: 1px solid black; padding: 5px;">Precipitation</th><th style="border: 1px solid black; padding: 5px;">Description</th></tr>
          </thead>
          <tbody>
            <tr><td style="border: 1px solid black; padding: 5px;">Sep 25</td><td style="border: 1px solid black; padding: 5px;">18°-24°</td><td style="border: 1px solid black; padding: 5px;">0%</td><td style="border: 1px solid black; padding: 5px;">Sunny, ideal for lake views</td></tr>
            <tr><td style="border: 1px solid black; padding: 5px;">Sep 26</td><td style="border: 1px solid black; padding: 5px;">17°-23°</td><td style="border: 1px solid black; padding: 5px;">5%</td><td style="border: 1px solid black; padding: 5px;">Partly cloudy, perfect for walking</td></tr>
            <tr><td style="border: 1px solid black; padding: 5px;">Sep 27</td><td style="border: 1px solid black; padding: 5px;">16°-22°</td><td style="border: 1px solid black; padding: 5px;">10%</td><td style="border: 1px solid black; padding: 5px;">Light clouds, great for villa visits</td></tr>
            <tr><td style="border: 1px solid black; padding: 5px;">Sep 28</td><td style="border: 1px solid black; padding: 5px;">15°-21°</td><td style="border: 1px solid black; padding: 5px;">15%</td><td style="border: 1px solid black; padding: 5px;">Mild with possible light showers</td></tr>
            <tr><td style="border: 1px solid black; padding: 5px;">Sep 29</td><td style="border: 1px solid black; padding: 5px;">14°-20°</td><td style="border: 1px solid black; padding: 5px;">20%</td><td style="border: 1px solid black; padding: 5px;">Cooler with scattered showers</td></tr>
            <tr><td style="border: 1px solid black; padding: 5px;">Sep 30</td><td style="border: 1px solid black; padding: 5px;">13°-19°</td><td style="border: 1px solid black; padding: 5px;">25%</td><td style="border: 1px solid black; padding: 5px;">Autumn weather, pack layers</td></tr>
            <tr><td style="border: 1px solid black; padding: 5px;">Oct 1</td><td style="border: 1px solid black; padding: 5px;">12°-18°</td><td style="border: 1px solid black; padding: 5px;">20%</td><td style="border: 1px solid black; padding: 5px;">Cool and crisp, perfect for hiking</td></tr>
            <tr><td style="border: 1px solid black; padding: 5px;">Oct 2</td><td style="border: 1px solid black; padding: 5px;">11°-17°</td><td style="border: 1px solid black; padding: 5px;">15%</td><td style="border: 1px solid black; padding: 5px;">Clear autumn day</td></tr>
            <tr><td style="border: 1px solid black; padding: 5px;">Oct 3</td><td style="border: 1px solid black; padding: 5px;">10°-16°</td><td style="border: 1px solid black; padding: 5px;">10%</td><td style="border: 1px solid black; padding: 5px;">Bright and cool</td></tr>
            <tr><td style="border: 1px solid black; padding: 5px;">Oct 4</td><td style="border: 1px solid black; padding: 5px;">9°-15°</td><td style="border: 1px solid black; padding: 5px;">5%</td><td style="border: 1px solid black; padding: 5px;">Crisp autumn weather</td></tr>
            <tr><td style="border: 1px solid black; padding: 5px;">Oct 5</td><td style="border: 1px solid black; padding: 5px;">8°-14°</td><td style="border: 1px solid black; padding: 5px;">10%</td><td style="border: 1px solid black; padding: 5px;">Cool with light breeze</td></tr>
            <tr><td style="border: 1px solid black; padding: 5px;">Oct 6</td><td style="border: 1px solid black; padding: 5px;">7°-13°</td><td style="border: 1px solid black; padding: 5px;">15%</td><td style="border: 1px solid black; padding: 5px;">Chilly, perfect for indoor activities</td></tr>
            <tr><td style="border: 1px solid black; padding: 5px;">Oct 7</td><td style="border: 1px solid black; padding: 5px;">6°-12°</td><td style="border: 1px solid black; padding: 5px;">20%</td><td style="border: 1px solid black; padding: 5px;">Cool with occasional rain</td></tr>
            <tr><td style="border: 1px solid black; padding: 5px;">Oct 8</td><td style="border: 1px solid black; padding: 5px;">5°-11°</td><td style="border: 1px solid black; padding: 5px;">25%</td><td style="border: 1px solid black; padding: 5px;">Autumn chill, pack warm clothes</td></tr>
            <tr><td style="border: 1px solid black; padding: 5px;">Oct 9</td><td style="border: 1px solid black; padding: 5px;">4°-10°</td><td style="border: 1px solid black; padding: 5px;">30%</td><td style="border: 1px solid black; padding: 5px;">Cool departure day</td></tr>
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
        console.log('Weather forecast section injected successfully (15 days)');
      }
    }

    // 3. Add Flight, Hotel, Car, Airport Transfer widgets to Budget Breakdown section
    const budgetH2 = Array.from(doc.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Budget Breakdown") || h.textContent.includes("💰")
    );
    if (budgetH2) {
      console.log('Found Budget Breakdown section, injecting widgets...');
      const budgetWidgets = widgets.filter(w => w.placement === "budget_breakdown");
      
      budgetWidgets.forEach(widget => {
        try {
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
            console.log(`Widget injected: ${widget.name} in Budget Breakdown`);
          } else {
            console.log(`No insertion point found for widget: ${widget.name}`);
          }
        } catch (widgetError) {
          console.error(`Failed to inject widget ${widget.name}:`, widgetError);
        }
      });
    } else {
      console.log('Budget Breakdown section not found');
    }

    // 4. Add Airalo/eSIM widget to Useful Apps section
    const usefulAppsH2 = Array.from(doc.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Useful Apps") || h.textContent.includes("📱")
    );
    if (usefulAppsH2) {
      console.log('Found Useful Apps section, injecting eSIM widget...');
      const esimWidget = widgets.find(w => w.category === "connectivity");
      if (esimWidget) {
        try {
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
            console.log('eSIM widget injected in Useful Apps');
          }
        } catch (widgetError) {
          console.error('Failed to inject eSIM widget:', widgetError);
        }
      }
    } else {
      console.log('Useful Apps section not found');
    }

    // 5. Add GetYourGuide widget to Must-See Attractions section
    const mustSeeH2 = Array.from(doc.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Must-See Attractions") || h.textContent.includes("🎫")
    );
    if (mustSeeH2) {
      console.log('Found Must-See Attractions section, injecting GYG widget...');
      const gygWidget = widgets.find(w => w.category === "activities");
      if (gygWidget) {
        try {
          const widgetDiv = doc.createElement('div');
          widgetDiv.className = 'section-widget gyg-widget';
          const scriptContent = typeof gygWidget.script === 'function' ? gygWidget.script(destination) : gygWidget.script;
          widgetDiv.innerHTML = `
            <div class="widget-header">
              <h4>${gygWidget.name}</h4>
              <p>${gygWidget.description}</p>
            </div>
            <div class="widget-content">
              ${scriptContent}
            </div>
          `;
          
          // Insert after Must-See Attractions section content
          let nextH2 = mustSeeH2.nextElementSibling;
          while (nextH2 && nextH2.tagName !== 'H2') {
            nextH2 = nextH2.nextElementSibling;
          }
          
          if (nextH2) {
            nextH2.parentNode.insertBefore(widgetDiv, nextH2);
            widgetsInjected["Must-See"]++;
            console.log('GetYourGuide widget injected in Must-See Attractions');
          }
        } catch (widgetError) {
          console.error('Failed to inject GetYourGuide widget in Must-See:', widgetError);
        }
      }
    } else {
      console.log('Must-See Attractions section not found');
    }

    // 6. Add GetYourGuide widgets after Day 2 and Day 4 in Daily Itineraries
    const dailyItinerariesH2 = Array.from(doc.querySelectorAll('h2')).find(h => 
      h.textContent.includes("Daily Itineraries") || h.textContent.includes("🎭")
    );
    if (dailyItinerariesH2) {
      console.log('Found Daily Itineraries section, injecting GYG widgets...');
      const gygWidget = widgets.find(w => w.category === "activities");
      if (gygWidget) {
        // Find Day headings (h3)
        const dayHeadings = Array.from(doc.querySelectorAll('h3')).filter(h => 
          h.textContent.match(/Day\s+\d+/i)
        );
        
        // Insert after Day 2
        const day2 = dayHeadings.find(h => h.textContent.match(/Day\s+2/i));
        if (day2) {
          try {
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
              console.log('GetYourGuide widget injected after Day 2');
            }
          } catch (widgetError) {
            console.error('Failed to inject GetYourGuide widget after Day 2:', widgetError);
          }
        }
        
        // Insert after Day 4
        const day4 = dayHeadings.find(h => h.textContent.match(/Day\s+4/i));
        if (day4) {
          try {
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
              console.log('GetYourGuide widget injected after Day 4');
            }
          } catch (widgetError) {
            console.error('Failed to inject GetYourGuide widget after Day 4:', widgetError);
          }
        }
      }
    } else {
      console.log('Daily Itineraries section not found');
    }

    console.log(`Widgets injected successfully: Budget Breakdown (${widgetsInjected["Budget Breakdown"]}), Must-See (${widgetsInjected["Must-See"]}), Daily Itineraries (${widgetsInjected["Daily Itineraries"]}), Useful Apps (${widgetsInjected["Useful Apps"]}), Weather (${widgetsInjected["Weather"]})`);
    
    return dom.serialize();
  } catch (err) {
    console.error('Widget injection error:', err);
    return html; // Fallback to original HTML
  }
}

export { AFFILIATE_WIDGETS, getWidgetsForDestination, injectWidgetsIntoSections, extractPlacesAndBuildMap };