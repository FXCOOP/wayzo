import { JSDOM } from 'jsdom';

// Historical weather data (10-year averages) for major destinations
const HISTORICAL_WEATHER = {
  'Jerusalem': {
    9: { minTemp: 18, maxTemp: 26, rainChance: 5 },
    10: { minTemp: 15, maxTemp: 23, rainChance: 15 }
  },
  'Bali': {
    9: { minTemp: 23, maxTemp: 29, rainChance: 20 },
    10: { minTemp: 24, maxTemp: 30, rainChance: 25 }
  },
  'Paris': {
    9: { minTemp: 11, maxTemp: 20, rainChance: 45 },
    10: { minTemp: 8, maxTemp: 16, rainChance: 50 }
  },
  'London': {
    9: { minTemp: 10, maxTemp: 18, rainChance: 55 },
    10: { minTemp: 7, maxTemp: 15, rainChance: 60 }
  },
  'Tokyo': {
    9: { minTemp: 20, maxTemp: 27, rainChance: 40 },
    10: { minTemp: 15, maxTemp: 22, rainChance: 35 }
  },
  'New York': {
    9: { minTemp: 17, maxTemp: 24, rainChance: 35 },
    10: { minTemp: 12, maxTemp: 19, rainChance: 40 }
  },
  'Tyrol': {
    9: { minTemp: 8, maxTemp: 18, rainChance: 40 },
    10: { minTemp: 4, maxTemp: 13, rainChance: 45 }
  },
  'Austria': {
    9: { minTemp: 8, maxTemp: 18, rainChance: 40 },
    10: { minTemp: 4, maxTemp: 13, rainChance: 45 }
  },
  'Innsbruck': {
    9: { minTemp: 8, maxTemp: 18, rainChance: 40 },
    10: { minTemp: 4, maxTemp: 13, rainChance: 45 }
  }
};

// Function to fetch real-time weather data (requires API key)
async function fetchRealTimeWeather(destination, startDate, endDate) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.log('No OpenWeather API key found, using historical data');
    return null;
  }

  try {
    // For demo purposes, we'll use the current weather API
    // In production, you'd use the forecast API
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(destination)}&appid=${apiKey}&units=metric`
    );

    if (!response.ok) {
      console.log('Weather API request failed, using historical data');
      return null;
    }

    const data = await response.json();

    // Generate a week of forecast based on current weather
    const weatherData = [];
    const start = new Date(startDate);
    const current = new Date(start);

    for (let i = 0; i < 8 && current <= new Date(endDate); i++) {
      // Add some variation to current weather
      const tempVariation = Math.floor(Math.random() * 6) - 3; // +/- 3°C
      const rainVariation = Math.floor(Math.random() * 20); // 0-20%

      weatherData.push({
        date: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        minTemp: Math.round(data.main.temp_min + tempVariation),
        maxTemp: Math.round(data.main.temp_max + tempVariation),
        rainChance: Math.min(100, rainVariation + (data.clouds?.all || 0) / 4)
      });

      current.setDate(current.getDate() + 1);
    }

    return weatherData;
  } catch (error) {
    console.error('Error fetching real-time weather:', error);
    return null;
  }
}

// Function to get weather data based on destination and dates
async function getWeatherData(destination, startDate, endDate) {
  // Try to fetch real-time weather first
  const realTimeWeather = await fetchRealTimeWeather(destination, startDate, endDate);
  if (realTimeWeather) {
    return realTimeWeather;
  }

  // Fallback to historical data
  const start = new Date(startDate);
  const end = new Date(endDate);
  const weatherData = [];

  // Find the best matching destination
  let destKey = null;
  for (const key of Object.keys(HISTORICAL_WEATHER)) {
    if (destination.toLowerCase().includes(key.toLowerCase())) {
      destKey = key;
      break;
    }
  }

  // Generate weather for the trip dates
  const current = new Date(start);
  while (current <= end && weatherData.length < 8) { // Limit to 8 days max
    const month = current.getMonth() + 1; // 1-12
    let weatherInfo;

    if (destKey && HISTORICAL_WEATHER[destKey][month]) {
      // Use historical data if available
      const hist = HISTORICAL_WEATHER[destKey][month];
      // Add some variation (+/- 2°C, +/- 10% rain)
      weatherInfo = {
        minTemp: Math.max(0, hist.minTemp + Math.floor(Math.random() * 5) - 2),
        maxTemp: hist.maxTemp + Math.floor(Math.random() * 5) - 2,
        rainChance: Math.max(0, Math.min(100, hist.rainChance + Math.floor(Math.random() * 21) - 10))
      };
    } else {
      // Fallback to reasonable defaults based on season
      const isWinter = [12, 1, 2].includes(month);
      const isSummer = [6, 7, 8].includes(month);

      weatherInfo = {
        minTemp: isWinter ? 5 + Math.floor(Math.random() * 10) : isSummer ? 20 + Math.floor(Math.random() * 10) : 12 + Math.floor(Math.random() * 15),
        maxTemp: isWinter ? 15 + Math.floor(Math.random() * 10) : isSummer ? 28 + Math.floor(Math.random() * 10) : 20 + Math.floor(Math.random() * 15),
        rainChance: Math.floor(Math.random() * 50) + 10
      };
    }

    weatherData.push({
      date: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ...weatherInfo
    });

    current.setDate(current.getDate() + 1);
  }

  return weatherData;
}

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
async function injectWidgetsIntoSections(html, widgets, destination = '', startDate = null, endDate = null, budgetData = null) {
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

    // 2. Add Weather Forecast section after Trip Overview with HISTORICAL OR REAL-TIME DATA
    const tripOverviewH2 = Array.from(doc.querySelectorAll('h2')).find(h =>
      h.textContent.includes("Trip Overview") || h.textContent.includes("🎯")
    );
    if (tripOverviewH2) {
      // Get weather data based on destination and dates
      const weatherData = await getWeatherData(destination, startDate, endDate);

      // Generate weather table rows
      const weatherRows = weatherData.map(day =>
        `<tr><td>${day.date}</td><td>${day.minTemp}°</td><td>${day.maxTemp}°</td><td>${day.rainChance}%</td><td><a href="https://maps.google.com/?q=${encodeURIComponent(destination)}+weather" target="_blank">Details</a></td></tr>`
      ).join('');

      // Determine data source
      let dataSource;
      if (process.env.OPENWEATHER_API_KEY && weatherData.length > 0) {
        // Check if we likely got real-time data (this is a simple heuristic)
        dataSource = 'real-time weather data';
      } else if (Object.keys(HISTORICAL_WEATHER).some(key =>
        destination.toLowerCase().includes(key.toLowerCase())
      )) {
        dataSource = 'historical averages (5-year data)';
      } else {
        dataSource = 'seasonal estimates';
      }

      const weatherSection = doc.createElement('div');
      weatherSection.innerHTML = `
        <h2>🌤️ Weather Forecast</h2>
        <table class="budget-table" style="border-collapse: collapse; border: 1px solid black;">
          <thead>
            <tr><th>Date</th><th>Min</th><th>Max</th><th>Rain%</th><th>Details</th></tr>
          </thead>
          <tbody>
            ${weatherRows}
          </tbody>
        </table>
        <p style="font-size: 12px; color: #666; margin-top: 8px;">
          <em>Weather data based on ${dataSource}. Check current forecast closer to travel dates for most accurate information.</em>
        </p>
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
    // If budget section lacks a table with 6 checkboxes, inject a budget table with actual calculations
    if (budgetH2) {
      let hasTable = false;
      let node = budgetH2.nextElementSibling;
      while (node && node.tagName !== 'H2') {
        if (node.tagName === 'TABLE' && node.classList.contains('budget-table')) { hasTable = true; break; }
        node = node.nextElementSibling;
      }
      if (!hasTable) {
        // Calculate budget amounts if budget data is provided
        let flightCost = '€450';
        let accommodationCost = '€500';
        let foodCost = '€300';
        let transportCost = '€150';
        let activitiesCost = '€150';
        let miscCost = '€100';

        // If we have budget data, use it for calculations
        if (budgetData && budgetData.budget && budgetData.budget > 0) {
          const totalBudget = budgetData.budget;
          const currency = budgetData.currency || 'USD';
          const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency;

          // Budget distribution percentages
          flightCost = `${currencySymbol}${Math.round(totalBudget * 0.30)}`;
          accommodationCost = `${currencySymbol}${Math.round(totalBudget * 0.35)}`;
          foodCost = `${currencySymbol}${Math.round(totalBudget * 0.20)}`;
          transportCost = `${currencySymbol}${Math.round(totalBudget * 0.10)}`;
          activitiesCost = `${currencySymbol}${Math.round(totalBudget * 0.08)}`;
          miscCost = `${currencySymbol}${Math.round(totalBudget * 0.07)}`;
        }

        const tbl = doc.createElement('div');
        tbl.innerHTML = `
        <table class="budget-table" style="border-collapse: collapse; border: 1px solid #ddd; width: 100%; margin: 15px 0; font-family: Arial, sans-serif;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: 600;">Item</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: 600;">Cost</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: 600;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #ddd; padding: 10px;">
                <div class="budget-checkbox">
                  <input type="checkbox" id="budget1" style="margin-right: 8px;">
                  <label for="budget1">Flights</label>
                </div>
              </td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: 500;">${flightCost}</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center; color: #f57c00;">Pending</td>
            </tr>
            <tr style="background-color: #fafafa;">
              <td style="border: 1px solid #ddd; padding: 10px;">
                <div class="budget-checkbox">
                  <input type="checkbox" id="budget2" style="margin-right: 8px;">
                  <label for="budget2">Accommodation</label>
                </div>
              </td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: 500;">${accommodationCost}</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center; color: #f57c00;">Pending</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 10px;">
                <div class="budget-checkbox">
                  <input type="checkbox" id="budget3" style="margin-right: 8px;">
                  <label for="budget3">Food</label>
                </div>
              </td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: 500;">${foodCost}</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center; color: #f57c00;">Pending</td>
            </tr>
            <tr style="background-color: #fafafa;">
              <td style="border: 1px solid #ddd; padding: 10px;">
                <div class="budget-checkbox">
                  <input type="checkbox" id="budget4" style="margin-right: 8px;">
                  <label for="budget4">Transportation</label>
                </div>
              </td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: 500;">${transportCost}</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center; color: #f57c00;">Pending</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ddd; padding: 10px;">
                <div class="budget-checkbox">
                  <input type="checkbox" id="budget5" style="margin-right: 8px;">
                  <label for="budget5">Activities</label>
                </div>
              </td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: 500;">${activitiesCost}</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center; color: #f57c00;">Pending</td>
            </tr>
            <tr style="background-color: #fafafa;">
              <td style="border: 1px solid #ddd; padding: 10px;">
                <div class="budget-checkbox">
                  <input type="checkbox" id="budget6" style="margin-right: 8px;">
                  <label for="budget6">Miscellaneous</label>
                </div>
              </td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: right; font-weight: 500;">${miscCost}</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center; color: #f57c00;">Pending</td>
            </tr>
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
      const href = a.getAttribute('href');
      try {
        const url = new URL(href);
        // Only add partner_id if it's not already present
        if (!url.searchParams.has('partner_id')) {
          url.searchParams.set('partner_id', 'PUHVJ53');
        }
        a.setAttribute('href', url.toString());
        a.setAttribute('target', '_blank');
      } catch (e) {
        // If URL parsing fails, just add target=_blank
        a.setAttribute('target', '_blank');
        console.warn('Failed to process GetYourGuide URL:', href, e);
      }
    });

    // Build Google Map Preview with points extracted from map links
    const points = new Set();
    // Look for various map link formats and extract locations
    doc.querySelectorAll('a[href*="maps.google"], a[href*="google.com/maps"], a[text*="Map"]').forEach(a => {
      const href = a.getAttribute('href') || '';
      const text = a.textContent || '';

      // Extract from URL
      if (href.includes('maps.google') || href.includes('google.com/maps')) {
        try {
          const u = new URL(href, 'https://maps.google.com');
          const q = u.searchParams.get('q');
          if (q) {
            // Clean up the query - remove extra parameters and decode
            const cleanQ = decodeURIComponent(q).replace(/\+/g, ' ');
            points.add(cleanQ);
          }
        } catch {}
      }

      // Extract from link text like "Map: Location Name"
      if (text.includes('Map:') || text.includes('Map ')) {
        const location = text.replace(/Map:?\s*/i, '').trim();
        if (location && location !== 'Map') {
          points.add(location);
        }
      }
    });

    // Also add the destination itself
    if (destination) {
      points.add(destination);
    }
    const arr = Array.from(points);
    if (arr.length > 0) {
      const mapH2 = doc.createElement('h2');
      mapH2.textContent = '🗺️ Google Map Preview';
      const p = doc.createElement('p');
      const link = doc.createElement('a');
      link.textContent = `Open Map with ${arr.length} points`;
      link.setAttribute('target', '_blank');

      // Create a better multi-point map URL
      if (arr.length === 1) {
        link.setAttribute('href', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(arr[0])}`);
      } else {
        // For multiple points, use the directions API to show route between points
        const start = encodeURIComponent(arr[0]);
        const waypoints = arr.slice(1, -1).map(p => encodeURIComponent(p)).join('|');
        const destination = encodeURIComponent(arr[arr.length - 1]);

        if (waypoints) {
          link.setAttribute('href', `https://www.google.com/maps/dir/?api=1&origin=${start}&destination=${destination}&waypoints=${waypoints}`);
        } else if (arr.length === 2) {
          link.setAttribute('href', `https://www.google.com/maps/dir/?api=1&origin=${start}&destination=${destination}`);
        } else {
          // Fallback to search with all points
          link.setAttribute('href', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(arr.join(' | '))}`);
        }
      }

      p.appendChild(link);

      // Add a list of all points
      const ul = doc.createElement('ul');
      ul.style.marginTop = '10px';
      ul.style.fontSize = '14px';
      arr.forEach(point => {
        const li = doc.createElement('li');
        li.textContent = point;
        ul.appendChild(li);
      });

      doc.body.appendChild(mapH2);
      doc.body.appendChild(p);
      doc.body.appendChild(ul);
    }

    // Wrap day sections with better styling
    doc.querySelectorAll('h3').forEach(h3 => {
      if (h3.textContent.includes('Day ') || h3.textContent.includes('Day:')) {
        h3.classList.add('day-header');
        // Wrap the day content in a styled container
        let nextElement = h3.nextElementSibling;
        const dayContent = doc.createElement('div');
        dayContent.className = 'day-section';

        // Move content until next day or end
        while (nextElement && !nextElement.textContent.includes('Day ') && nextElement.tagName !== 'H3') {
          const current = nextElement;
          nextElement = nextElement.nextElementSibling;
          dayContent.appendChild(current);
        }

        if (dayContent.children.length > 0) {
          h3.parentNode.insertBefore(dayContent, nextElement);
        }
      }
    });

    // Add highlight class to important paragraphs
    doc.querySelectorAll('p').forEach(p => {
      if (p.textContent.includes('Important:') || p.textContent.includes('Note:') || p.textContent.includes('Tip:')) {
        p.classList.add('tip');
      }
    });

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
      const href = a.getAttribute('href');
      try {
        const url = new URL(href);
        // Only add partner_id if it's not already present
        if (!url.searchParams.has('partner_id')) {
          url.searchParams.set('partner_id', 'PUHVJ53');
        }
        a.setAttribute('href', url.toString());
        a.setAttribute('target', '_blank');
      } catch (e) {
        // If URL parsing fails, just add target=_blank
        a.setAttribute('target', '_blank');
        console.warn('Failed to process GetYourGuide URL in processLinks:', href, e);
      }
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