// app.js — Enhanced Wayzo trip planner with Google OAuth, analytics, and advanced features

(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Global state
  let currentUser = null;
  let analyticsData = {
    totalPlans: 0,
    todayPlans: 0,
    affiliateClicks: 0,
    conversionRate: 0,
    destinations: {},
    revenue: {}
  };

  // Form elements
  const form = $('#tripForm');
  const previewEl = $('#preview');
  const loadingEl = $('#loading');
  const pdfBtn = $('#pdfBtn');
  const fullPlanBtn = $('#fullPlanBtn');
  const saveBtn = $('#saveBtn');
  const loginBtn = $('#loginBtn');
  const analyticsPanel = $('#analyticsPanel');
  const closeAnalytics = $('#closeAnalytics');

  if (!form || !previewEl) return; // nothing to wire up

  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');
  const toggle = (el) => el && el.classList.toggle('hidden');

  // Google OAuth Configuration
  const GOOGLE_CLIENT_ID = '895305213685-espndkeltc09u250gvtj6jncqp149jpo.apps.googleusercontent.com';
  
  // Initialize Google OAuth
  const initializeGoogleAuth = () => {
    if (typeof google !== 'undefined' && google.accounts) {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn
      });
      
      google.accounts.id.renderButton(loginBtn, {
        theme: 'outline',
        size: 'medium',
        text: 'signin_with'
      });
    }
  };

  // Handle Google sign in
  const handleGoogleSignIn = (response) => {
    const credential = response.credential;
    const payload = JSON.parse(atob(credential.split('.')[1]));
    
    currentUser = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    };
    
    // Update UI
    loginBtn.textContent = currentUser.name;
    loginBtn.onclick = showUserMenu;
    
    // Save user data
    localStorage.setItem('wayzo_user', JSON.stringify(currentUser));
    
    // Track sign in
    trackEvent('user_signin', { method: 'google' });
  };

  // Show user menu
  const showUserMenu = () => {
    const menu = document.createElement('div');
    menu.className = 'user-menu';
    menu.innerHTML = `
      <div class="user-menu-header">
        <img src="${currentUser.picture}" alt="${currentUser.name}" class="user-avatar" />
        <div>
          <div class="user-name">${currentUser.name}</div>
          <div class="user-email">${currentUser.email}</div>
        </div>
      </div>
      <div class="user-menu-actions">
        <button onclick="showAnalytics()" class="menu-item">Analytics</button>
        <button onclick="signOut()" class="menu-item">Sign Out</button>
      </div>
    `;
    
    // Position and show menu
    const rect = loginBtn.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = `${rect.bottom + 8}px`;
    menu.style.right = '20px';
    menu.style.zIndex = '1000';
    
    document.body.appendChild(menu);
    
    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', () => {
        if (document.body.contains(menu)) {
          document.body.removeChild(menu);
        }
      }, { once: true });
    }, 100);
  };

  // Sign out
  const signOut = () => {
    currentUser = null;
    localStorage.removeItem('wayzo_user');
    loginBtn.textContent = 'Sign In';
    loginBtn.onclick = () => google.accounts.id.prompt();
    hide(analyticsPanel);
  };

  // Enhanced form reading with all new fields
  const readForm = () => {
    const data = Object.fromEntries(new FormData(form).entries());
    
    // Parse numbers
    data.adults = Number(data.adults || 2);
    data.children = Number(data.children || 0);
    data.budget = Number(data.budget || 0);
    data.duration = Number(data.duration || 5);
    
    // Handle date modes
    if (data.dateMode === 'flexible') {
      data.flexibleDates = {
        month: data.travelMonth,
        duration: data.duration
      };
      delete data.start;
      delete data.end;
    }
    
    // Handle children ages
    if (data.children > 0) {
      data.childrenAges = [];
      $$('.age-input input').forEach(input => {
        if (input.value) {
          data.childrenAges.push(Number(input.value));
        }
      });
    }
    
    // Handle dietary preferences
    if (data.dietary) {
      data.dietary = Array.isArray(data.dietary) ? data.dietary : [data.dietary];
      data.dietary = data.dietary.filter(d => d !== 'none');
    }
    
    // Handle file uploads
    const fileInput = $('#planFiles');
    if (fileInput.files.length > 0) {
      data.uploadedFiles = Array.from(fileInput.files).map(file => ({
        name: file.name,
        size: file.size,
        type: file.type
      }));
    }
    
    // Clean up brief text
    if (data.brief) {
      data.brief = data.brief.trim();
      if (data.brief) {
        data.professional_brief = data.brief;
      }
    }
    
    return data;
  };

  // Dynamic children ages handling
  const setupChildrenAges = () => {
    const childrenInput = $('#children');
    const agesContainer = $('#childrenAges');
    const agesInputs = $('#agesContainer');
    
    const updateAges = () => {
      const count = Number(childrenInput.value) || 0;
      agesInputs.innerHTML = '';
      
      if (count > 0) {
        show(agesContainer);
        for (let i = 0; i < count; i++) {
          const ageDiv = document.createElement('div');
          ageDiv.className = 'age-input';
          ageDiv.innerHTML = `
            <label>Child ${i + 1}</label>
            <input type="number" min="1" max="17" placeholder="Age" />
          `;
          agesInputs.appendChild(ageDiv);
        }
      } else {
        hide(agesContainer);
      }
    };
    
    childrenInput.addEventListener('change', updateAges);
    updateAges(); // Initial setup
  };

  // Date mode handling
  const setupDateModes = () => {
    const dateModeInputs = $$('input[name="dateMode"]');
    const exactDates = $('#exactDates');
    const flexibleDates = $('#flexibleDates');
    
    const updateDateFields = () => {
      const mode = document.querySelector('input[name="dateMode"]:checked').value;
      if (mode === 'exact') {
        show(exactDates);
        hide(flexibleDates);
      } else {
        hide(exactDates);
        show(flexibleDates);
      }
    };
    
    dateModeInputs.forEach(input => {
      input.addEventListener('change', updateDateFields);
    });
    
    updateDateFields(); // Initial setup
  };

  // Set affiliate links for the destination
  const setAffiliates = (dest) => {
    const q = encodeURIComponent(dest || '');
    const set = (id, url) => { 
      const a = $(id); 
      if (a) a.href = url; 
    };
    
    // Set affiliate links (these will be added to the UI later)
    const affiliateLinks = {
      flights: `https://www.kayak.com/flights?search=${q}`,
      hotels: `https://www.booking.com/searchresults.html?ss=${q}`,
      activities: `https://www.getyourguide.com/s/?q=${q}`,
      cars: `https://www.rentalcars.com/SearchResults.do?destination=${q}`,
      reviews: `https://www.tripadvisor.com/Search?q=${q}`
    };
    
    return affiliateLinks;
  };

  // Enhanced preview generation
  const generatePreview = async (e) => {
    e.preventDefault();
    const payload = readForm();
    
    if (!payload.destination || !payload.budget) {
      previewEl.innerHTML = '<p class="error">Please fill in all required fields.</p>';
      return;
    }

    // Validate dates
    if (payload.dateMode === 'exact' && (!payload.start || !payload.end)) {
      previewEl.innerHTML = '<p class="error">Please select start and end dates.</p>';
      return;
    }

    const affiliateLinks = setAffiliates(payload.destination);
    hide(pdfBtn);
    hide(loadingEl);
    show(loadingEl);

    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      const out = await res.json();
      previewEl.innerHTML = out.teaser_html || '<p>Preview created successfully!</p>';
      
      // Add affiliate links below the preview
      if (out.affiliates && Object.keys(out.affiliates).length > 0) {
        const affiliateSection = createAffiliateSection(affiliateLinks);
        previewEl.appendChild(affiliateSection);
      }
      
      // Track preview generation
      trackEvent('preview_generated', { destination: payload.destination });
      
    } catch (err) {
      console.error('Preview error:', err);
      previewEl.innerHTML = '<p class="error">Preview failed. Please try again.</p>';
      trackEvent('preview_error', { error: err.message });
    } finally {
      hide(loadingEl);
    }
  };

  // Enhanced full plan generation
  const generateFullPlan = async () => {
    const payload = readForm();
    
    if (!payload.destination || !payload.budget) {
      previewEl.innerHTML = '<p class="error">Please fill in all required fields.</p>';
      return;
    }

    const affiliateLinks = setAffiliates(payload.destination);
    hide(pdfBtn);
    show(loadingEl);

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      const out = await res.json();
      
      if (out.html) {
        previewEl.innerHTML = out.html;
        
        // Add affiliate links and PDF button
        const affiliateSection = createAffiliateSection(affiliateLinks);
        previewEl.appendChild(affiliateSection);
        
        if (out.id) {
          pdfBtn.href = `/api/plan/${out.id}/pdf`;
          show(pdfBtn);
        }
        
        // Track full plan generation
        trackEvent('full_plan_generated', { 
          destination: payload.destination,
          planId: out.id 
        });
        
        // Update analytics
        updateAnalytics();
      } else {
        previewEl.innerHTML = '<p class="error">No plan generated. Please try again.</p>';
      }
      
    } catch (err) {
      console.error('Full plan error:', err);
      previewEl.innerHTML = '<p class="error">Plan generation failed. Please try again.</p>';
      trackEvent('full_plan_error', { error: err.message });
    } finally {
      hide(loadingEl);
    }
  };

  // Create affiliate links section with tracking
  const createAffiliateSection = (links) => {
    const section = document.createElement('div');
    section.className = 'affiliate-links';
    section.style.cssText = 'margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;';
    
    const title = document.createElement('h4');
    title.textContent = 'Book your trip:';
    title.style.cssText = 'margin: 0 0 16px 0; font-size: 1.1rem; color: var(--ink);';
    
    const linksContainer = document.createElement('div');
    linksContainer.style.cssText = 'display: flex; gap: 12px; flex-wrap: wrap;';
    
    const linkData = [
      { key: 'flights', label: '✈️ Flights', url: links.flights },
      { key: 'hotels', label: '🏨 Hotels', url: links.hotels },
      { key: 'activities', label: '🎟️ Activities', url: links.activities },
      { key: 'cars', label: '🚗 Cars', url: links.cars },
      { key: 'reviews', label: '⭐ Reviews', url: links.reviews }
    ];
    
    linkData.forEach(({ key, label, url }) => {
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = label;
        link.className = 'btn btn-ghost';
        link.style.cssText = 'font-size: 14px; padding: 8px 16px;';
        
        // Add click tracking
        link.addEventListener('click', () => {
          trackEvent('affiliate_click', { 
            type: key, 
            destination: currentDestination || 'unknown' 
          });
          analyticsData.affiliateClicks++;
          updateAnalyticsDisplay();
        });
        
        linksContainer.appendChild(link);
      }
    });
    
    section.appendChild(title);
    section.appendChild(linksContainer);
    return section;
  };

  // Analytics functions
  const showAnalytics = () => {
    if (!currentUser) return;
    
    updateAnalytics();
    analyticsPanel.classList.add('show');
  };

  const updateAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics');
      if (res.ok) {
        analyticsData = await res.json();
        updateAnalyticsDisplay();
      }
    } catch (err) {
      console.error('Analytics error:', err);
    }
  };

  const updateAnalyticsDisplay = () => {
    $('#totalPlans').textContent = analyticsData.totalPlans;
    $('#todayPlans').textContent = analyticsData.todayPlans;
    $('#affiliateClicks').textContent = analyticsData.affiliateClicks;
    $('#conversionRate').textContent = `${analyticsData.conversionRate}%`;
  };

  // Event tracking
  const trackEvent = (event, data = {}) => {
    const eventData = {
      event,
      timestamp: new Date().toISOString(),
      userId: currentUser?.id || 'anonymous',
      ...data
    };
    
    // Send to backend
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    }).catch(err => console.error('Tracking error:', err));
    
    // Also log locally
    console.log('Event tracked:', eventData);
  };

  // Save preview to localStorage
  const savePreview = () => {
    try {
      const html = previewEl.innerHTML || '';
      if (html && !html.includes('error')) {
        localStorage.setItem('wayzo_preview', html);
        alert('Preview saved successfully!');
        trackEvent('preview_saved');
      } else {
        alert('Nothing to save. Generate a preview first.');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save preview.');
    }
  };

  // Restore last preview from localStorage
  const restoreLastPreview = () => {
    try {
      const last = localStorage.getItem('wayzo_preview');
      if (last && last !== previewEl.innerHTML) {
        if (confirm('Restore your last saved preview?')) {
          previewEl.innerHTML = last;
          trackEvent('preview_restored');
        }
      }
    } catch (err) {
      console.error('Restore error:', err);
    }
  };

  // Initialize IP-based location detection
  const detectUserLocation = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      
      if (data.city && data.country) {
        const fromInput = $('#from');
        fromInput.placeholder = `${data.city}, ${data.country}`;
        fromInput.dataset.defaultLocation = `${data.city}, ${data.country}`;
      }
    } catch (err) {
      console.error('Location detection failed:', err);
    }
  };

  // Add some helpful UI enhancements
  const addUIEnhancements = () => {
    // Add today's date as default start date
    const startInput = $('#start');
    if (startInput) {
      const today = new Date().toISOString().split('T')[0];
      startInput.value = today;
      
      // Set end date to 5 days later
      const endInput = $('#end');
      if (endInput) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 5);
        endInput.value = endDate.toISOString().split('T')[0];
      }
    }
    
    // Set current month for flexible dates
    const monthInput = $('#travelMonth');
    if (monthInput) {
      const now = new Date();
      const month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      monthInput.value = month;
    }
  };

  // Wire up events
  const wireUpEvents = () => {
    form.addEventListener('submit', generatePreview);
    fullPlanBtn?.addEventListener('click', generateFullPlan);
    saveBtn?.addEventListener('click', savePreview);
    closeAnalytics?.addEventListener('click', () => {
      analyticsPanel.classList.remove('show');
    });
    
    // Close analytics on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        analyticsPanel.classList.remove('show');
      }
    });
  };

  // Initialize everything
  const init = () => {
    // Check for existing user
    const savedUser = localStorage.getItem('wayzo_user');
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      loginBtn.textContent = currentUser.name;
      loginBtn.onclick = showUserMenu;
    } else {
      loginBtn.onclick = () => google.accounts.id.prompt();
    }
    
    // Setup form enhancements
    setupChildrenAges();
    setupDateModes();
    addUIEnhancements();
    
    // Wire up events
    wireUpEvents();
    
    // Restore last preview
    restoreLastPreview();
    
    // Detect user location
    detectUserLocation();
    
    // Initialize Google Auth
    initializeGoogleAuth();
    
    // Initialize cookie consent
    initializeCookieConsent();
    
    // Track page view
    trackEvent('page_view', { path: window.location.pathname });
  };

  // Cookie consent functionality
  const initializeCookieConsent = () => {
    const cookieBanner = $('#cookieBanner');
    const acceptBtn = $('#acceptCookies');
    const rejectBtn = $('#rejectCookies');
    
    if (!cookieBanner) return;
    
    // Check if user has already made a choice
    const cookieChoice = localStorage.getItem('wayzo_cookie_choice');
    if (cookieChoice) {
      // User has already made a choice, hide banner
      hide(cookieBanner);
      return;
    }
    
    // Show banner after a short delay
    setTimeout(() => {
      cookieBanner.classList.add('show');
    }, 1000);
    
    // Handle accept all cookies
    acceptBtn?.addEventListener('click', () => {
      localStorage.setItem('wayzo_cookie_choice', 'accept_all');
      localStorage.setItem('wayzo_cookies_enabled', 'true');
      hide(cookieBanner);
      trackEvent('cookie_consent', { choice: 'accept_all' });
    });
    
    // Handle reject non-essential cookies
    rejectBtn?.addEventListener('click', () => {
      localStorage.setItem('wayzo_cookie_choice', 'reject_non_essential');
      localStorage.setItem('wayzo_cookies_enabled', 'false');
      hide(cookieBanner);
      trackEvent('cookie_consent', { choice: 'reject_non_essential' });
    });
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
