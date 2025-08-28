// app.js — Enhanced Wayzo trip planner with professional brief support

(function () {
  const $ = (sel) => document.querySelector(sel);

  // Form elements
  const form = $('#tripForm');
  const previewEl = $('#preview');
  const loadingEl = $('#loading');
  const pdfBtn = $('#pdfBtn');
  const fullPlanBtn = $('#fullPlanBtn');
  const saveBtn = $('#saveBtn');

  if (!form || !previewEl) return; // nothing to wire up

  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');

  // Enhanced form reading with professional brief
  const readForm = () => {
    const data = Object.fromEntries(new FormData(form).entries());
    data.travelers = Number(data.travelers || 2);
    data.budget = Number(data.budget || 0);
    data.level = data.level || 'budget';
    
    // Clean up brief text if provided
    if (data.brief) {
      data.brief = data.brief.trim();
      if (data.brief) {
        data.professional_brief = data.brief; // Add to payload for AI
      }
    }
    
    return data;
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

  // Create affiliate links section
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
        linksContainer.appendChild(link);
      }
    });
    
    section.appendChild(title);
    section.appendChild(linksContainer);
    return section;
  };

  // Save preview to localStorage
  const savePreview = () => {
    try {
      const html = previewEl.innerHTML || '';
      if (html && !html.includes('error')) {
        localStorage.setItem('wayzo_preview', html);
        alert('Preview saved successfully!');
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
        }
      }
    } catch (err) {
      console.error('Restore error:', err);
    }
  };

  // Enhanced full plan generation
  const generateFullPlan = async () => {
    const payload = readForm();
    
    if (!payload.destination || !payload.start || !payload.end || !payload.budget) {
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
      } else {
        previewEl.innerHTML = '<p class="error">No plan generated. Please try again.</p>';
      }
      
    } catch (err) {
      console.error('Full plan error:', err);
      previewEl.innerHTML = '<p class="error">Plan generation failed. Please try again.</p>';
    } finally {
      hide(loadingEl);
    }
  };

  // Helper to optionally prompt sign-in (only for full plan)
  const maybePromptSignIn = async () => {
    if (currentUser) return true;
    try {
      if (window.google && google.accounts && google.accounts.id && typeof google.accounts.id.prompt === 'function') {
        await new Promise((resolve) => {
          google.accounts.id.prompt(() => resolve());
          setTimeout(resolve, 2500);
        });
      }
    } catch (_) {}
    const savedUser = localStorage.getItem('wayzo_user');
    if (savedUser && !currentUser) currentUser = JSON.parse(savedUser);
    return !!currentUser;
  };

  // Preview should NOT be gated; keep it simple and reliable
  const generatePreview = async (e) => {
    e?.preventDefault?.();
    const payload = readForm();
    if (!payload.destination || !payload.budget) {
      previewEl.innerHTML = '<p class="error">Please fill in all required fields.</p>';
      return;
    }
    hide(pdfBtn); hide(icsBtn); show(loadingEl);
    try {
      const res = await fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = await res.json();
      previewEl.innerHTML = out.teaser_html || '<p>Preview created successfully!</p>';
      appendAffiliateSection(payload.destination, out);
      trackEvent('preview_generated', { destination: payload.destination });
    } catch (err) {
      console.error('Preview error:', err);
      previewEl.innerHTML = '<p class="error">Preview failed. Please try again.</p>';
    } finally { hide(loadingEl); }
  };

  // Bind click handlers after redefining generatePreview
  form.addEventListener('submit', generatePreview);
  fullPlanBtn?.addEventListener('click', generateFullPlan);
  saveBtn?.addEventListener('click', savePreview);

  // Restore last preview on page load
  restoreLastPreview();

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
  };

  // Initialize UI enhancements
  addUIEnhancements();

  // Paywall state
  let hasPaid = false;

  // Dynamically load PayPal SDK
  const loadPayPalSdk = async (clientId) => {
    if (!clientId) return;
    if (window.paypal) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD`;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  };

  // Render PayPal button
  const renderPayPalButton = async () => {
    try {
      const cfg = window.WAYZO_PUBLIC_CONFIG || {};
      if (!cfg.PAYPAL_CLIENT_ID) return;
      await loadPayPalSdk(cfg.PAYPAL_CLIENT_ID);
      const price = String(cfg.REPORT_PRICE_USD || 19);
      const containerSel = '#paypal-button-container';
      const container = document.querySelector(containerSel);
      if (!container) return;
      container.classList.remove('hidden');
      const note = document.querySelector('#purchaseNote');
      if (note) note.classList.remove('hidden');
      window.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
        createOrder: (data, actions) => actions.order.create({
          purchase_units: [{ amount: { value: price, currency_code: 'USD' } }]
        }),
        onApprove: (data, actions) => actions.order.capture().then(async (details) => {
          try {
            await fetch('/api/pay/confirm', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderID: data.orderID, total: price, currency: 'USD' })
            });
          } catch (e) { console.warn('Confirm send failed:', e); }
          hasPaid = true;
          alert('Payment successful. Full report unlocked.');
          // Auto-generate full plan now that payment is confirmed
          await generateFullPlan();
          // Hide purchase UI
          container.classList.add('hidden');
          if (note) note.classList.add('hidden');
        }),
        onError: (err) => { console.error('PayPal error:', err); alert('Payment error. Please try again.'); }
      }).render(containerSel);
    } catch (e) { console.error('PayPal init failed:', e); }
  };

  // Ensure PayPal is loaded if configured
  const preparePaywallUi = async () => {
    const cfg = window.WAYZO_PUBLIC_CONFIG || {};
    if (!cfg.PAYPAL_CLIENT_ID) return false;
    await loadPayPalSdk(cfg.PAYPAL_CLIENT_ID);
    return true;
  };

  // Bind full plan with sign-in + paywall
  const bindPaywall = () => {
    if (!fullPlanBtn) return;
    fullPlanBtn.onclick = async (e) => {
      e.preventDefault();
      const signed = await maybePromptSignIn();
      if (!signed) {
        alert('Please sign in to continue.');
        return;
      }
      const cfg = window.WAYZO_PUBLIC_CONFIG || {};
      if (cfg.PAYPAL_CLIENT_ID && !hasPaid) {
        const ok = await preparePaywallUi();
        await renderPayPalButton();
        const note = document.querySelector('#purchaseNote');
        if (note) note.classList.remove('hidden');
        return; // Wait for payment approval to auto-call generateFullPlan
      }
      return generateFullPlan();
    };
  };

  // Payment confirm endpoint helper (backend must exist)
  // (No-op here; handled in onApprove)

  // Init: avoid referencing google if not loaded
  const init = () => {
    const savedUser = localStorage.getItem('wayzo_user');
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      if (loginBtn) { loginBtn.textContent = currentUser.name; loginBtn.onclick = showUserMenu; }
    } else {
      ensureLoginVisible();
      if (loginBtn) loginBtn.onclick = () => (window.google && google.accounts && google.accounts.id && google.accounts.id.prompt ? google.accounts.id.prompt() : alert('Sign-in temporarily unavailable.'));
    }
    setupChildrenAges();
    setupDateModes();
    addUIEnhancements();
    wireUpEvents();
    bindPaywall();
    restoreLastPreview();
    detectUserLocation();
    initializeGoogleAuth();
    initializeCookieConsent();
    trackEvent('page_view', { path: window.location.pathname });
  };

})();
