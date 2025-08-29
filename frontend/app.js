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
  const detectUserLocation = async () => {};
  
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
      if (a) a.href = url; 
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
          <a id="flightsLink" href="${links.flights}" target="_blank" class="affiliate-link">✈️ Flights</a>
          <a id="hotelsLink" href="${links.hotels}" target="_blank" class="affiliate-link">🏨 Hotels</a>
          <a id="activitiesLink" href="${links.activities}" target="_blank" class="affiliate-link">🎟️ Activities</a>
          <a id="carsLink" href="${links.cars}" target="_blank" class="affiliate-link">🚗 Cars</a>
          <a id="reviewsLink" href="${links.reviews}" target="_blank" class="affiliate-link">⭐ Reviews</a>
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

  // Form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Check if user is authenticated for preview
    if (!isAuthenticated) {
      showNotification('Please sign in to generate trip previews.', 'warning');
      showAuthModal();
      return;
    }
    
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
      
      // Show preview and hide loading
      hide(loadingEl);
      show(previewEl);
      
      // Show action buttons
      show(pdfBtn);
      show(icsBtn);
      show(saveBtn);
      
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
    // Check if user is authenticated for full plan
    if (!isAuthenticated) {
      showNotification('Please sign in to access the full trip plan.', 'warning');
      showAuthModal();
      return;
    }
    
    const data = readForm();
    console.log('Generating full plan for:', data);
    
    // Show loading
    hide(previewEl);
    show(loadingEl);
    
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
      
      // Don't show the full plan content until payment is completed
      // Just show a simple converting paywall
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
      
      // Show paywall for conversion
      show($('#purchaseActions'));
      // Hide all download buttons until payment
      hide(pdfBtn);
      hide(icsBtn);
      hide($('#excelBtn'));
      hide($('#shareBtn'));
      
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
  const initializePayPalButtons = () => {
    try {
      // Check if PayPal SDK is loaded
      if (typeof paypal === 'undefined') {
        console.error('PayPal SDK not loaded');
        showPayPalFallback();
        return;
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
            
            // Hide paywall and show download options
            hide($('#purchaseActions'));
            show($('#pdfBtn'));
            show($('#icsBtn'));
            show($('#excelBtn'));
            show($('#shareBtn'));
            
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

  // Main initialization
  const init = () => {
    setupDateModes();
    setupChildrenAges();
    addUIEnhancements();
    initGoogleFromConfig();
    bindPaywall();
    
    // Initialize cookie consent
    initializeCookieConsent();
    
    // Detect user location
    detectUserLocation();
    
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
    // Simulate authentication
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
    // Simulate registration
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
    
    // Create PDF content
    const pdfContent = `
      <html>
        <head>
          <title>Wayzo Trip Plan</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .content { line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🚀 Wayzo Trip Plan</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          <div class="content">
            ${content}
          </div>
        </body>
      </html>
    `;
    
    // Open PDF content in new window/tab
    const newWindow = window.open('', '_blank');
    newWindow.document.write(pdfContent);
    newWindow.document.close();
    
    showNotification('PDF opened in new tab!', 'success');
  }

  function downloadICS() {
    const formData = readForm();
    if (!formData.destination || !formData.start) {
      showNotification('Please generate a plan with dates first.', 'warning');
      return;
    }
    
    // Create ICS content
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
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
    
    // Download ICS file
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trip-${formData.destination.toLowerCase()}.ics`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showNotification('Calendar file downloaded!', 'success');
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

  function sharePlan() {
    const formData = readForm();
    if (!formData.destination) {
      showNotification('Please generate a plan first.', 'warning');
      return;
    }
    
    const shareText = `Check out my trip to ${formData.destination} planned with Wayzo! 🚀✈️`;
    const shareUrl = window.location.href;
    
    if (navigator.share) {
      navigator.share({
        title: 'My Wayzo Trip Plan',
        text: shareText,
        url: shareUrl
      });
    } else {
      // Fallback for browsers without native sharing
      navigator.clipboard.writeText(shareText + ' ' + shareUrl);
      showNotification('Trip details copied to clipboard!', 'success');
    }
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

})();
