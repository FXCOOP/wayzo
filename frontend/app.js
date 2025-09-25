// app.js — Enhanced Wayzo trip planner with professional brief support

(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Form elements
  const form = $('#tripForm');
  const previewEl = $('#preview');
  const loadingEl = $('#loading');
  const pdfBtn = $('#pdfBtn');
  const icsBtn = $('#icsBtn');
  const fullPlanBtn = $('#fullPlanBtn');
  const saveBtn = $('#saveBtn');
  const loginBtn = $('#loginBtn');

  if (!form || !previewEl) return; // nothing to wire up

  // Check if we're on staging environment - but don't auto-login, let user sign up
  const isStaging = window.location.hostname.includes('staging') || window.location.hostname.includes('onrender.com');
  if (isStaging) {
    console.log('🚀 Staging environment detected - user needs to sign up manually');
  }

  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');

  // No-op safe helpers (overridden if SDKs loaded)
  const trackEvent = (event, data = {}) => {
    try {
      fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, ...data, timestamp: new Date().toISOString() }) }).catch(() => {});
    } catch (_) {}
  };
  const initializeGoogleAuth = () => {};
  const ensureLoginVisible = () => { if (loginBtn) loginBtn.classList.add('btn-primary'); };
  const showUserMenu = () => {};
  const detectUserLocation = async () => {
    const fromField = $('#from');
    if (!fromField) return;

    // Show detection in progress
    fromField.placeholder = 'Detecting your location...';

    try {
      console.log('Starting location detection with ipapi.co...');

      // Try ipapi.co first
      let response = await fetch('https://ipapi.co/json/', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      let data = await response.json();
      console.log('Location data from ipapi.co:', data);

      // Check for valid response
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.city && data.country_name) {
        const location = `${data.city}, ${data.country_name}`;
        fromField.value = location;
        fromField.placeholder = location;
        console.log('✅ Location detected successfully:', location);
        return;
      } else if (data.country_name) {
        fromField.value = data.country_name;
        fromField.placeholder = data.country_name;
        console.log('✅ Country detected:', data.country_name);
        return;
      }

      throw new Error('Incomplete location data');

    } catch (error) {
      console.log('First service failed, trying backup:', error.message);

      // Fallback to ipify + ip-api.com
      try {
        console.log('Trying backup location detection...');

        // Get IP first
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        console.log('IP detected:', ipData.ip);

        // Get location from IP
        const locationResponse = await fetch(`http://ip-api.com/json/${ipData.ip}`);
        const locationData = await locationResponse.json();
        console.log('Backup location data:', locationData);

        if (locationData.status === 'success') {
          if (locationData.city && locationData.country) {
            const location = `${locationData.city}, ${locationData.country}`;
            fromField.value = location;
            fromField.placeholder = location;
            console.log('✅ Backup location detected:', location);
            return;
          } else if (locationData.country) {
            fromField.value = locationData.country;
            fromField.placeholder = locationData.country;
            console.log('✅ Backup country detected:', locationData.country);
            return;
          }
        }

        throw new Error('Backup service also failed');

      } catch (backupError) {
        console.error('❌ All location detection services failed:', backupError);
        fromField.placeholder = 'Enter your departure city...';
        fromField.value = '';

        // Show a subtle notification to user
        setTimeout(() => {
          console.log('Location detection not available, please enter manually');
        }, 1000);
      }
    }
  };
  
  // Cookie Consent Management
  const initializeCookieConsent = () => {
    const cookieBanner = document.getElementById('cookieBanner');
    const acceptBtn = document.getElementById('acceptCookies');
    const rejectBtn = document.getElementById('rejectCookies');
    
    if (!cookieBanner || !acceptBtn || !rejectBtn) return;
    
    // Check if user has already made a choice
    const cookieChoice = localStorage.getItem('wayzo_cookie_choice');
    if (cookieChoice) {
      cookieBanner.style.display = 'none';
      return;
    }
    
    // Show banner if no choice made
    cookieBanner.style.display = 'flex';
    
    // Accept all cookies
    acceptBtn.addEventListener('click', () => {
      localStorage.setItem('wayzo_cookie_choice', 'accepted');
      localStorage.setItem('wayzo_cookies_analytics', 'true');
      localStorage.setItem('wayzo_cookies_marketing', 'true');
      localStorage.setItem('wayzo_cookies_essential', 'true');
      cookieBanner.style.display = 'none';
      
      // Enable analytics and marketing cookies
      enableAnalyticsCookies();
      showNotification('All cookies accepted. Thank you for helping us improve!', 'success');
    });
    
    // Reject non-essential cookies
    rejectBtn.addEventListener('click', () => {
      localStorage.setItem('wayzo_cookie_choice', 'rejected');
      localStorage.setItem('wayzo_cookies_analytics', 'false');
      localStorage.setItem('wayzo_cookies_marketing', 'false');
      localStorage.setItem('wayzo_cookies_essential', 'true');
      cookieBanner.style.display = 'none';
      
      // Only enable essential cookies
      showNotification('Only essential cookies enabled. Some features may be limited.', 'info');
    });
  };
  
  // Enable analytics cookies
  const enableAnalyticsCookies = () => {
    // Initialize Google Analytics if available
    if (window.gtag) {
      window.gtag('consent', 'update', {
        'analytics_storage': 'granted',
        'ad_storage': 'granted'
      });
    }
    
    // Enable other tracking
    console.log('Analytics cookies enabled');
  };

  // Enhanced form reading with professional brief
  const readForm = () => {
    const data = Object.fromEntries(new FormData(form).entries());
    
    // Parse numbers
    data.adults = Number(data.adults || 2);
    data.children = Number(data.children || 0);
    data.budget = Number(data.budget || 0);
    data.duration = Number(data.duration || 5);
    data.currency = data.currency || 'USD';
    
    // Add autocomplete functionality for destination fields
    initializeAutocomplete();
    
    if (data.dateMode === 'flexible') {
      data.flexibleDates = { month: data.travelMonth, duration: data.duration };
      delete data.start; delete data.end;
    }
    
    if (data.children > 0) {
      data.childrenAges = [];
      $$('.age-input input').forEach(input => { if (input.value) data.childrenAges.push(Number(input.value)); });
    }
    
    if (data.dietary) {
      data.dietary = Array.isArray(data.dietary) ? data.dietary : [data.dietary];
      data.dietary = data.dietary.filter(d => d !== 'none');
    }
    
    const fileInput = $('#planFiles');
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
      data.uploadedFiles = Array.from(fileInput.files).map(file => ({ name: file.name, size: file.size, type: file.type }));
    }
    
    if (data.brief) {
      data.brief = data.brief.trim();
      if (data.brief) data.professional_brief = data.brief;
    }
    
    // Handle referral code
    if (data.referralCode) {
      data.referralCode = data.referralCode.trim().toUpperCase();
      // Track referral usage
      trackEvent('referral_used', { code: data.referralCode });
    }
    
    return data;
  };

  // Autocomplete functionality for cities
  const initializeAutocomplete = () => {
    const destinationInput = document.getElementById('dest');
    const fromInput = document.getElementById('from');
    
    if (destinationInput) {
      destinationInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length > 2) {
          showCitySuggestions(destinationInput, query);
        } else {
          hideCitySuggestions(destinationInput);
        }
      });
    }
    
    if (fromInput) {
      fromInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length > 2) {
          showCitySuggestions(fromInput, query);
        } else {
          hideCitySuggestions(fromInput);
        }
      });
    }
  };

  // Comprehensive cities database for autocomplete - 500+ destinations worldwide
  const popularCities = [
    // Europe - Major Cities
    'Paris, France', 'London, UK', 'Rome, Italy', 'Barcelona, Spain', 'Amsterdam, Netherlands',
    'Berlin, Germany', 'Prague, Czech Republic', 'Vienna, Austria', 'Budapest, Hungary',
    'Madrid, Spain', 'Milan, Italy', 'Florence, Italy', 'Venice, Italy', 'Naples, Italy',
    'Stockholm, Sweden', 'Copenhagen, Denmark', 'Oslo, Norway', 'Helsinki, Finland',
    'Reykjavik, Iceland', 'Dublin, Ireland', 'Edinburgh, UK', 'Glasgow, UK',
    'Manchester, UK', 'Liverpool, UK', 'Birmingham, UK', 'Bristol, UK', 'York, UK',
    'Bath, UK', 'Cambridge, UK', 'Oxford, UK', 'Brighton, UK', 'Canterbury, UK',

    // Europe - Spain & Portugal
    'Seville, Spain', 'Valencia, Spain', 'Granada, Spain', 'Bilbao, Spain', 'Toledo, Spain',
    'San Sebastian, Spain', 'Cordoba, Spain', 'Malaga, Spain', 'Palma, Spain', 'Zaragoza, Spain',
    'Lisbon, Portugal', 'Porto, Portugal', 'Sintra, Portugal', 'Braga, Portugal', 'Coimbra, Portugal',

    // Europe - France
    'Lyon, France', 'Marseille, France', 'Nice, France', 'Cannes, France', 'Monaco',
    'Bordeaux, France', 'Toulouse, France', 'Strasbourg, France', 'Lille, France', 'Nantes, France',

    // Europe - Germany & Austria
    'Munich, Germany', 'Hamburg, Germany', 'Frankfurt, Germany', 'Cologne, Germany', 'Dresden, Germany',
    'Salzburg, Austria', 'Innsbruck, Austria', 'Graz, Austria', 'Hallstatt, Austria', 'Tyrol, Austria',

    // Europe - Italy
    'Turin, Italy', 'Bologna, Italy', 'Genoa, Italy', 'Palermo, Italy', 'Verona, Italy',
    'Pisa, Italy', 'Siena, Italy', 'Lucca, Italy', 'Positano, Italy', 'Amalfi, Italy',
    'Tuscany, Italy', 'Cinque Terre, Italy', 'Lake Como, Italy', 'Sicily, Italy',

    // Europe - Eastern Europe
    'Krakow, Poland', 'Warsaw, Poland', 'Gdansk, Poland', 'Wroclaw, Poland',
    'Bucharest, Romania', 'Cluj-Napoca, Romania', 'Brasov, Romania',
    'Sofia, Bulgaria', 'Plovdiv, Bulgaria', 'Varna, Bulgaria',
    'Zagreb, Croatia', 'Split, Croatia', 'Dubrovnik, Croatia', 'Plitvice, Croatia',
    'Ljubljana, Slovenia', 'Bled, Slovenia', 'Bratislava, Slovakia',

    // Europe - Greece
    'Athens, Greece', 'Thessaloniki, Greece', 'Santorini, Greece', 'Mykonos, Greece',
    'Rhodes, Greece', 'Crete, Greece', 'Corfu, Greece', 'Zakynthos, Greece',

    // Europe - Scandinavia
    'Gothenburg, Sweden', 'Malmo, Sweden', 'Uppsala, Sweden',
    'Bergen, Norway', 'Trondheim, Norway', 'Tromso, Norway',
    'Aarhus, Denmark', 'Odense, Denmark',
    'Turku, Finland', 'Tampere, Finland', 'Rovaniemi, Finland',

    // Europe - Netherlands & Belgium
    'Rotterdam, Netherlands', 'The Hague, Netherlands', 'Utrecht, Netherlands',
    'Brussels, Belgium', 'Antwerp, Belgium', 'Bruges, Belgium', 'Ghent, Belgium',

    // Europe - Switzerland
    'Zurich, Switzerland', 'Geneva, Switzerland', 'Bern, Switzerland', 'Basel, Switzerland',
    'Lucerne, Switzerland', 'Interlaken, Switzerland', 'Zermatt, Switzerland',

    // Middle East & Turkey
    'Istanbul, Turkey', 'Ankara, Turkey', 'Cappadocia, Turkey', 'Antalya, Turkey', 'Bodrum, Turkey',
    'Izmir, Turkey', 'Pamukkale, Turkey', 'Ephesus, Turkey',
    'Dubai, UAE', 'Abu Dhabi, UAE', 'Sharjah, UAE', 'Ras Al Khaimah, UAE',
    'Doha, Qatar', 'Kuwait City, Kuwait', 'Manama, Bahrain', 'Muscat, Oman',
    'Tel Aviv, Israel', 'Jerusalem, Israel', 'Haifa, Israel', 'Eilat, Israel',
    'Amman, Jordan', 'Petra, Jordan', 'Aqaba, Jordan', 'Wadi Rum, Jordan',
    'Beirut, Lebanon', 'Tripoli, Lebanon', 'Baalbek, Lebanon',

    // Africa
    'Cairo, Egypt', 'Alexandria, Egypt', 'Luxor, Egypt', 'Aswan, Egypt', 'Hurghada, Egypt',
    'Marrakech, Morocco', 'Fez, Morocco', 'Casablanca, Morocco', 'Tangier, Morocco', 'Rabat, Morocco',
    'Cape Town, South Africa', 'Johannesburg, South Africa', 'Durban, South Africa', 'Pretoria, South Africa',
    'Nairobi, Kenya', 'Mombasa, Kenya', 'Nakuru, Kenya', 'Kisumu, Kenya',
    'Dar es Salaam, Tanzania', 'Arusha, Tanzania', 'Zanzibar, Tanzania', 'Mwanza, Tanzania',
    'Kigali, Rwanda', 'Butare, Rwanda', 'Addis Ababa, Ethiopia', 'Lalibela, Ethiopia',
    'Tunis, Tunisia', 'Sousse, Tunisia', 'Sfax, Tunisia', 'Algiers, Algeria',

    // Asia - India
    'Mumbai, India', 'Delhi, India', 'Bangalore, India', 'Chennai, India', 'Kolkata, India',
    'Hyderabad, India', 'Pune, India', 'Ahmedabad, India', 'Jaipur, India', 'Goa, India',
    'Kerala, India', 'Agra, India', 'Udaipur, India', 'Jodhpur, India', 'Varanasi, India',
    'Rishikesh, India', 'Manali, India', 'Dharamshala, India', 'Shimla, India',

    // Asia - Southeast Asia
    'Bangkok, Thailand', 'Phuket, Thailand', 'Chiang Mai, Thailand', 'Krabi, Thailand',
    'Pattaya, Thailand', 'Koh Samui, Thailand', 'Ayutthaya, Thailand',
    'Singapore', 'Kuala Lumpur, Malaysia', 'Penang, Malaysia', 'Langkawi, Malaysia',
    'Malacca, Malaysia', 'Kota Kinabalu, Malaysia', 'Johor Bahru, Malaysia',
    'Jakarta, Indonesia', 'Bali, Indonesia', 'Yogyakarta, Indonesia', 'Surabaya, Indonesia',
    'Bandung, Indonesia', 'Medan, Indonesia', 'Lombok, Indonesia', 'Komodo, Indonesia',
    'Manila, Philippines', 'Cebu, Philippines', 'Boracay, Philippines', 'Palawan, Philippines',
    'Bohol, Philippines', 'Davao, Philippines', 'Iloilo, Philippines',
    'Ho Chi Minh City, Vietnam', 'Hanoi, Vietnam', 'Da Nang, Vietnam', 'Hoi An, Vietnam',
    'Nha Trang, Vietnam', 'Hue, Vietnam', 'Can Tho, Vietnam', 'Sapa, Vietnam',
    'Phnom Penh, Cambodia', 'Siem Reap, Cambodia', 'Battambang, Cambodia', 'Sihanoukville, Cambodia',
    'Vientiane, Laos', 'Luang Prabang, Laos', 'Vang Vieng, Laos', 'Pakse, Laos',
    'Yangon, Myanmar', 'Mandalay, Myanmar', 'Bagan, Myanmar', 'Inle Lake, Myanmar',

    // Asia - East Asia
    'Tokyo, Japan', 'Osaka, Japan', 'Kyoto, Japan', 'Yokohama, Japan', 'Nagoya, Japan',
    'Hiroshima, Japan', 'Nara, Japan', 'Nikko, Japan', 'Hakone, Japan', 'Takayama, Japan',
    'Beijing, China', 'Shanghai, China', 'Guangzhou, China', 'Shenzhen, China', 'Xi\'an, China',
    'Chengdu, China', 'Hangzhou, China', 'Suzhou, China', 'Nanjing, China', 'Qingdao, China',
    'Hong Kong', 'Macau', 'Taipei, Taiwan', 'Kaohsiung, Taiwan', 'Taichung, Taiwan',
    'Seoul, South Korea', 'Busan, South Korea', 'Jeju, South Korea', 'Daegu, South Korea',
    'Incheon, South Korea', 'Gyeongju, South Korea', 'Jeonju, South Korea',

    // Asia - Central & South Asia
    'Almaty, Kazakhstan', 'Nur-Sultan, Kazakhstan', 'Bishkek, Kyrgyzstan',
    'Tashkent, Uzbekistan', 'Samarkand, Uzbekistan', 'Bukhara, Uzbekistan',
    'Ashgabat, Turkmenistan', 'Dushanbe, Tajikistan',
    'Kathmandu, Nepal', 'Pokhara, Nepal', 'Thimphu, Bhutan', 'Paro, Bhutan',
    'Colombo, Sri Lanka', 'Kandy, Sri Lanka', 'Galle, Sri Lanka',

    // Oceania
    'Sydney, Australia', 'Melbourne, Australia', 'Brisbane, Australia', 'Perth, Australia',
    'Adelaide, Australia', 'Gold Coast, Australia', 'Cairns, Australia', 'Darwin, Australia',
    'Hobart, Australia', 'Canberra, Australia', 'Newcastle, Australia', 'Wollongong, Australia',
    'Auckland, New Zealand', 'Wellington, New Zealand', 'Queenstown, New Zealand',
    'Christchurch, New Zealand', 'Rotorua, New Zealand', 'Dunedin, New Zealand',
    'Suva, Fiji', 'Nadi, Fiji', 'Apia, Samoa', 'Nuku\'alofa, Tonga',

    // North America - USA
    'New York, USA', 'Los Angeles, USA', 'Chicago, USA', 'Houston, USA', 'Phoenix, USA',
    'Philadelphia, USA', 'San Antonio, USA', 'San Diego, USA', 'Dallas, USA', 'San Jose, USA',
    'Austin, USA', 'Jacksonville, USA', 'Fort Worth, USA', 'Columbus, USA', 'Charlotte, USA',
    'San Francisco, USA', 'Indianapolis, USA', 'Seattle, USA', 'Denver, USA', 'Washington DC, USA',
    'Boston, USA', 'El Paso, USA', 'Nashville, USA', 'Detroit, USA', 'Portland, USA',
    'Las Vegas, USA', 'Memphis, USA', 'Louisville, USA', 'Baltimore, USA', 'Milwaukee, USA',
    'Miami, USA', 'Orlando, USA', 'Tampa, USA', 'Atlanta, USA', 'New Orleans, USA',
    'Savannah, USA', 'Charleston, USA', 'Asheville, USA', 'Key West, USA',

    // North America - Canada
    'Toronto, Canada', 'Vancouver, Canada', 'Montreal, Canada', 'Calgary, Canada',
    'Ottawa, Canada', 'Edmonton, Canada', 'Mississauga, Canada', 'Winnipeg, Canada',
    'Quebec City, Canada', 'Hamilton, Canada', 'Brampton, Canada', 'Surrey, Canada',

    // North America - Mexico
    'Mexico City, Mexico', 'Guadalajara, Mexico', 'Monterrey, Mexico', 'Puebla, Mexico',
    'Tijuana, Mexico', 'Cancun, Mexico', 'Playa del Carmen, Mexico', 'Tulum, Mexico',
    'Puerto Vallarta, Mexico', 'Acapulco, Mexico', 'Mazatlan, Mexico', 'Mérida, Mexico',
    'Oaxaca, Mexico', 'San Miguel de Allende, Mexico', 'Guanajuato, Mexico',

    // Central America & Caribbean
    'Guatemala City, Guatemala', 'Antigua, Guatemala', 'San José, Costa Rica',
    'Panama City, Panama', 'Managua, Nicaragua', 'San Salvador, El Salvador',
    'Tegucigalpa, Honduras', 'Belize City, Belize',
    'Havana, Cuba', 'Santiago de Cuba, Cuba', 'Varadero, Cuba',
    'Kingston, Jamaica', 'Montego Bay, Jamaica', 'Negril, Jamaica',
    'Santo Domingo, Dominican Republic', 'Punta Cana, Dominican Republic',
    'San Juan, Puerto Rico', 'Bridgetown, Barbados', 'Nassau, Bahamas',

    // South America
    'São Paulo, Brazil', 'Rio de Janeiro, Brazil', 'Brasília, Brazil', 'Salvador, Brazil',
    'Fortaleza, Brazil', 'Belo Horizonte, Brazil', 'Manaus, Brazil', 'Curitiba, Brazil',
    'Recife, Brazil', 'Porto Alegre, Brazil', 'Belém, Brazil', 'Florianópolis, Brazil',
    'Buenos Aires, Argentina', 'Córdoba, Argentina', 'Rosario, Argentina', 'Mendoza, Argentina',
    'La Plata, Argentina', 'Mar del Plata, Argentina', 'Salta, Argentina', 'Bariloche, Argentina',
    'Lima, Peru', 'Arequipa, Peru', 'Trujillo, Peru', 'Chiclayo, Peru', 'Cusco, Peru',
    'Iquitos, Peru', 'Huancayo, Peru', 'Machu Picchu, Peru', 'Sacred Valley, Peru',
    'Santiago, Chile', 'Valparaíso, Chile', 'Concepción, Chile', 'La Serena, Chile',
    'Temuco, Chile', 'Antofagasta, Chile', 'Puerto Varas, Chile', 'Atacama Desert, Chile',
    'Bogotá, Colombia', 'Medellín, Colombia', 'Cali, Colombia', 'Barranquilla, Colombia',
    'Cartagena, Colombia', 'Bucaramanga, Colombia', 'Pereira, Colombia', 'Santa Marta, Colombia',
    'Quito, Ecuador', 'Guayaquil, Ecuador', 'Cuenca, Ecuador', 'Galápagos Islands, Ecuador',
    'Caracas, Venezuela', 'Maracaibo, Venezuela', 'Valencia, Venezuela', 'Barquisimeto, Venezuela',
    'La Paz, Bolivia', 'Santa Cruz, Bolivia', 'Cochabamba, Bolivia', 'Sucre, Bolivia',
    'Asunción, Paraguay', 'Ciudad del Este, Paraguay', 'Montevideo, Uruguay', 'Georgetown, Guyana',

    // Popular regions and special destinations
    'Provence, France', 'Andalusia, Spain', 'Scottish Highlands, UK', 'Patagonia, Argentina',
    'Amazon Rainforest, Brazil', 'Sahara Desert, Morocco', 'Great Barrier Reef, Australia',
    'Serengeti, Tanzania', 'Maldives', 'Seychelles', 'Mauritius', 'Madagascar'
  ];

  const showCitySuggestions = (input, query) => {
    // Remove existing suggestions
    hideCitySuggestions(input);
    
    // Filter cities based on query
    const suggestions = popularCities.filter(city => 
      city.toLowerCase().includes(query)
    ).slice(0, 8); // Limit to 8 suggestions
    
    if (suggestions.length === 0) return;
    
    // Create suggestions container
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'city-suggestions';
    suggestionsContainer.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #e2e8f0;
      border-top: none;
      border-radius: 0 0 8px 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      z-index: 1000;
      max-height: 200px;
      overflow-y: auto;
    `;
    
    // Add suggestions
    suggestions.forEach(city => {
      const suggestion = document.createElement('div');
      suggestion.className = 'city-suggestion';
      suggestion.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #f1f5f9;
        font-size: 14px;
      `;
      suggestion.textContent = city;
      
      suggestion.addEventListener('mouseenter', () => {
        suggestion.style.backgroundColor = '#f8fafc';
      });
      
      suggestion.addEventListener('mouseleave', () => {
        suggestion.style.backgroundColor = 'white';
      });
      
      suggestion.addEventListener('click', () => {
        input.value = city;
        hideCitySuggestions(input);
        input.focus();
      });
      
      suggestionsContainer.appendChild(suggestion);
    });
    
    // Position the container
    input.parentNode.style.position = 'relative';
    input.parentNode.appendChild(suggestionsContainer);
  };

  const hideCitySuggestions = (input) => {
    const existing = input.parentNode.querySelector('.city-suggestions');
    if (existing) {
      existing.remove();
    }
  };

  // Ensure radio click toggles reliably
  const setupDateModes = () => {
    const exactDates = $('#exactDates');
    const flexibleDates = $('#flexibleDates');
    const radios = $$('input[name="dateMode"]');
    const update = () => {
      const mode = (document.querySelector('input[name="dateMode"]:checked') || { value: 'exact' }).value;
      if (mode === 'exact') { show(exactDates); hide(flexibleDates); } else { hide(exactDates); show(flexibleDates); }
    };
    radios.forEach(r => { r.addEventListener('change', update); r.addEventListener('click', update); });
    update();
  };

  // Set affiliate links for the destination
  const setAffiliates = (dest) => {
    const q = encodeURIComponent(dest || '');
    const set = (id, url) => { 
      const a = $(id); 
      if (a) {
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    };
    
    // Set affiliate links
    set('#flightsLink', `https://www.skyscanner.com/transport/flights-from/${q}/`);
    set('#hotelsLink', `https://www.booking.com/searchresults.html?ss=${q}`);
    set('#activitiesLink', `https://www.viator.com/search?q=${q}`);
    set('#carsLink', `https://www.rentalcars.com/search?query=${q}`);
    set('#reviewsLink', `https://www.tripadvisor.com/Search?q=${q}`);
  };

  // Create affiliate section HTML
  const createAffiliateSection = (links) => {
    return `
      <div class="affiliate-section">
        <h3>Book your trip:</h3>
        <div class="affiliate-links">
          <a id="flightsLink" href="${links.flights}" target="_blank" rel="noopener noreferrer" class="affiliate-link">✈️ Flights</a>
          <a id="hotelsLink" href="${links.hotels}" target="_blank" rel="noopener noreferrer" class="affiliate-link">🏨 Hotels</a>
          <a id="activitiesLink" href="${links.activities}" target="_blank" rel="noopener noreferrer" class="affiliate-link">🎟️ Activities</a>
          <a id="carsLink" href="${links.cars}" target="_blank" rel="noopener noreferrer" class="affiliate-link">🚗 Cars</a>
          <a id="reviewsLink" href="${links.reviews}" target="_blank" rel="noopener noreferrer" class="affiliate-link">⭐ Reviews</a>
        </div>
      </div>
    `;
  };

  // Append affiliate section to preview
  const appendAffiliateSection = (dest, out) => {
    const affiliateSection = createAffiliateSection({
      flights: `https://www.skyscanner.com/transport/flights-from/${encodeURIComponent(dest)}/`,
      hotels: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(dest)}`,
      activities: `https://www.viator.com/search?q=${encodeURIComponent(dest)}`,
      cars: `https://www.rentalcars.com/search?query=${encodeURIComponent(dest)}`,
      reviews: `https://www.tripadvisor.com/Search?q=${encodeURIComponent(dest)}`
    });
    out.innerHTML += affiliateSection;
    setAffiliates(dest);
  };

  // Save preview to localStorage
  const savePreview = () => {
    const previewData = {
      html: previewEl.innerHTML,
      timestamp: new Date().toISOString(),
      formData: readForm()
    };
    localStorage.setItem('wayzo_last_preview', JSON.stringify(previewData));
    showNotification('Preview saved!', 'success');
  };

  // Restore last preview from localStorage
  const restoreLastPreview = () => {
    const saved = localStorage.getItem('wayzo_last_preview');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        previewEl.innerHTML = data.html;
        setAffiliates(data.formData.destination);
        showNotification('Last preview restored!', 'info');
      } catch (e) {
        console.error('Failed to restore preview:', e);
      }
    } else {
      showNotification('No saved preview found', 'info');
    }
  };

  // Save full plan to localStorage for "Get Back" functionality
  const saveFullPlan = (planHtml, destination) => {
    const planData = {
      html: planHtml,
      timestamp: new Date().toISOString(),
      destination: destination,
      type: 'full_plan'
    };
    localStorage.setItem('wayzo_last_full_plan', JSON.stringify(planData));
  };

  // Create professional trip overview wrapper
  const createTripOverview = (data, destination) => {
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB');
    };

    const startDate = formatDate(data.start);
    const endDate = formatDate(data.end);
    const budget = data.budget ? `${data.budget} ${data.currency || 'EUR'}` : 'Not specified';
    const travelers = `${data.adults || 1} adult${(data.adults || 1) > 1 ? 's' : ''}${data.children ? `, ${data.children} children` : ''}`;
    const style = data.level || 'Mid-range';

    return `
      <div class="trip-overview">
        <h1>🚀 ${destination} Trip Plan</h1>
        <div class="overview-grid">
          <div class="overview-item">
            <strong>📅 Travel Dates</strong>
            ${startDate} → ${endDate}
          </div>
          <div class="overview-item">
            <strong>💰 Budget</strong>
            ${budget}
          </div>
          <div class="overview-item">
            <strong>👥 Travelers</strong>
            ${travelers}
          </div>
          <div class="overview-item">
            <strong>🎯 Travel Style</strong>
            ${style}
          </div>
        </div>
      </div>
    `;
  };

  // Restore full plan from localStorage

  // Form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Free access: no sign-in required for preview
    
    // Test users get enhanced preview with all features
    const isTestUser = currentUser && currentUser.isTestUser;
    
    const data = readForm();
    console.log('Form data:', data);
    
    // Show loading
    hide(previewEl);
    show(loadingEl);
    
    try {
      // Call preview API
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      console.log('Preview result:', result);
      
      // Display preview
      previewEl.innerHTML = result.teaser_html;
      setAffiliates(data.destination);
      
      // Initialize image handling
      initializeImageHandling();
      
      // Show preview and hide loading
      hide(loadingEl);
      show(previewEl);
      
      // Show action buttons (test users get enhanced preview)
      if (isTestUser) {
        // Test users get enhanced preview with all features
        show(pdfBtn);
        show(icsBtn);
        show($('#excelBtn'));
        show($('#customizeBtn'));
        show($('#shareSection'));
        updateShareDestination();
        show(saveBtn);
        
        // Add test user notice for enhanced preview
        const testUserNotice = document.createElement('div');
        testUserNotice.className = 'test-user-notice';
        testUserNotice.innerHTML = `
          <h3>🧪 TEST USER - Enhanced Preview!</h3>
          <p>You're signed in as a test user. This preview includes all premium features and download options.</p>
        `;
        previewEl.insertBefore(testUserNotice, previewEl.firstChild);
        
        showNotification('🧪 Test user: Enhanced preview with all features unlocked!', 'info');
      } else {
        // Regular users get basic preview
        show(pdfBtn);
        show(icsBtn);
        show(saveBtn);
      }
      
      // Track successful preview generation
      trackEvent('preview_generated', { destination: data.destination, budget: data.budget });
      
    } catch (error) {
      console.error('Preview generation failed:', error);
      hide(loadingEl);
      previewEl.innerHTML = `
        <div class="error-message">
          <p>❌ Failed to generate preview. Please try again.</p>
          <p class="muted">Error: ${error.message}</p>
        </div>
      `;
      show(previewEl);
    }
  });

  // Full plan generation
  fullPlanBtn.addEventListener('click', async () => {
    // Free access: no sign-in required for full plan
    
    const data = readForm();
    console.log('Generating full plan for:', data);
    
    // Show cool loading animation for full plan
    hide(previewEl);
    show(loadingEl);
    
    // Show cool trip planning animation
    loadingEl.innerHTML = `
      <div class="trip-planning-animation">
        <div class="animation-container">
          <div class="plane-flying">✈️</div>
          <div class="hotel-building">🏨</div>
          <div class="restaurant-icon">🍽️</div>
          <div class="activity-icon">🎫</div>
          <div class="loading-text">
            <h3>🎯 Creating Your Amazing Trip Plan!</h3>
            <p>Our AI is crafting the perfect itinerary for your ${data.destination} adventure...</p>
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
            <div class="loading-steps">
              <span class="step active">📍 Planning routes</span>
              <span class="step">🏨 Finding hotels</span>
              <span class="step">🍽️ Selecting restaurants</span>
              <span class="step">🎫 Booking activities</span>
              <span class="step">💰 Calculating budget</span>
              <span class="step">🖼️ Generating images</span>
            </div>
          </div>
        </div>
      </div>
    `;
    
    try {
      // Call plan API
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      console.log('Full plan result:', result);
      
      // Check if user is a test user - bypass payment
      console.log('Current user:', currentUser);
      console.log('Is test user?', currentUser && currentUser.isTestUser);
      console.log('User object details:', JSON.stringify(currentUser, null, 2));
      
      if (true) {
        console.log('🎉 Free access enabled - bypassing payment!');
        // Test user or staging - show full plan immediately without payment
        const tripOverview = createTripOverview(data, data.destination);
        previewEl.innerHTML = `
          <div class="test-user-notice">
            <h3>🎉 FREE ACCESS - Full Plan Available!</h3>
            <p>Enjoy your complete travel itinerary with all features unlocked.</p>
          </div>
          ${tripOverview}
          <main class="content trip-report">
            ${result.html}
          </main>
        `;
        setAffiliates(data.destination);
        
        // Initialize image handling
        initializeImageHandling();
        
        // Initialize widget rendering
        initializeWidgets();
        
        // Show all download buttons for test user
        show(pdfBtn);
        show(icsBtn);
        show($('#excelBtn'));
        show($('#customizeBtn'));
        show($('#shareSection'));
        updateShareDestination();
        
        // Hide paywall for test user
        hide($('#purchaseActions'));
        
        // Save full plan for "Get Back" functionality
        saveFullPlan(result.html, data.destination);
        
        showNotification('🧪 Test user: Full plan unlocked! All features available for testing.', 'info');
      } else {
        // Regular user - show paywall
        previewEl.innerHTML = `
          <div class="paywall-preview">
            <h3>🔒 Unlock Your Complete ${data.destination} Trip Plan</h3>
            <p>Your AI-generated itinerary is ready with:</p>
            <div class="paywall-features">
              <span>🗺️ Daily Plans</span>
              <span>🏨 Best Hotels</span>
              <span>🍽️ Top Restaurants</span>
              <span>🎫 Activity Bookings</span>
              <span>💰 Budget Breakdown</span>
              <span>🖼️ Beautiful Images</span>
            </div>
            <p class="paywall-cta"><strong>Just $19 to unlock everything + best booking deals!</strong></p>
          </div>
        `;
        setAffiliates(data.destination);
        
        // Initialize image handling for any preview images
        initializeImageHandling();
        
        // Store full plan content for payment success
        localStorage.setItem('wayzo_pending_full_plan', result.html);
        localStorage.setItem('wayzo_pending_destination', data.destination);
        
        // Show paywall for conversion
        show($('#purchaseActions'));
        // Hide all download buttons until payment
        hide(pdfBtn);
        hide(icsBtn);
        hide($('#excelBtn'));
        hide($('#customizeBtn'));
        hide($('#shareSection'));
        
        // Initialize PayPal buttons for the paywall
        setTimeout(() => {
          if (typeof paypal !== 'undefined') {
            initializePayPalButtons();
          } else {
            bindPaywall();
          }
        }, 500);
      }
      
      // Hide loading
      hide(loadingEl);
      show(previewEl);
      
      // Track plan generation
      trackEvent('plan_generated', { destination: data.destination, budget: data.budget });
      
    } catch (error) {
      console.error('Plan generation failed:', error);
      hide(loadingEl);
      previewEl.innerHTML = `
        <div class="error-message">
          <p>❌ Failed to generate plan. Please try again.</p>
          <p class="muted">Error: ${error.message}</p>
        </div>
      `;
      show(previewEl);
    }
  });

  // Save button
  saveBtn.addEventListener('click', savePreview);

  // Add UI enhancements
  const addUIEnhancements = () => {
    // Add restore preview button
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn btn-ghost';
    restoreBtn.textContent = 'Restore Last Preview';
    restoreBtn.onclick = restoreLastPreview;
    
    const actions = $('.actions');
    if (actions && !actions.querySelector('.btn-ghost[onclick="restoreLastPreview()"]')) {
      actions.appendChild(restoreBtn);
    }
    
    
    // Setup image error handling
    setupImageErrorHandling();
  };

  // Setup image error handling and fallbacks
  const setupImageErrorHandling = () => {
    // Handle image loading errors
    document.addEventListener('error', function(e) {
      if (e.target.tagName === 'IMG') {
        console.log('Image failed to load:', e.target.src);
        // Replace failed image with a placeholder
        e.target.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.className = 'image-placeholder';
        placeholder.innerHTML = `
          <div class="placeholder-content">
            <span class="placeholder-icon">🖼️</span>
            <p>Image loading...</p>
          </div>
        `;
        e.target.parentNode.insertBefore(placeholder, e.target);
      }
    }, true);
  };


  // Debug function to check authentication status
  window.checkAuthStatus = () => {
    console.log('=== AUTHENTICATION STATUS ===');
    console.log('isAuthenticated:', isAuthenticated);
    console.log('currentUser:', currentUser);
    console.log('localStorage wayzo_authenticated:', localStorage.getItem('wayzo_authenticated'));
    console.log('localStorage wayzo_user:', localStorage.getItem('wayzo_user'));
    console.log('Is test user?', currentUser && currentUser.isTestUser);
    console.log('============================');
  };

  // Helper function to check if user is test user
  const isTestUser = () => {
    return currentUser && currentUser.isTestUser;
  };

  // Test user gets access to all premium features
  const unlockAllFeaturesForTestUser = () => {
    if (isTestUser()) {
      // Show all download buttons
      show(pdfBtn);
      show(icsBtn);
      show($('#excelBtn'));
      show($('#shareBtn'));
      
      // Hide any paywalls or restrictions
      hide($('#purchaseActions'));
      
      // Show test user notice
      showNotification('🧪 Test user: All premium features unlocked!', 'info');
      
      return true;
    }
    return false;
  };

  // Global function for test users to unlock all features
  window.unlockAllFeatures = () => {
    if (isTestUser()) {
      unlockAllFeaturesForTestUser();
      return true;
    } else {
      showNotification('This feature is only available for test users.', 'warning');
      return false;
    }
  };

  // Bind paywall functionality
  const bindPaywall = () => {
    // Wait for PayPal SDK to load
    if (typeof paypal !== 'undefined') {
      console.log('PayPal SDK loaded, initializing buttons');
      initializePayPalButtons();
    } else {
      // Retry after a delay
      setTimeout(bindPaywall, 1000);
    }
  };

  // Initialize PayPal buttons
  window.initializePayPalButtons = () => {
    // Prevent multiple initializations
    if (window.paypalInitialized) {
      console.log('PayPal buttons already initialized, skipping...');
      return;
    }

    try {
      // Check if PayPal SDK is loaded
      if (typeof paypal === 'undefined') {
        console.error('PayPal SDK not loaded');
        showPayPalFallback();
        return;
      }

      // Clear existing PayPal buttons to prevent duplicates
      const paypalContainer = document.getElementById('paypal-buttons');
      if (paypalContainer) {
        paypalContainer.innerHTML = '';
      }

      paypal.Buttons({
        createOrder: function(data, actions) {
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: '19.00'
              },
              description: 'Complete Trip Report - AI Generated Itinerary'
            }]
          });
        },
        onApprove: function(data, actions) {
          return actions.order.capture().then(function(details) {
            console.log('Payment completed:', details);
            
            // Get the full plan content from the paywall
            const fullPlanContent = localStorage.getItem('wayzo_pending_full_plan');
            const destination = localStorage.getItem('wayzo_pending_destination');
            
            if (fullPlanContent) {
              // Show the full plan content with professional overview
              const basicOverview = `
                <div class="trip-overview">
                  <h1>🚀 ${destination} Trip Plan</h1>
                  <p>Payment completed successfully!</p>
                </div>
              `;
              previewEl.innerHTML = `
                ${basicOverview}
                <main class="content trip-report">
                  ${fullPlanContent}
                </main>
              `;
              setAffiliates(destination);
              
              // Save full plan for "Get Back" functionality
              saveFullPlan(fullPlanContent, destination);
              
              // Clear pending plan data
              localStorage.removeItem('wayzo_pending_full_plan');
              localStorage.removeItem('wayzo_pending_destination');
            }
            
            // Hide paywall and show download options
            hide($('#purchaseActions'));
            show($('#pdfBtn'));
            show($('#icsBtn'));
            show($('#excelBtn'));
            show($('#customizeBtn'));
        show($('#shareSection'));
        updateShareDestination();
            
            // Reset PayPal initialization flag for future use
            window.paypalInitialized = false;
            
            // Show success message
            showNotification('Payment successful! Your trip report is now unlocked.', 'success');
            
            // Track successful payment
            trackEvent('payment_successful', { 
              amount: '19.00', 
              orderId: data.orderID 
            });
          });
        },
        onError: function(err) {
          console.error('PayPal error:', err);
          showNotification('Payment failed. Please try again.', 'error');
        }
      }).render('#paypal-buttons');
      
      console.log('PayPal buttons rendered successfully');
      hide($('#paypal-fallback'));
      
      // Mark as initialized to prevent duplicates
      window.paypalInitialized = true;
      
    } catch (error) {
      console.error('Failed to initialize PayPal buttons:', error);
      showPayPalFallback();
    }
  };

  // Show PayPal fallback
  const showPayPalFallback = () => {
    hide($('#paypal-buttons'));
    show($('#paypal-fallback'));
  };

  // Retry PayPal initialization
  window.retryPayPal = () => {
    hide($('#paypal-fallback'));
    show($('#paypal-buttons'));
    bindPaywall();
  };

  // Initialize Google Auth from config
  const initGoogleFromConfig = () => {
    try {
      const clientId = (window.WAYZO_PUBLIC_CONFIG && window.WAYZO_PUBLIC_CONFIG.GOOGLE_CLIENT_ID) || window.GOOGLE_CLIENT_ID;
      if (!clientId) {
        console.warn('GOOGLE_CLIENT_ID missing. Google Sign-In disabled.');
        return;
      }
      if (window.google && window.google.accounts && window.google.accounts.id) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (credentialResponse) => {
            try {
              const jwt = credentialResponse.credential;
              const payload = JSON.parse(atob(jwt.split('.')[1]));
              currentUser = {
                name: payload.name || payload.given_name || 'Google User',
                email: payload.email,
                avatar: payload.picture || '/frontend/assets/default-avatar.svg'
              };
              isAuthenticated = true;
              // Persist authentication
              localStorage.setItem('wayzo_authenticated', 'true');
              localStorage.setItem('wayzo_user', JSON.stringify(currentUser));
              hideAuthModal();
              updateUIForAuthenticatedUser();
              showNotification('Google sign-in successful!', 'success');
            } catch (e) {
              console.error('GSI parse error', e);
              showNotification('Google sign-in failed to parse.', 'error');
            }
          }
        });

        // Render buttons inside modal containers if present
        const signInContainer = document.getElementById('gsiSignInContainer');
        if (signInContainer) {
          google.accounts.id.renderButton(signInContainer, { theme: 'outline', size: 'large', width: 280 });
        }
        const signUpContainer = document.getElementById('gsiSignUpContainer');
        if (signUpContainer) {
          google.accounts.id.renderButton(signUpContainer, { theme: 'outline', size: 'large', width: 280 });
        }

        // Optionally show One Tap prompt
        try { google.accounts.id.prompt(); } catch (_) {}
      }
    } catch (e) { console.warn('initGoogleFromConfig error', e); }
  };

  // Setup date validation
  const setupDateValidation = () => {
    console.log('🗓️ Setting up date validation...');
    const startInput = $('#start');
    const endInput = $('#end');
    const today = new Date().toISOString().split('T')[0];

    console.log('Today\'s date:', today);
    console.log('Start input found:', !!startInput);
    console.log('End input found:', !!endInput);

    if (startInput) {
      // Set minimum date to today - this prevents historical date selection in the picker
      startInput.min = today;
      startInput.setAttribute('min', today);
      console.log('✅ Start date minimum set to:', today);

      // Clear any existing historical dates
      if (startInput.value && startInput.value < today) {
        startInput.value = '';
        console.log('🧹 Cleared historical start date');
      }

      startInput.addEventListener('input', (e) => {
        const selectedDate = e.target.value;
        console.log('Start date selected:', selectedDate);

        if (selectedDate < today) {
          alert('Start date cannot be in the past. Please select today or a future date.');
          e.target.value = '';
          e.target.focus();
          return;
        }

        if (endInput && selectedDate) {
          // Update minimum date for end date to be start date
          endInput.min = selectedDate;
          endInput.setAttribute('min', selectedDate);
          console.log('Updated end date minimum to:', selectedDate);

          // If end date is earlier than start date, clear it
          if (endInput.value && endInput.value < selectedDate) {
            endInput.value = '';
            console.log('🧹 Cleared end date as it was earlier than start date');
          }
        }
      });

      startInput.addEventListener('change', (e) => {
        const selectedDate = e.target.value;
        if (selectedDate < today) {
          alert('Start date cannot be in the past. Please select today or a future date.');
          e.target.value = '';
          e.target.focus();
        }
      });
    }

    if (endInput) {
      // Set minimum date to today initially
      endInput.min = today;
      endInput.setAttribute('min', today);
      console.log('✅ End date minimum set to:', today);

      // Clear any existing historical dates
      if (endInput.value && endInput.value < today) {
        endInput.value = '';
        console.log('🧹 Cleared historical end date');
      }

      endInput.addEventListener('input', (e) => {
        const selectedDate = e.target.value;
        console.log('End date selected:', selectedDate);

        if (selectedDate < today) {
          alert('End date cannot be in the past. Please select today or a future date.');
          e.target.value = '';
          e.target.focus();
          return;
        }

        if (startInput && startInput.value && selectedDate < startInput.value) {
          alert('End date cannot be earlier than start date. Please select a date on or after the start date.');
          e.target.value = '';
          e.target.focus();
        }
      });

      endInput.addEventListener('change', (e) => {
        const selectedDate = e.target.value;
        if (selectedDate < today) {
          alert('End date cannot be in the past. Please select today or a future date.');
          e.target.value = '';
          e.target.focus();
        } else if (startInput && startInput.value && selectedDate < startInput.value) {
          alert('End date cannot be earlier than start date. Please select a date on or after the start date.');
          e.target.value = '';
          e.target.focus();
        }
      });
    }

    console.log('✅ Date validation setup complete');
  };

  // Main initialization
  const init = () => {
    setupDateModes();
    setupChildrenAges();
    addUIEnhancements();
    initGoogleFromConfig();
    bindPaywall();

    // Initialize autocomplete
    initializeAutocomplete();

    // Detect user location for "from" field
    detectUserLocation();

    // Setup date validation
    setupDateValidation();

    // Initialize cookie consent
    initializeCookieConsent();
    
    // Ensure login is visible
    ensureLoginVisible();
    
    // Restore authentication state if user was previously signed in
    if (isAuthenticated && currentUser) {
      updateUIForAuthenticatedUser();
    }
  };

  // Setup children ages functionality
  const setupChildrenAges = () => {
    const childrenInput = $('#children');
    const childrenAgesDiv = $('#childrenAges');
    const agesContainer = $('#agesContainer');
    
    if (!childrenInput || !childrenAgesDiv || !agesContainer) return;
    
    const updateAges = () => {
      const count = Number(childrenInput.value) || 0;
      agesContainer.innerHTML = '';
      
      for (let i = 0; i < count; i++) {
        const ageDiv = document.createElement('div');
        ageDiv.className = 'age-input';
        ageDiv.innerHTML = `
          <label>Child ${i + 1} age:</label>
          <input type="number" min="0" max="17" placeholder="Age" />
        `;
        agesContainer.appendChild(ageDiv);
      }
      
      if (count > 0) {
        childrenAgesDiv.classList.remove('hidden');
      } else {
        childrenAgesDiv.classList.add('hidden');
      }
    };
    
    childrenInput.addEventListener('change', updateAges);
    updateAges();
  };

  // Setup dietary needs functionality
  const setupDietaryNeeds = () => {
    const dietaryInputs = $$('input[name="dietary"]');
    const noRestrictionsInput = $('input[name="dietary"][value="none"]');
    
    if (!noRestrictionsInput) return;
    
    // When "no restrictions" is checked, uncheck others
    noRestrictionsInput.addEventListener('change', (e) => {
      if (e.target.checked) {
        dietaryInputs.forEach(input => {
          if (input !== e.target) input.checked = false;
        });
      }
    });
    
    // When other options are checked, uncheck "no restrictions"
    dietaryInputs.forEach(input => {
      if (input !== noRestrictionsInput) {
        input.addEventListener('change', (e) => {
          if (e.target.checked) {
            noRestrictionsInput.checked = false;
          }
        });
      }
    });
  };

  // Setup style selection functionality
  const setupStyleSelection = () => {
    const styleInputs = $$('input[name="level"]');
    
    styleInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        // Update visual state if needed
        console.log('Style selected:', e.target.value);
      });
    });
  };

  // Setup referral system
  const setupReferralSystem = () => {
    // Generate a unique referral code for the user
    const savedCode = localStorage.getItem('wayzo_referral_code');
    if (!savedCode) {
      const newCode = 'WAYZO' + Math.random().toString(36).substr(2, 6).toUpperCase();
      localStorage.setItem('wayzo_referral_code', newCode);
    }
    
    // Display the referral code
    const codeElement = $('#userReferralCode');
    if (codeElement) {
      codeElement.textContent = savedCode || localStorage.getItem('wayzo_referral_code');
    }
  };

  // Copy referral code to clipboard
  window.copyReferralCode = () => {
    const codeElement = $('#userReferralCode');
    if (codeElement) {
      const code = codeElement.textContent;
      navigator.clipboard.writeText(code).then(() => {
        // Show success message
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = 'var(--brand)';
        btn.style.color = 'white';
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.style.color = '';
        }, 2000);
      }).catch(() => {
        alert('Failed to copy code. Please copy manually: ' + code);
      });
    }
  };

  // ====== NEW FEATURES JAVASCRIPT ======

  // Make functions globally accessible
  window.changeLanguage = changeLanguage;
  window.addNewDestination = addNewDestination;
  window.removeDestination = removeDestination;
  window.showAuthModal = showAuthModal;
  window.hideAuthModal = hideAuthModal;
  window.switchAuthTab = switchAuthTab;
  window.handleManualSignIn = handleManualSignIn;
  window.handleManualSignUp = handleManualSignUp;
  window.handleGoogleSignIn = handleGoogleSignIn;
  window.handleGoogleSignUp = handleGoogleSignUp;
  window.handleFacebookSignIn = handleFacebookSignIn;
  window.handleFacebookSignUp = handleFacebookSignUp;
  window.handleAppleSignIn = handleAppleSignIn;
  window.handleAppleSignUp = handleAppleSignUp;
  window.toggleUserMenu = toggleUserMenu;
  window.signOut = signOut;
  window.showDashboard = showDashboard;
  window.showMyPlans = showMyPlans;
  window.showReferrals = showReferrals;
  window.showBilling = showBilling;
  window.showProfile = showProfile;
  window.switchCabinetTab = switchCabinetTab;
  window.showPlanningForm = showPlanningForm;
  window.updateProfile = updateProfile;
  window.copyReferralLink = copyReferralLink;
  window.shareReferral = shareReferral;
  window.downloadPDF = downloadPDF;
  window.downloadICS = downloadICS;
  window.downloadExcel = downloadExcel;
  window.sharePlan = sharePlan;
  window.toggleShareOptions = toggleShareOptions;
  window.shareToPlatform = shareToPlatform;
  window.updateShareDestination = updateShareDestination;
  window.toggleCustomizeMode = toggleCustomizeMode;
  window.removeActivity = removeActivity;
  window.replaceActivity = replaceActivity;
  window.addActivity = addActivity;
  window.applyReplacement = applyReplacement;
  window.applyAddition = applyAddition;
  window.setFlightTimes = setFlightTimes;
  window.exportActivityToCalendar = exportActivityToCalendar;
  window.exportAllActivitiesToCalendar = exportAllActivitiesToCalendar;
  window.applyCalendarExport = applyCalendarExport;
  window.accessAdminPanel = accessAdminPanel;

  // Multi-Destination Management
  let destinationCount = 1;

  function addNewDestination() {
    if (destinationCount >= 10) {
      alert('Maximum 10 destinations allowed');
      return;
    }

    destinationCount++;
    const container = $('#destinationsContainer');
    const newDestination = document.createElement('div');
    newDestination.className = 'destination-item';
    newDestination.innerHTML = `
      <div class="destination-header">
        <span class="destination-number">${destinationCount}</span>
        <button type="button" class="btn-icon remove-destination" onclick="removeDestination(this)">×</button>
      </div>
      <div class="destination-inputs">
        <input type="text" name="destinations[${destinationCount - 1}][place]" placeholder="e.g., Paris, France" data-required />
        <input type="number" name="destinations[${destinationCount - 1}][days]" min="1" max="30" placeholder="Days to stay" data-required />
        <select name="destinations[${destinationCount - 1}][priority]">
          <option value="must-see">Must See</option>
          <option value="high">High Priority</option>
          <option value="medium" selected>Medium Priority</option>
          <option value="low">Low Priority</option>
          <option value="optional">Optional</option>
        </select>
        <textarea name="destinations[${destinationCount - 1}][requirements]" placeholder="Special requirements (optional)"></textarea>
      </div>
    `;
    
    container.appendChild(newDestination);
    updateDestinationNumbers();
  }

  function removeDestination(button) {
    if (destinationCount > 1) {
      button.closest('.destination-item').remove();
      destinationCount--;
      updateDestinationNumbers();
    }
  }

  function updateDestinationNumbers() {
    const destinations = $$('.destination-item');
    destinations.forEach((dest, index) => {
      const numberSpan = dest.querySelector('.destination-number');
      if (numberSpan) {
        numberSpan.textContent = index + 1;
      }
    });
  }

  // Trip Type Management
  function setupTripTypeSelector() {
    const tripTypeInputs = $$('input[name="tripType"]');
    const singleDestination = $('#singleDestination');
    const multiDestination = $('#multiDestination');

    const updateDisplay = () => {
      const selectedType = document.querySelector('input[name="tripType"]:checked').value;
      if (selectedType === 'single') {
        singleDestination.classList.remove('hidden');
        multiDestination.classList.add('hidden');
        
        // Disable validation for multi-destination fields when hidden
        const multiInputs = multiDestination.querySelectorAll('input, select, textarea');
        multiInputs.forEach(input => {
          input.required = false;
          input.disabled = true;
        });
        
        // Enable validation for single destination field
        const singleInputs = singleDestination.querySelectorAll('input, select, textarea');
        singleInputs.forEach(input => {
          if (input.hasAttribute('data-required')) {
            input.required = true;
          }
        });
      } else {
        singleDestination.classList.remove('hidden');
        multiDestination.classList.remove('hidden');
        
        // Enable validation for multi-destination fields
        const multiInputs = multiDestination.querySelectorAll('input, select, textarea');
        multiInputs.forEach(input => {
          if (input.hasAttribute('data-required')) {
            input.required = true;
          }
          input.disabled = false;
        });
        
        // Disable validation for single destination field when multi is selected
        const singleInputs = singleDestination.querySelectorAll('input, select, textarea');
        singleInputs.forEach(input => {
          input.required = false;
        });
      }
    };

    tripTypeInputs.forEach(input => {
      input.addEventListener('change', updateDisplay);
    });
    updateDisplay();
  }

  // Authentication System
  let isAuthenticated = localStorage.getItem('wayzo_authenticated') === 'true';
  let currentUser = JSON.parse(localStorage.getItem('wayzo_user') || 'null');
  
  console.log('🔍 User initialization:', { isAuthenticated, currentUser });

  function showAuthModal() {
    $('#authModal').classList.remove('hidden');
  }

  function hideAuthModal() {
    $('#authModal').classList.add('hidden');
  }

  function switchAuthTab(tab) {
    // Hide all tabs
    $$('.auth-tab-content').forEach(content => content.classList.remove('active'));
    $$('.auth-tab').forEach(tabBtn => tabBtn.classList.remove('active'));
    
    // Show selected tab
    $(`#${tab}Tab`).classList.add('active');
    event.target.classList.add('active');
  }

  function handleManualSignIn(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const email = formData.get('email') || event.target.querySelector('input[type="email"]').value;
    const password = formData.get('password') || event.target.querySelector('input[type="password"]').value;
    
    // Mock authentication
    mockManualSignIn(email, password);
  }

  function handleManualSignUp(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const name = formData.get('name') || event.target.querySelector('input[type="text"]').value;
    const email = formData.get('email') || event.target.querySelector('input[type="email"]').value;
    const password = formData.get('password') || event.target.querySelector('input[type="password"]').value;
    
    // Mock registration
    mockManualSignUp(name, email, password);
  }

  function mockManualSignIn(email, password) {
    // Check for test user account
    if (email === 'test@wayzo.com' && password === 'test123') {
      // Test user - bypass payment and unlock everything
      setTimeout(() => {
        currentUser = {
          name: 'Test User',
          email: email,
          avatar: '/frontend/assets/default-avatar.svg',
          isTestUser: true
        };
        isAuthenticated = true;
        // Persist authentication
        localStorage.setItem('wayzo_authenticated', 'true');
        localStorage.setItem('wayzo_user', JSON.stringify(currentUser));
        hideAuthModal();
        updateUIForAuthenticatedUser();
        showNotification('🎉 Test user signed in! All features unlocked for testing!', 'success');
      }, 1000);
      return;
    }
    
    // Regular user authentication
    setTimeout(() => {
      currentUser = {
        name: email.split('@')[0],
        email: email,
        avatar: '/frontend/assets/default-avatar.svg'
      };
      isAuthenticated = true;
      // Persist authentication
      localStorage.setItem('wayzo_authenticated', 'true');
      localStorage.setItem('wayzo_user', JSON.stringify(currentUser));
      hideAuthModal();
      updateUIForAuthenticatedUser();
      showNotification('Successfully signed in!', 'success');
    }, 1000);
  }

  function mockManualSignUp(name, email, password) {
    // Check for test user account
    if (email === 'test@wayzo.com' && password === 'test123') {
      // Test user - bypass payment and unlock everything
      setTimeout(() => {
        currentUser = {
          name: 'Test User',
          email: email,
          avatar: '/frontend/assets/default-avatar.svg',
          isTestUser: true
        };
        isAuthenticated = true;
        // Persist authentication
        localStorage.setItem('wayzo_authenticated', 'true');
        localStorage.setItem('wayzo_user', JSON.stringify(currentUser));
        hideAuthModal();
        updateUIForAuthenticatedUser();
        showNotification('🎉 Test user account created! All features unlocked for testing!', 'success');
      }, 1000);
      return;
    }
    
    // Regular user registration
    setTimeout(() => {
      currentUser = {
        name: name,
        email: email,
        avatar: '/frontend/assets/default-avatar.svg'
      };
      isAuthenticated = true;
      // Persist authentication
      localStorage.setItem('wayzo_authenticated', 'true');
      localStorage.setItem('wayzo_user', JSON.stringify(currentUser));
      hideAuthModal();
      updateUIForAuthenticatedUser();
      showNotification('Account created successfully!', 'success');
    }, 1000);
  }

  function handleGoogleSignIn() {
    // Placeholder for Google OAuth
    showNotification('Google sign-in coming soon!', 'info');
  }

  function handleGoogleSignUp() {
    // Placeholder for Google OAuth
    showNotification('Google sign-up coming soon!', 'info');
  }

  function handleFacebookSignIn() {
    // Placeholder for Facebook OAuth
    showNotification('Facebook sign-in coming soon!', 'info');
  }

  function handleFacebookSignUp() {
    // Placeholder for Facebook OAuth
    showNotification('Facebook sign-up coming soon!', 'info');
  }

  function handleAppleSignIn() {
    // Placeholder for Apple OAuth
    showNotification('Apple sign-in coming soon!', 'info');
  }

  function handleAppleSignUp() {
    // Placeholder for Apple OAuth
    showNotification('Apple sign-up coming soon!', 'info');
  }

  function updateUIForAuthenticatedUser() {
    if (loginBtn) loginBtn.classList.add('hidden');
    if ($('#userMenuBtn')) {
      $('#userMenuBtn').classList.remove('hidden');
      $('#userMenuAvatar').src = currentUser.avatar;
    }
    if ($('#userName')) $('#userName').textContent = currentUser.name;
    if ($('#userEmail')) $('#userEmail').textContent = currentUser.email;
    if ($('#userAvatar')) $('#userAvatar').src = currentUser.avatar;
    
    // Show admin button if user is admin
    const adminBtn = document.querySelector('.admin-only');
    if (adminBtn) {
      adminBtn.style.display = currentUser.isAdmin ? 'block' : 'none';
    }
    
    // Test users get immediate access to all features
    if (isTestUser()) {
      unlockAllFeaturesForTestUser();
      showNotification('🎉 Test user signed in! All premium features are now unlocked for testing!', 'success');
    }
    
    // Cabinet is now available but doesn't auto-open
    // User can access it via the user menu when they want to
  }

  function toggleUserMenu() {
    const userMenu = $('#userMenu');
    if (userMenu) {
      userMenu.classList.toggle('hidden');
    }
  }

  function signOut() {
    isAuthenticated = false;
    currentUser = null;
    // Clear authentication from localStorage
    localStorage.removeItem('wayzo_authenticated');
    localStorage.removeItem('wayzo_user');
    if (loginBtn) loginBtn.classList.remove('hidden');
    if ($('#userMenuBtn')) $('#userMenuBtn').classList.add('hidden');
    if ($('#userMenu')) $('#userMenu').classList.add('hidden');
    if ($('#personalCabinet')) $('#personalCabinet').classList.add('hidden');
    showNotification('Signed out successfully', 'info');
  }

  // Personal Cabinet Management
  function showDashboard() {
    $('#personalCabinet').classList.remove('hidden');
    switchCabinetTab('overview');
  }

  function showMyPlans() {
    $('#personalCabinet').classList.remove('hidden');
    switchCabinetTab('plans');
  }

  function showReferrals() {
    $('#personalCabinet').classList.remove('hidden');
    switchCabinetTab('referrals');
  }

  function showBilling() {
    $('#personalCabinet').classList.remove('hidden');
    switchCabinetTab('billing');
  }

  function showProfile() {
    $('#personalCabinet').classList.remove('hidden');
    switchCabinetTab('profile');
  }

  function switchCabinetTab(tab) {
    // Hide all tabs
    $$('.cabinet-tab').forEach(tabContent => tabContent.classList.remove('active'));
    $$('.sidebar-item').forEach(item => item.classList.remove('active'));
    
    // Show selected tab
    $(`#${tab}Tab`).classList.add('active');
    event.target.classList.add('active');
  }

  function showPlanningForm() {
    $('#personalCabinet').classList.add('hidden');
  }

  function updateProfile(event) {
    event.preventDefault();
    const name = $('#profileName').value;
    const phone = $('#profilePhone').value;
    
    if (currentUser) {
      currentUser.name = name;
      currentUser.phone = phone;
      updateUIForAuthenticatedUser();
      showNotification('Profile updated successfully!', 'success');
    }
  }

  // Notification System
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span>${message}</span>
      <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  function getNotificationIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }

  // Referral System Functions
  function copyReferralLink() {
    const linkInput = $('#referralLink');
    if (linkInput) {
      navigator.clipboard.writeText(linkInput.value).then(() => {
        showNotification('Referral link copied!', 'success');
      }).catch(() => {
        showNotification('Failed to copy link', 'error');
      });
    }
  }

  function shareReferral(platform) {
    const link = $('#referralLink').value;
    const text = 'Check out Wayzo for amazing trip planning!';
    
    let shareUrl = '';
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent('Check out Wayzo!')}&body=${encodeURIComponent(text + ' ' + link)}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  }

  // Language Management
  function changeLanguage(language) {
    // Use the translations from translations.js
    if (window.WayzoTranslations && window.WayzoTranslations[language]) {
      const translations = window.WayzoTranslations[language];
      
      // Update form labels
      const labelMappings = [
        { selector: 'span:contains("Traveling from (optional)")', key: 'travelingFrom' },
        { selector: 'span:contains("Destination")', key: 'destination' },
        { selector: 'span:contains("Budget")', key: 'budget' },
        { selector: 'span:contains("Travelers")', key: 'travelers' },
        { selector: 'span:contains("Generate preview")', key: 'generatePreview' },
        { selector: 'span:contains("Generate full plan")', key: 'generateFullPlan' },
        { selector: 'span:contains("Trip Type")', key: 'tripType' },
        { selector: 'span:contains("Single Destination")', key: 'singleDestination' },
        { selector: 'span:contains("Multi-Destination")', key: 'multiDestination' }
      ];
      
      labelMappings.forEach(mapping => {
        const elements = document.querySelectorAll(mapping.selector);
        elements.forEach(el => {
          if (el.textContent && translations[mapping.key]) {
            el.textContent = translations[mapping.key];
          }
        });
      });
      
      // Update button texts
      const previewBtn = document.getElementById('previewBtn');
      const fullPlanBtn = document.getElementById('fullPlanBtn');
      if (previewBtn && translations.generatePreview) {
        previewBtn.textContent = translations.generatePreview;
      }
      if (fullPlanBtn && translations.generateFullPlan) {
        fullPlanBtn.textContent = translations.generateFullPlan;
      }
    }
    
    showNotification(`Language changed to ${language}`, 'success');
    localStorage.setItem('wayzo_language', language);
  }

  // Download and Export Functions
  function downloadPDF() {
    const content = document.getElementById('preview').innerHTML;
    if (!content || content.includes('Enter your trip details')) {
      showNotification('No content to download. Generate a plan first.', 'warning');
      return;
    }
    
    // Create printable version content
    const printableContent = `
      <html>
        <head>
          <title>Wayzo Trip Plan - Printable Version</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              body { margin: 0; padding: 20px; }
              .no-print { display: none !important; }
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 20px; 
              line-height: 1.6;
              color: #333;
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border-radius: 15px;
            }
            .header h1 { margin: 0; font-size: 2.5rem; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; }
            .content { 
              background: white; 
              padding: 30px; 
              border-radius: 15px;
              box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            }
            .download-section {
              text-align: center;
              margin: 20px 0;
              padding: 20px;
              background: #f8f9fa;
              border-radius: 10px;
              border: 2px dashed #dee2e6;
            }
            .download-btn {
              background: #007bff;
              color: white;
              padding: 12px 24px;
              border: none;
              border-radius: 8px;
              font-size: 16px;
              cursor: pointer;
              margin: 10px;
              text-decoration: none;
              display: inline-block;
            }
            .download-btn:hover {
              background: #0056b3;
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(0,123,255,0.3);
            }
            .print-btn {
              background: #28a745;
              color: white;
              padding: 12px 24px;
              border: none;
              border-radius: 8px;
              font-size: 16px;
              cursor: pointer;
              margin: 10px;
            }
            .print-btn:hover {
              background: #1e7e34;
            }
            .back-btn {
              background: #6c757d;
              color: white;
              padding: 12px 24px;
              border: none;
              border-radius: 8px;
              font-size: 16px;
              cursor: pointer;
              margin: 10px;
              text-decoration: none;
              display: inline-block;
            }
            .back-btn:hover {
              background: #545b62;
            }
            img { max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0; }
            .affiliate-section { margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 10px; }
            .affiliate-links { display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; }
            .affiliate-link { 
              background: #007bff; 
              color: white; 
              padding: 10px 20px; 
              border-radius: 25px; 
              text-decoration: none;
              transition: all 0.3s ease;
            }
            .affiliate-link:hover { background: #0056b3; transform: translateY(-2px); }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🚀 Wayzo Trip Plan</h1>
            <p>Printable Version - Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="download-section no-print">
            <h3>📄 Trip Plan Options</h3>
            <button class="download-btn" onclick="window.print()">🖨️ Print Plan</button>
            <button class="download-btn" onclick="downloadDirectPDF()">📥 Download PDF</button>
            <a href="javascript:window.close()" class="back-btn">🔙 Close & Return</a>
          </div>
          
          <div class="content">
            ${content}
          </div>
          
          <script>
            async function downloadDirectPDF() {
              try {
                let payload = {};
                try { payload = window.opener && window.opener.readForm ? window.opener.readForm() : {}; } catch {}
                const resp = await fetch('/api/plan.pdf', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload || {}),
                });
                if (!resp.ok) throw new Error('Failed to generate PDF');
                const blob = await resp.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'wayzo-trip-plan.pdf';
                a.click();
                window.URL.revokeObjectURL(url);
              } catch (e) {
                alert('Unable to download PDF right now. Please try again.');
                console.error(e);
              }
            }
          </script>
        </body>
      </html>
    `;
    
    // Open printable version in new window/tab
    const newWindow = window.open('', '_blank');
    newWindow.document.write(printableContent);
    newWindow.document.close();
    
    showNotification('Printable version opened in new tab!', 'success');
  }

  // Calendar Export Helper Functions
  function showCalendarExportModal(formData) {
    const modal = document.createElement('div');
    modal.className = 'replacement-modal';
    modal.innerHTML = `
      <div class="replacement-modal-content">
        <div class="replacement-modal-header">
          <h3>Export to Calendar</h3>
          <button class="btn-close" onclick="this.closest('.replacement-modal').remove()">×</button>
        </div>

        <p>Choose what to export to your calendar:</p>

        <div class="replacement-options">
          <label class="replacement-option">
            <input type="radio" name="calendarExport" value="overview" checked>
            <div class="replacement-option-content">
              <h4>Trip Overview</h4>
              <p>Single event for the entire trip duration</p>
            </div>
          </label>
          <label class="replacement-option">
            <input type="radio" name="calendarExport" value="detailed">
            <div class="replacement-option-content">
              <h4>All Activities</h4>
              <p>Individual events for each activity with specific times</p>
            </div>
          </label>
        </div>

        <div class="replacement-modal-actions">
          <button class="btn btn-secondary" onclick="this.closest('.replacement-modal').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="applyCalendarExport()">Export</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  function applyCalendarExport() {
    const modal = document.querySelector('.replacement-modal');
    const selectedOption = modal.querySelector('input[name="calendarExport"]:checked');
    const formData = readForm();

    if (selectedOption.value === 'detailed') {
      exportAllActivitiesToCalendar();
    } else {
      exportTripOverview(formData);
    }

    modal.remove();
  }

  function exportTripOverview(formData) {
    // Create ICS content for trip overview
    const startDate = new Date(formData.start);
    const endDate = new Date(formData.end);
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Wayzo//Trip Planner//EN',
      'BEGIN:VEVENT',
      `SUMMARY:Trip to ${formData.destination}`,
      `DTSTART:${startDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTEND:${endDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DESCRIPTION:Trip planned with Wayzo - ${formData.destination}`,
      `CATEGORIES:Travel,Wayzo`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    // Download ICS file
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wayzo-trip-${formData.destination.toLowerCase().replace(/\s+/g, '-')}.ics`;
    a.click();
    window.URL.revokeObjectURL(url);

    showNotification('Trip overview exported to calendar! 📅', 'success');
  }

  function downloadICS() {
    const formData = readForm();
    if (!formData.destination || !formData.start) {
      showNotification('Please generate a plan with dates first.', 'warning');
      return;
    }

    // Check if activities exist in the plan
    const previewEl = $('#preview');
    const hasActivities = previewEl && previewEl.querySelectorAll('li').length > 3;

    if (hasActivities) {
      // Show options modal for detailed vs. overview export
      showCalendarExportModal(formData);
    } else {
      // No activities found, export trip overview only
      exportTripOverview(formData);
    }
  }

  function downloadExcel() {
    const formData = readForm();
    if (!formData.destination) {
      showNotification('Please generate a plan first.', 'warning');
      return;
    }
    
    // Create CSV content
    const csvContent = [
      'Trip Details',
      'Destination,' + formData.destination,
      'Start Date,' + (formData.start || 'Flexible'),
      'End Date,' + (formData.end || 'Flexible'),
      'Budget,' + formData.budget + ' ' + formData.currency,
      'Travelers,' + formData.adults + ' adults, ' + formData.children + ' children',
      'Style,' + formData.level,
      '',
      'Generated by Wayzo Trip Planner',
      'Date,' + new Date().toLocaleDateString()
    ].join('\n');
    
    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trip-${formData.destination.toLowerCase()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showNotification('Excel file downloaded!', 'success');
  }

  // Social Sharing Functions
  function updateShareDestination() {
    const formData = readForm();
    const shareDestElement = $('#shareDestination');
    if (shareDestElement && formData.destination) {
      shareDestElement.textContent = formData.destination;
    }
  }

  function toggleShareOptions() {
    const shareOptions = $('#shareOptions');
    if (shareOptions.classList.contains('hidden')) {
      shareOptions.classList.remove('hidden');
      // Close when clicking outside
      document.addEventListener('click', closeShareOnClickOutside);
    } else {
      shareOptions.classList.add('hidden');
      document.removeEventListener('click', closeShareOnClickOutside);
    }
  }

  function closeShareOnClickOutside(event) {
    const shareSection = $('#shareSection');
    if (!shareSection.contains(event.target)) {
      $('#shareOptions').classList.add('hidden');
      document.removeEventListener('click', closeShareOnClickOutside);
    }
  }

  function getShareContent() {
    const formData = readForm();
    const shareType = document.querySelector('input[name="shareType"]:checked')?.value || 'preview';
    const destination = formData.destination || 'Amazing Destination';

    if (shareType === 'preview') {
      return {
        title: `My Trip to ${destination} - Wayzo`,
        text: `🌟 Look at my amazing trip to ${destination}! ✈️ Perfectly planned with Wayzo AI. Check out the highlights and get inspired for your next adventure! 🚀`,
        url: window.location.href,
        hashtags: 'Wayzo,TravelPlanning,AITravel,TripPlanner'
      };
    } else {
      const previewEl = $('#preview');
      const reportText = previewEl ? previewEl.textContent.substring(0, 200) + '...' : '';
      return {
        title: `Complete Trip Plan: ${destination} - Wayzo`,
        text: `🎯 Check out my complete trip to ${destination} planned with Wayzo! Full itinerary with daily schedules, activities, and local recommendations. ${reportText}`,
        url: window.location.href,
        hashtags: 'Wayzo,TravelPlanning,AITravel,TripPlanner,Itinerary'
      };
    }
  }

  function shareToPlatform(platform) {
    const formData = readForm();
    if (!formData.destination) {
      showNotification('Please generate a plan first.', 'warning');
      return;
    }

    const content = getShareContent();
    let shareUrl = '';

    // Track sharing event
    trackEvent('social_share', {
      platform: platform,
      destination: formData.destination,
      shareType: document.querySelector('input[name="shareType"]:checked')?.value || 'preview'
    });

    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(content.url)}&quote=${encodeURIComponent(content.text)}`;
        break;

      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(content.text)}&url=${encodeURIComponent(content.url)}&hashtags=${content.hashtags}`;
        break;

      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(content.url)}&title=${encodeURIComponent(content.title)}&summary=${encodeURIComponent(content.text)}`;
        break;

      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(content.text + ' ' + content.url)}`;
        break;

      case 'instagram':
        // Instagram doesn't support direct URL sharing, so copy to clipboard with instructions
        navigator.clipboard.writeText(content.text + ' ' + content.url).then(() => {
          showNotification('Content copied! Paste it into your Instagram post or story 📸', 'success');
        });
        return;

      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent(content.title)}&body=${encodeURIComponent(content.text + '\n\n' + content.url)}`;
        break;

      case 'copy':
        navigator.clipboard.writeText(content.text + ' ' + content.url).then(() => {
          showNotification('Trip details copied to clipboard! 📋', 'success');
        });
        return;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
      // Hide the share dropdown after sharing
      $('#shareOptions').classList.add('hidden');
    }
  }

  // Legacy function for backwards compatibility
  function sharePlan() {
    toggleShareOptions();
  }

  // Activity Customization Functions
  let customizeMode = false;

  function toggleCustomizeMode() {
    const previewEl = $('#preview');
    const customizeBtn = $('#customizeBtn');

    customizeMode = !customizeMode;

    if (customizeMode) {
      previewEl.classList.add('customize-mode-active');
      customizeBtn.textContent = '✓ Done Customizing';
      customizeBtn.classList.add('btn-success');
      customizeBtn.classList.remove('btn-primary');

      addCustomizeNotice();
      enableActivityCustomization();

      trackEvent('customize_mode_enabled');
    } else {
      previewEl.classList.remove('customize-mode-active');
      customizeBtn.textContent = '✏️ Customize Activities';
      customizeBtn.classList.add('btn-primary');
      customizeBtn.classList.remove('btn-success');

      removeCustomizeNotice();
      cleanupActivityControls();

      trackEvent('customize_mode_disabled');
    }
  }

  function addCustomizeNotice() {
    const previewEl = $('#preview');
    const existingNotice = $('.customize-mode-notice');

    if (existingNotice) {
      existingNotice.remove();
    }

    const notice = document.createElement('div');
    notice.className = 'customize-mode-notice';
    notice.innerHTML = `
      <h4>🎨 Customize Mode Active</h4>
      <p>Hover over daily itinerary activities (with times like "09:00 —") to customize them. Changes are preview-only.</p>
      <small>Note: Only activities in your daily schedule can be customized.</small>
    `;

    previewEl.insertBefore(notice, previewEl.firstChild);
  }

  function removeCustomizeNotice() {
    const notice = $('.customize-mode-notice');
    if (notice) {
      notice.remove();
    }
  }

  function cleanupActivityControls() {
    const previewEl = $('#preview');
    const activityItems = previewEl.querySelectorAll('.activity-item');

    activityItems.forEach(item => {
      item.classList.remove('activity-item');
      delete item.dataset.activityIndex;

      const controls = item.querySelector('.activity-controls');
      if (controls) {
        controls.remove();
      }

      // Reset any styling changes
      item.style.position = '';
      item.style.backgroundColor = '';
      item.style.borderColor = '';
      item.style.opacity = '';
      item.style.textDecoration = '';
    });
  }

  function enableActivityCustomization() {
    const previewEl = $('#preview');

    // Find activity items specifically within daily itineraries
    // Look for content that has time stamps followed by activities
    const allElements = previewEl.querySelectorAll('*');

    allElements.forEach((element, index) => {
      const text = element.textContent.trim();

      // Only target elements with time-based activity format: "HH:MM — Activity description"
      const isTimeBasedActivity = text.match(/^\d{1,2}:\d{2}\s*(AM|PM)?\s*[—-]\s*.+/);

      if (!isTimeBasedActivity) {
        return;
      }

      // Additional check: must be in a context that looks like a daily schedule
      let isInDailySchedule = false;
      let parent = element.parentElement;
      let checkDepth = 0;

      while (parent && checkDepth < 5) {
        const parentText = parent.textContent;
        if (parentText.includes('Day ') || parentText.includes('daily') || parentText.includes('Daily')) {
          isInDailySchedule = true;
          break;
        }
        parent = parent.parentElement;
        checkDepth++;
      }

      if (!isInDailySchedule) {
        return;
      }

      // Skip if it's already processed or if it's too short
      if (element.classList.contains('activity-item') || text.length < 20) {
        return;
      }

      element.classList.add('activity-item');
      element.dataset.activityIndex = index;

      // Add control buttons
      const controls = document.createElement('div');
      controls.className = 'activity-controls';
      controls.innerHTML = `
        <button class="btn-calendar" onclick="exportActivityToCalendar(${index})" title="Add to calendar">📅</button>
        <button class="btn-remove" onclick="removeActivity(${index})" title="Remove activity">×</button>
        <button class="btn-replace" onclick="replaceActivity(${index})" title="Replace activity">↻</button>
        <button class="btn-add" onclick="addActivity(${index})" title="Add alternative">+</button>
      `;

      line.style.position = 'relative';
      line.appendChild(controls);
    });
  }

  function removeActivity(index) {
    const activityEl = document.querySelector(`[data-activity-index="${index}"]`);
    if (activityEl) {
      activityEl.style.opacity = '0.3';
      activityEl.style.textDecoration = 'line-through';

      // Mark as removed
      activityEl.dataset.removed = 'true';

      showNotification('Activity removed! Generate a new plan to see updated itinerary.', 'success');

      trackEvent('activity_removed', {
        activity: activityEl.textContent.trim(),
        index: index
      });
    }
  }

  function replaceActivity(index) {
    const activityEl = document.querySelector(`[data-activity-index="${index}"]`);
    if (!activityEl) return;

    const activityText = activityEl.textContent.trim();
    const formData = readForm();

    showReplacementModal(index, activityText, formData.destination);
  }

  function addActivity(index) {
    const activityEl = document.querySelector(`[data-activity-index="${index}"]`);
    if (!activityEl) return;

    const formData = readForm();

    showAddActivityModal(index, formData.destination);
  }

  function showReplacementModal(index, activityText, destination) {
    const modal = document.createElement('div');
    modal.className = 'replacement-modal';

    // Generate replacement options based on the activity
    const replacements = generateReplacementOptions(activityText, destination);

    modal.innerHTML = `
      <div class="replacement-modal-content">
        <div class="replacement-modal-header">
          <h3>Replace Activity</h3>
          <button class="btn-close" onclick="this.closest('.replacement-modal').remove()">×</button>
        </div>

        <div style="margin-bottom: 16px;">
          <strong>Current:</strong> ${activityText}
        </div>

        <div class="replacement-options">
          ${replacements.map((option, i) => `
            <label class="replacement-option">
              <input type="radio" name="replacement" value="${i}">
              <div class="replacement-option-content">
                <h4>${option.title}</h4>
                <p>${option.description}</p>
              </div>
            </label>
          `).join('')}
        </div>

        <div class="replacement-modal-actions">
          <button class="btn btn-secondary" onclick="this.closest('.replacement-modal').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="applyReplacement(${index})">Apply Replacement</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    trackEvent('replacement_modal_opened', {
      originalActivity: activityText,
      destination: destination
    });
  }

  function showAddActivityModal(index, destination) {
    const modal = document.createElement('div');
    modal.className = 'replacement-modal';

    // Generate activity suggestions
    const suggestions = generateActivitySuggestions(destination);

    modal.innerHTML = `
      <div class="replacement-modal-content">
        <div class="replacement-modal-header">
          <h3>Add Activity</h3>
          <button class="btn-close" onclick="this.closest('.replacement-modal').remove()">×</button>
        </div>

        <p>Choose an additional activity to add after the selected item:</p>

        <div class="replacement-options">
          ${suggestions.map((option, i) => `
            <label class="replacement-option">
              <input type="radio" name="addition" value="${i}">
              <div class="replacement-option-content">
                <h4>${option.title}</h4>
                <p>${option.description}</p>
              </div>
            </label>
          `).join('')}
        </div>

        <div class="replacement-modal-actions">
          <button class="btn btn-secondary" onclick="this.closest('.replacement-modal').remove()">Cancel</button>
          <button class="btn btn-primary" onclick="applyAddition(${index})">Add Activity</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    trackEvent('add_activity_modal_opened', {
      destination: destination
    });
  }

  function generateReplacementOptions(activityText, destination) {
    // Simple replacement suggestions based on activity type
    const lowercaseActivity = activityText.toLowerCase();

    if (lowercaseActivity.includes('museum')) {
      return [
        { title: 'Art Gallery Visit', description: 'Explore local art galleries and exhibitions' },
        { title: 'Historical Walking Tour', description: 'Guided tour of historical district' },
        { title: 'Cultural Center', description: 'Visit local cultural center and performances' }
      ];
    } else if (lowercaseActivity.includes('restaurant') || lowercaseActivity.includes('lunch') || lowercaseActivity.includes('dinner')) {
      return [
        { title: 'Local Market Food Tour', description: 'Explore authentic street food and local markets' },
        { title: 'Rooftop Dining', description: 'Scenic dining with city views' },
        { title: 'Cooking Class', description: 'Learn to cook traditional local dishes' }
      ];
    } else if (lowercaseActivity.includes('park') || lowercaseActivity.includes('walk')) {
      return [
        { title: 'Botanical Garden', description: 'Peaceful walk through beautiful gardens' },
        { title: 'Riverside Path', description: 'Scenic walk along the waterfront' },
        { title: 'Viewpoint Hike', description: 'Short hike to panoramic city views' }
      ];
    } else {
      return [
        { title: 'Local Experience', description: `Alternative ${destination} experience` },
        { title: 'Cultural Activity', description: 'Immersive local cultural activity' },
        { title: 'Relaxation Time', description: 'Free time to explore at your own pace' }
      ];
    }
  }

  function generateActivitySuggestions(destination) {
    return [
      { title: 'Photo Walking Tour', description: 'Capture the best Instagram-worthy spots' },
      { title: 'Local Coffee Experience', description: 'Visit the best local coffee shops' },
      { title: 'Souvenir Shopping', description: 'Browse unique local crafts and souvenirs' },
      { title: 'People Watching', description: 'Relax in a popular local square' },
      { title: 'Mini Food Tour', description: 'Try 3-4 local specialties' }
    ];
  }

  function applyReplacement(index) {
    const modal = document.querySelector('.replacement-modal');
    const selectedOption = modal.querySelector('input[name="replacement"]:checked');

    if (!selectedOption) {
      showNotification('Please select a replacement option.', 'warning');
      return;
    }

    const activityEl = document.querySelector(`[data-activity-index="${index}"]`);
    const replacementIndex = selectedOption.value;
    const replacements = generateReplacementOptions(activityEl.textContent, readForm().destination);
    const replacement = replacements[replacementIndex];

    if (activityEl && replacement) {
      // Update the activity text
      const timeMatch = activityEl.textContent.match(/\d{1,2}:\d{2}(?:\s*[AP]M)?/);
      const time = timeMatch ? timeMatch[0] : '';

      activityEl.innerHTML = `${time} — ${replacement.title}. <em>(Customized)</em>`;
      activityEl.style.backgroundColor = '#f0f9ff';
      activityEl.style.borderColor = '#0ea5e9';

      modal.remove();

      showNotification(`Activity replaced with "${replacement.title}"!`, 'success');

      trackEvent('activity_replaced', {
        original: activityEl.dataset.originalText,
        replacement: replacement.title,
        index: index
      });
    }
  }

  function applyAddition(index) {
    const modal = document.querySelector('.replacement-modal');
    const selectedOption = modal.querySelector('input[name="addition"]:checked');

    if (!selectedOption) {
      showNotification('Please select an activity to add.', 'warning');
      return;
    }

    const activityEl = document.querySelector(`[data-activity-index="${index}"]`);
    const suggestionIndex = selectedOption.value;
    const suggestions = generateActivitySuggestions(readForm().destination);
    const addition = suggestions[suggestionIndex];

    if (activityEl && addition) {
      // Create new activity element
      const newActivity = document.createElement('li');
      newActivity.className = 'activity-item added-activity';
      newActivity.innerHTML = `<span style="color: #16a34a;">+ ${addition.title}</span> <em>(Added)</em>`;
      newActivity.style.backgroundColor = '#f0fdf4';
      newActivity.style.borderColor = '#22c55e';
      newActivity.style.marginLeft = '20px';

      // Insert after current activity
      activityEl.parentNode.insertBefore(newActivity, activityEl.nextSibling);

      modal.remove();

      showNotification(`"${addition.title}" added to your itinerary!`, 'success');

      trackEvent('activity_added', {
        addition: addition.title,
        afterIndex: index
      });
    }
  }

  // Flight Time Functions
  function setFlightTimes(arrivalTime, departureTime) {
    const arrivalInput = document.querySelector('input[name="arrivalTime"]');
    const departureInput = document.querySelector('input[name="departureTime"]');

    if (arrivalInput) arrivalInput.value = arrivalTime;
    if (departureInput) departureInput.value = departureTime;

    trackEvent('flight_times_preset', {
      arrival: arrivalTime,
      departure: departureTime
    });

    if (arrivalTime && departureTime) {
      showNotification(`Flight times set: Arrival ${arrivalTime}, Departure ${departureTime}`, 'success');
    } else {
      showNotification('Flight times cleared', 'info');
    }
  }

  // Calendar Export Functions
  function exportActivityToCalendar(index) {
    const activityEl = document.querySelector(`[data-activity-index="${index}"]`);
    if (!activityEl) return;

    const activityText = activityEl.textContent.trim();
    const formData = readForm();

    if (!formData.start) {
      showNotification('Trip dates are required for calendar export.', 'warning');
      return;
    }

    // Parse activity details
    const activity = parseActivityDetails(activityText, formData, activityEl);

    if (activity) {
      createActivityCalendarEvent(activity);
    } else {
      showNotification('Could not parse activity details.', 'error');
    }
  }

  function parseActivityDetails(activityText, formData, activityEl = null) {
    // Extract time from activity text (e.g., "09:30 — City tower lookout")
    const timeMatch = activityText.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/);
    if (!timeMatch) {
      return null;
    }

    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const isPM = timeMatch[3] === 'PM';

    // Extract day information from context
    let dayNumber = 1;
    const dayMatch = activityText.match(/Day (\d+)/i);

    if (dayMatch) {
      dayNumber = parseInt(dayMatch[1]);
    } else if (activityEl) {
      // Try to find day information from parent elements
      const parentSection = activityEl.closest('section, div');
      const dayHeader = parentSection?.querySelector('h3, h4, h2, strong');
      const headerText = dayHeader?.textContent || '';
      const headerDayMatch = headerText.match(/Day (\d+)/i);
      if (headerDayMatch) {
        dayNumber = parseInt(headerDayMatch[1]);
      }
    }

    // Extract activity name (everything after the time and dash)
    const activityName = activityText.replace(/^\d{1,2}:\d{2}(?:\s*[AP]M)?\s*[—-]\s*/, '').split('.')[0].trim();

    // Calculate the actual date
    const startDate = new Date(formData.start);
    const activityDate = new Date(startDate);
    activityDate.setDate(startDate.getDate() + (dayNumber - 1));

    // Set the time
    const activityTime = new Date(activityDate);
    const hour24 = isPM && hours !== 12 ? hours + 12 : (isPM || hours !== 12) ? hours : hours;
    activityTime.setHours(hour24, minutes, 0, 0);

    // Set end time (assume 1-2 hours duration based on activity type)
    const endTime = new Date(activityTime);
    const duration = activityName.toLowerCase().includes('museum') ||
                     activityName.toLowerCase().includes('tour') ? 120 : 60; // 2 hours for museums/tours, 1 hour for others
    endTime.setMinutes(activityTime.getMinutes() + duration);

    return {
      title: activityName,
      startTime: activityTime,
      endTime: endTime,
      location: formData.destination,
      day: dayNumber
    };
  }

  function createActivityCalendarEvent(activity) {
    const formatDateTime = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Wayzo//Activity Export//EN',
      'BEGIN:VEVENT',
      `SUMMARY:${activity.title}`,
      `DTSTART:${formatDateTime(activity.startTime)}`,
      `DTEND:${formatDateTime(activity.endTime)}`,
      `LOCATION:${activity.location}`,
      `DESCRIPTION:Day ${activity.day} activity from your ${activity.location} trip planned with Wayzo.`,
      `CATEGORIES:Travel,Wayzo`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    // Download ICS file
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wayzo-activity-${activity.title.toLowerCase().replace(/\s+/g, '-')}.ics`;
    a.click();
    window.URL.revokeObjectURL(url);

    showNotification(`Calendar event created for "${activity.title}"! 📅`, 'success');

    trackEvent('activity_calendar_export', {
      activity: activity.title,
      location: activity.location,
      day: activity.day
    });
  }

  // Enhanced bulk calendar export for all activities
  function exportAllActivitiesToCalendar() {
    const formData = readForm();
    if (!formData.start || !formData.destination) {
      showNotification('Trip dates and destination are required.', 'warning');
      return;
    }

    const previewEl = $('#preview');
    const activityElements = previewEl.querySelectorAll('.activity-item, li');
    const events = [];

    activityElements.forEach((el) => {
      const activityText = el.textContent.trim();
      const activity = parseActivityDetails(activityText, formData);

      if (activity) {
        events.push({
          title: activity.title,
          startTime: activity.startTime,
          endTime: activity.endTime,
          location: activity.location,
          day: activity.day
        });
      }
    });

    if (events.length === 0) {
      showNotification('No activities found to export.', 'warning');
      return;
    }

    const formatDateTime = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Wayzo//Trip Activities//EN'
    ];

    events.forEach((event) => {
      icsContent.push(
        'BEGIN:VEVENT',
        `SUMMARY:${event.title}`,
        `DTSTART:${formatDateTime(event.startTime)}`,
        `DTEND:${formatDateTime(event.endTime)}`,
        `LOCATION:${event.location}`,
        `DESCRIPTION:Day ${event.day} activity from your ${event.location} trip planned with Wayzo.`,
        `CATEGORIES:Travel,Wayzo`,
        'END:VEVENT'
      );
    });

    icsContent.push('END:VCALENDAR');

    // Download ICS file
    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wayzo-all-activities-${formData.destination.toLowerCase().replace(/\s+/g, '-')}.ics`;
    a.click();
    window.URL.revokeObjectURL(url);

    showNotification(`${events.length} activities exported to calendar! 📅`, 'success');

    trackEvent('all_activities_calendar_export', {
      destination: formData.destination,
      activityCount: events.length
    });
  }

  // Admin Panel Access
  function accessAdminPanel() {
    // Always open protected /admin; backend enforces credentials
    window.open('/admin', '_blank');
  }

  // Show referral modal
  window.showReferralModal = function() {
    const modal = document.createElement('div');
    modal.className = 'referral-modal';
    modal.innerHTML = `
      <div class="referral-modal-content">
        <div class="referral-modal-header">
          <h3>Share Wayzo & Earn Rewards</h3>
          <button class="btn-close" onclick="this.closest('.referral-modal').remove()">×</button>
        </div>
        <div class="referral-modal-body">
          <p>Share your referral code with friends and family. For every successful referral, you'll earn $5 off your next trip plan!</p>
          <div class="referral-stats">
            <div class="stat">
              <span class="stat-number">8</span>
              <span class="stat-label">Total Referrals</span>
            </div>
            <div class="stat">
              <span class="stat-number">$40</span>
              <span class="stat-label">Total Earnings</span>
            </div>
            <div class="share-options">
              <h4>Share via:</h4>
              <div class="share-buttons">
                <button class="share-btn social" onclick="shareReferral('facebook')">
                  <i class="fab fa-facebook-f"></i> Facebook
                </button>
                <button class="share-btn social" onclick="shareReferral('twitter')">
                  <i class="fab fa-twitter"></i> Twitter
                </button>
                <button class="share-btn social" onclick="shareReferral('whatsapp')">
                  <i class="fab fa-whatsapp"></i> WhatsApp
                </button>
                <button class="share-btn social" onclick="shareReferral('email')">
                  <i class="fas fa-envelope"></i> Email
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  // Event Listeners
  function setupEventListeners() {
    // Login button
    if (loginBtn) {
      loginBtn.addEventListener('click', showAuthModal);
    }

    // User menu button
    const userMenuBtn = $('#userMenuBtn');
    if (userMenuBtn) {
      userMenuBtn.addEventListener('click', toggleUserMenu);
    }

    // Close buttons
    $$('.btn-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.auth-modal, .personal-cabinet');
        if (modal) modal.classList.add('hidden');
      });
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.auth-modal, .user-menu, .user-menu-btn')) {
        $('#userMenu').classList.add('hidden');
      }
    });
  }

  // Initialize new features
  document.addEventListener('DOMContentLoaded', () => {
    setupTripTypeSelector();
    setupEventListeners();
    
    // Load saved language
    const savedLanguage = localStorage.getItem('wayzo_language');
    if (savedLanguage) {
      const languageSelect = $('#languageSelect');
      if (languageSelect) {
        languageSelect.value = savedLanguage;
      }
    }
  });

  // Run init now
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // Setup dietary and style functionality after DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    setupDietaryNeeds();
    setupStyleSelection();
    setupReferralSystem();
  });

  // Global function for easy test user login
  window.loginAsTestUser = () => {
    console.log('🧪 Manual test user login triggered');
    currentUser = {
      name: 'Test User',
      email: 'test@wayzo.com',
      avatar: '/frontend/assets/default-avatar.svg',
      isTestUser: true
    };
    isAuthenticated = true;
    localStorage.setItem('wayzo_authenticated', 'true');
    localStorage.setItem('wayzo_user', JSON.stringify(currentUser));
    updateUIForAuthenticatedUser();
  };

  // Global function to clear test user and require manual signup
  window.clearTestUser = () => {
    console.log('🧹 Clearing test user state - requiring manual signup');
    currentUser = null;
    isAuthenticated = false;
    localStorage.removeItem('wayzo_authenticated');
    localStorage.removeItem('wayzo_user');
    updateUIForAuthenticatedUser();
    showNotification('Test user cleared. Please sign up manually.', 'info');
  };

  // Enhanced checklist functionality with widget integration
  window.toggleItem = (checkbox) => {
    const item = checkbox.closest('.dont-forget-item');
    if (checkbox.checked) {
      item.classList.add('checked');
      showNotification('✅ Item marked as done!', 'success');
      
      // Link to relevant widget based on item content
      const itemText = checkbox.nextElementSibling.textContent.toLowerCase();
      linkToRelevantWidget(itemText);
    } else {
      item.classList.remove('checked');
      showNotification('📝 Item unchecked', 'info');
    }
  };

  // Link checklist items to relevant widgets
  function linkToRelevantWidget(itemText) {
    const widgets = document.querySelectorAll('.affiliate-widget');
    
    widgets.forEach(widget => {
      const widgetTitle = widget.querySelector('h4').textContent.toLowerCase();
      const widgetDesc = widget.querySelector('p').textContent.toLowerCase();
      
      // Match item to relevant widget
      if (itemText.includes('esim') || itemText.includes('sim') || itemText.includes('internet') || itemText.includes('connectivity')) {
        if (widgetTitle.includes('esim') || widgetDesc.includes('internet')) {
          highlightWidget(widget);
        }
      } else if (itemText.includes('flight') || itemText.includes('airplane') || itemText.includes('plane')) {
        if (widgetTitle.includes('flight') || widgetDesc.includes('flight')) {
          highlightWidget(widget);
        }
      } else if (itemText.includes('hotel') || itemText.includes('accommodation') || itemText.includes('stay')) {
        if (widgetTitle.includes('hotel') || widgetDesc.includes('accommodation')) {
          highlightWidget(widget);
        }
      } else if (itemText.includes('car') || itemText.includes('rental') || itemText.includes('transport')) {
        if (widgetTitle.includes('car') || widgetDesc.includes('rental')) {
          highlightWidget(widget);
        }
      } else if (itemText.includes('airport') || itemText.includes('transfer') || itemText.includes('pickup')) {
        if (widgetTitle.includes('airport') || widgetDesc.includes('transfer')) {
          highlightWidget(widget);
        }
      }
    });
  }

  // Highlight relevant widget
  function highlightWidget(widget) {
    widget.style.transform = 'scale(1.05)';
    widget.style.boxShadow = '0 8px 25px rgba(37, 99, 235, 0.3)';
    widget.style.border = '2px solid var(--brand)';
    
    // Scroll to widget
    widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Reset highlight after 3 seconds
    setTimeout(() => {
      widget.style.transform = '';
      widget.style.boxShadow = '';
      widget.style.border = '';
    }, 3000);
  }

  // Image error handling and fallback
  window.handleImageError = (img) => {
    const originalSrc = img.src;
    const fallbackSrcs = [
      `https://picsum.photos/400/300?random=${Math.floor(Math.random() * 1000)}`,
      `https://via.placeholder.com/400x300/2563eb/ffffff?text=Travel+Image`,
      `https://via.placeholder.com/400x300/22c55e/ffffff?text=Destination+Photo`
    ];
    
    // Try next fallback source
    const currentIndex = fallbackSrcs.findIndex(src => originalSrc.includes(src)) || -1;
    const nextIndex = (currentIndex + 1) % fallbackSrcs.length;
    
    img.src = fallbackSrcs[nextIndex];
    img.onerror = null; // Prevent infinite loop
    
    console.log('Image fallback:', { original: originalSrc, fallback: img.src });
  };

      // Initialize image error handling for all images in the report
  window.initializeImageHandling = () => {
    // Wait a bit for the DOM to be ready
    setTimeout(() => {
      // Scope ONLY to the report container to avoid affecting homepage/UI images
      const reportContainer = document.getElementById('preview');
      if (!reportContainer) return;
      // Remove stray placeholders like "🖼️" and "Image loading..." left by the generator
      Array.from(reportContainer.querySelectorAll('*')).forEach(el => {
        const text = (el.textContent || '').trim();
        if (!el.children.length && (text === 'Image loading...' || text === '🖼️')) {
          try { el.remove(); } catch (_) {}
        }
      });
      const allImages = reportContainer.querySelectorAll('img');
      console.log('Found total images:', allImages.length);
      
      // Process every single image
      allImages.forEach((img, index) => {
        console.log(`Processing image ${index + 1}:`, img.src, img.alt);
        
        // Set initial styles for better UX
        img.style.borderRadius = '12px';
        img.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
        img.style.transition = 'all 0.3s ease';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.opacity = '1';
        img.style.display = 'block';
        img.style.margin = '20px 0';
        img.style.objectFit = 'cover';
        
        // Add loading state
        img.style.filter = 'blur(2px)';
        img.style.transform = 'scale(0.98)';
        
        // Handle successful load
        img.onload = () => {
          img.style.opacity = '1';
          img.style.display = 'block';
          img.style.filter = 'blur(0px)';
          img.style.transform = 'scale(1)';
          console.log('✅ Image loaded successfully:', img.src);
        };
        
        // Handle load error
        img.onerror = () => {
          console.log('❌ Image failed to load:', img.src);
          handleImageError(img);
          img.style.opacity = '1';
          img.style.display = 'block';
          img.style.filter = 'blur(0px)';
        };
        
        // Add hover effects
        img.addEventListener('mouseenter', () => { 
          img.style.transform = 'scale(1.02) translateY(-2px)'; 
          img.style.boxShadow = '0 12px 35px rgba(0,0,0,0.2)';
        });
        img.addEventListener('mouseleave', () => { 
          img.style.transform = 'scale(1) translateY(0px)'; 
          img.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
        });
        
        // Check if image is already loaded (cached)
        if (img.complete) {
          if (img.naturalWidth > 0) { 
            img.style.opacity = '1'; 
            img.style.display = 'block';
            img.style.filter = 'blur(0px)';
            img.style.transform = 'scale(1)';
            console.log('✅ Image already loaded (cached):', img.src); 
          } else { 
            img.onerror(); 
          }
        }
        
        // AGGRESSIVE IMAGE FIXING - Handle all possible cases
        
        // Case 1: Images with 'image:' token
        if (img.src.includes('image:')) {
          const query = img.src.replace('image:', '').trim();
          let unsplashQuery = prefixWithDestination(getSantoriniQuery(query));
          const unsplashUrl = `https://source.unsplash.com/400x300/?${encodeURIComponent(unsplashQuery)}`;
          console.log('🔄 Converting image token:', query, '→', unsplashQuery, '→', unsplashUrl);
          img.src = unsplashUrl;
          return;
        }
        
        // Case 2: Images with "Image loading..." text nearby
        const parentText = img.parentElement?.textContent || '';
        if (parentText.includes('Image loading') && !img.src.includes('unsplash') && !img.src.includes('picsum')) {
          let contextQuery = prefixWithDestination(getContextQuery(parentText));
          const unsplashUrl = `https://source.unsplash.com/400x300/?${encodeURIComponent(contextQuery)}`;
          console.log('🔄 Converting context-based image:', contextQuery, '→', unsplashUrl);
          img.src = unsplashUrl;
          return;
        }
        
        // Case 3: Images with empty or invalid src
        if (!img.src || img.src === '' || img.src.includes('data:') || img.src.includes('blob:')) {
          const altText = img.alt || '';
          let fallbackQuery = prefixWithDestination(getFallbackQuery(altText));
          const fallbackUrl = `https://source.unsplash.com/400x300/?${encodeURIComponent(fallbackQuery)}`;
          console.log('🔄 Loading fallback image:', fallbackQuery, '→', fallbackUrl);
          img.src = fallbackUrl;
          return;
        }
        
        // Case 4: Images that are not loading (no src attribute or broken)
        if (!img.src || img.src === 'undefined' || img.src === 'null') {
          const altText = img.alt || '';
          let fallbackQuery = prefixWithDestination(getFallbackQuery(altText));
          const fallbackUrl = `https://source.unsplash.com/400x300/?${encodeURIComponent(fallbackQuery)}`;
          console.log('🔄 Loading missing image:', fallbackQuery, '→', fallbackUrl);
          img.src = fallbackUrl;
          return;
        }
        
        // Case 5: Force reload any image that might be broken
        if (img.src && !img.src.includes('unsplash') && !img.src.includes('picsum') && !img.src.includes('placeholder')) {
          const altText = img.alt || '';
          if (altText.includes('Santorini') || altText.includes('Greece') || altText.includes('Image')) {
            let fallbackQuery = prefixWithDestination(getFallbackQuery(altText));
            const fallbackUrl = `https://source.unsplash.com/400x300/?${encodeURIComponent(fallbackQuery)}`;
            console.log('🔄 Force loading image:', fallbackQuery, '→', fallbackUrl);
            img.src = fallbackUrl;
          }
        }
        
        // Case 6: Force load any image with "Image loading..." in alt text
        if (img.alt && img.alt.includes('Image loading')) {
          const altText = img.alt || '';
          let fallbackQuery = prefixWithDestination(getFallbackQuery(altText));
          const fallbackUrl = `https://source.unsplash.com/400x300/?${encodeURIComponent(fallbackQuery)}`;
          console.log('🔄 Force loading from alt text:', fallbackQuery, '→', fallbackUrl);
          img.src = fallbackUrl;
          return;
        }
        
        // Case 7: Handle images that show as "Image loading..." text
        if (img.alt && img.alt.includes('🖼️')) {
          const altText = img.alt || '';
          let fallbackQuery = prefixWithDestination(getFallbackQuery(altText));
          const fallbackUrl = `https://source.unsplash.com/400x300/?${encodeURIComponent(fallbackQuery)}`;
          console.log('🔄 Loading emoji image:', fallbackQuery, '→', fallbackUrl);
          img.src = fallbackUrl;
          return;
        }
        
        // Case 8: Force load any image that doesn't have a proper Unsplash URL (scoped)
        if (img.src && !img.src.includes('source.unsplash.com')) {
          const altText = img.alt || '';
          let fallbackQuery = prefixWithDestination(getFallbackQuery(altText));
          const fallbackUrl = `https://source.unsplash.com/400x300/?${encodeURIComponent(fallbackQuery)}`;
          console.log('🔄 Converting to Unsplash:', fallbackQuery, '→', fallbackUrl);
          img.src = fallbackUrl;
          return;
        }
        
        // Case 9: Handle any image with "Image loading..." in src or alt
        if ((img.src && img.src.includes('Image loading')) || (img.alt && img.alt.includes('Image loading'))) {
          const altText = img.alt || '';
          let fallbackQuery = prefixWithDestination(getFallbackQuery(altText));
          const fallbackUrl = `https://source.unsplash.com/400x300/?${encodeURIComponent(fallbackQuery)}`;
          console.log('🔄 Fixing loading text image:', fallbackQuery, '→', fallbackUrl);
          img.src = fallbackUrl;
          return;
        }
        
        // Case 10: Handle any image with empty or invalid src
        if (!img.src || img.src === '#' || img.src === 'data:') {
          const altText = img.alt || '';
          let fallbackQuery = prefixWithDestination(getFallbackQuery(altText));
          const fallbackUrl = `https://source.unsplash.com/400x300/?${encodeURIComponent(fallbackQuery)}`;
          console.log('🔄 Fixing empty src image:', fallbackQuery, '→', fallbackUrl);
          img.src = fallbackUrl;
          return;
        }
      });
      
      console.log('Image handling initialized for', allImages.length, 'images');
    }, 100);
  };
  
  // Helper function to get Santorini-specific queries
  function getSantoriniQuery(query) {
    if (query.toLowerCase().includes('santorini')) {
      if (query.toLowerCase().includes('cityscape') || query.toLowerCase().includes('city skyline')) {
        return 'Santorini sunset Oia Greece';
      } else if (query.toLowerCase().includes('cuisine') || query.toLowerCase().includes('traditional food')) {
        return 'Greek food Santorini taverna';
      } else if (query.toLowerCase().includes('landmark')) {
        return 'Santorini white buildings caldera';
      } else if (query.toLowerCase().includes('nature') || query.toLowerCase().includes('natural beauty')) {
        return 'Santorini beaches volcanic';
      } else if (query.toLowerCase().includes('culture') || query.toLowerCase().includes('local people')) {
        return 'Santorini culture local people';
      } else if (query.toLowerCase().includes('architecture') || query.toLowerCase().includes('beautiful buildings')) {
        return 'Santorini architecture blue domes';
      } else if (query.toLowerCase().includes('activities') || query.toLowerCase().includes('tourist activities')) {
        return 'Santorini activities wine tasting';
      } else if (query.toLowerCase().includes('experience') || query.toLowerCase().includes('travel experience')) {
        return 'Santorini experience travel';
      }
    }
    return query;
  }
  
  // Helper function to get context-based queries
  function getContextQuery(parentText) {
    if (parentText.includes('sunset') || parentText.includes('Oia')) {
      return 'sunset viewpoint';
    } else if (parentText.includes('food') || parentText.includes('cuisine')) {
      return 'local food taverna';
    } else if (parentText.includes('beach') || parentText.includes('volcanic')) {
      return 'beach';
    } else if (parentText.includes('architecture') || parentText.includes('blue dome')) {
      return 'architecture blue domes';
    } else if (parentText.includes('wine') || parentText.includes('tasting')) {
      return 'wine tasting';
    } else if (parentText.includes('culture') || parentText.includes('local')) {
      return 'local culture';
    } else if (parentText.includes('experience') || parentText.includes('travel')) {
      return 'travel experience';
    }
    return 'highlights';
  }
  
  // Helper function to get fallback queries
  function getFallbackQuery(altText) {
    if (altText.includes('Cityscape') || altText.includes('Overview')) {
      return 'cityscape skyline';
    } else if (altText.includes('Food') || altText.includes('Cuisine')) {
      return 'local food taverna';
    } else if (altText.includes('Landmark') || altText.includes('Cultural')) {
      return 'famous landmark';
    } else if (altText.includes('Nature') || altText.includes('Landscape')) {
      return 'nature landscape';
    } else if (altText.includes('Culture') || altText.includes('Local')) {
      return 'local culture';
    } else if (altText.includes('Architecture')) {
      return 'architecture';
    } else if (altText.includes('Activity') || altText.includes('Activities')) {
      return 'top activity';
    } else if (altText.includes('Experience')) {
      return 'travel experience';
    }
    return 'highlights';
  }

  // Prefix queries with destination for relevance
  function prefixWithDestination(query) {
    try {
      const destInput = document.getElementById('dest');
      const dest = (destInput && destInput.value ? destInput.value.trim() : '');
      if (!dest) return query;
      if (query.toLowerCase().includes(dest.toLowerCase())) return query;
      return `${dest} ${query}`.trim();
    } catch (_) { return query; }
  }

  // Enhance budget table with checkboxes and status spans if missing
  function enhanceBudgetTable() {
    const table = document.querySelector('#preview table.budget-table');
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 4) return;
      if ((cells[0].textContent || '').trim().toLowerCase() === 'total') return;
      const firstCell = cells[0];
      if (!firstCell.querySelector('input[type="checkbox"]')) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.onchange = () => window.toggleBudgetItem(checkbox);
        firstCell.prepend(checkbox);
      }
      const statusCell = cells[cells.length - 1];
      if (!statusCell.querySelector('span')) {
        statusCell.textContent = '';
        const span = document.createElement('span');
        span.className = 'status-pending';
        span.textContent = 'Pending';
        statusCell.appendChild(span);
      }
    });
  }

  // Initialize widget rendering
  window.initializeWidgets = () => {
    // Wait a bit for the DOM to be ready
    setTimeout(() => {
      // Try multiple selectors to find widget containers
      const selectors = [
        '.widget-content',
        '.affiliate-widget .widget-content',
        'div[class*="widget"]',
        '.affiliate-widgets-section .widget-content',
        'script[src*="tpwdgt.com"]'
      ];
      
      let widgetContainers = [];
      let scripts = [];
      
      // Try each selector
      selectors.forEach(selector => {
        const found = document.querySelectorAll(selector);
        console.log(`Selector "${selector}" found:`, found.length);
        widgetContainers = widgetContainers.concat(Array.from(found));
      });
      
      // Also find all scripts that look like widgets
      const allScripts = document.querySelectorAll('script[src*="tpwdgt.com"]');
      console.log('Found tpwdgt scripts:', allScripts.length);
      
      // Process widget containers
      widgetContainers.forEach((container, index) => {
        console.log(`Processing widget container ${index + 1}:`, container.className);
        processWidgetContainer(container, index);
      });
      
      // Process standalone scripts
      allScripts.forEach((script, index) => {
        console.log(`Processing standalone script ${index + 1}:`, script.src);
        processStandaloneScript(script, index);
      });
      
      // If still no widgets found, try again after a longer delay
      if (widgetContainers.length === 0 && allScripts.length === 0) {
        setTimeout(() => {
          console.log('Retrying widget initialization...');
          initializeWidgets();
        }, 1000);
      }
      
      console.log('Widget rendering initialized');
    }, 500); // Increased delay to ensure DOM is fully ready
  };

  // Helper function to process widget containers
  function processWidgetContainer(container, index) {
    const scripts = container.querySelectorAll('script');
    console.log(`Found ${scripts.length} scripts in container ${index + 1}`);
    
    scripts.forEach((script, scriptIndex) => {
      console.log(`Processing script ${scriptIndex + 1}:`, script.src);
      processScript(script, scriptIndex);
    });
  }

  // Helper function to process standalone scripts
  function processStandaloneScript(script, index) {
    console.log(`Processing standalone script ${index + 1}:`, script.src);
    processScript(script, index);
  }

  // Helper function to process any script
  function processScript(script, index) {
    // Create a new script element to execute the widget
    const newScript = document.createElement('script');
    newScript.src = script.src;
    newScript.async = script.async;
    newScript.charset = script.charset;
    
    // Add error handling
    newScript.onerror = () => {
      console.log('❌ Widget script failed to load:', script.src);
    };
    
    newScript.onload = () => {
      console.log('✅ Widget script loaded successfully:', script.src);
    };
    
    // Replace the old script with the new one
    script.parentNode.replaceChild(newScript, script);
  }

  // Define missing toggle functions
  window.toggleItem = (checkbox) => {
    const label = checkbox.nextElementSibling;
    if (checkbox.checked) {
      label.classList.add('checked');
      showNotification('✅ Item checked off!', 'success');
    } else {
      label.classList.remove('checked');
      showNotification('📝 Item unchecked', 'info');
    }
  };

  // Checkbox functionality for Budget Items
  window.toggleBudgetItem = (checkbox) => {
    const row = checkbox.closest('tr');
    const statusCell = row.querySelector('td:last-child span');
    
    if (checkbox.checked) {
      statusCell.textContent = 'Completed';
      statusCell.className = 'status-completed';
      row.style.backgroundColor = '#f0fdf4';
      showNotification('✅ Budget item completed!', 'success');
    } else {
      statusCell.textContent = 'Pending';
      statusCell.className = 'status-pending';
      row.style.backgroundColor = '';
      showNotification('📝 Budget item marked as pending', 'info');
    }
  };

})();
// Trigger redeploy for manual signup fix
