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
  const icsBtn = document.querySelector('#icsBtn');
  
  // Make login more visible if Google API not ready
  const ensureLoginVisible = () => {
    if (loginBtn) loginBtn.classList.add('btn-primary');
  };

  // Initialize Google OAuth
  const initializeGoogleAuth = () => {
    if (typeof google !== 'undefined' && google.accounts) {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn
      });
      
      google.accounts.id.renderButton(loginBtn, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill'
      });
    } else {
      ensureLoginVisible();
    }
  };

  // Checklist builder
  const buildChecklistFromPlan = (container, planId) => {
    try {
      const headings = container.querySelectorAll('h2, h3');
      const items = [];
      headings.forEach(h => {
        const t = (h.textContent || '').trim();
        if (/^Day\s+\d+/i.test(t)) {
          let el = h.nextElementSibling;
          let collected = 0;
          while (el && collected < 10 && !/^H[23]$/.test(el.tagName)) {
            if (el.tagName === 'UL' || el.tagName === 'OL') {
              el.querySelectorAll('li').forEach(li => {
                const text = li.textContent.trim();
                if (text.length > 0) items.push(text);
              });
              collected += 1;
            }
            el = el.nextElementSibling;
          }
        }
      });
      if (items.length === 0) return;
      const stateKey = `wayzo_checklist_${planId}`;
      const saved = JSON.parse(localStorage.getItem(stateKey) || '[]');
      const wrap = document.createElement('section');
      wrap.className = 'card';
      const header = document.createElement('div');
      header.className = 'card-header';
      header.innerHTML = '<h2>Trip Checklist</h2>';
      const list = document.createElement('div');
      list.style.cssText = 'display:grid;gap:8px;margin:12px 0;';
      items.slice(0, 40).forEach((text, idx) => {
        const id = `${planId}_${idx}`;
        const row = document.createElement('label');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = saved.includes(id);
        cb.addEventListener('change', () => {
          const cur = new Set(JSON.parse(localStorage.getItem(stateKey) || '[]'));
          if (cb.checked) cur.add(id); else cur.delete(id);
          localStorage.setItem(stateKey, JSON.stringify(Array.from(cur)));
        });
        const span = document.createElement('span');
        span.textContent = text;
        row.appendChild(cb);
        row.appendChild(span);
        list.appendChild(row);
      });
      wrap.appendChild(header);
      wrap.appendChild(list);
      container.prepend(wrap);
    } catch (e) { console.warn('Checklist build failed:', e); }
  };

  // Always render affiliate section (fallback to generated from dest)
  const appendAffiliateSection = (dest, out) => {
    const affiliateLinks = setAffiliates(dest);
    const affiliateSection = createAffiliateSection(affiliateLinks);
    previewEl.appendChild(affiliateSection);
  };

  // Enhanced full plan generation
  const generateFullPlan = async () => {
    const payload = readForm();
    
    if (!payload.destination || !payload.budget) {
      previewEl.innerHTML = '<p class="error">Please fill in all required fields.</p>';
      return;
    }

    hide(pdfBtn);
    hide(icsBtn);
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
        
        // Add affiliate links and PDF/ICS buttons
        appendAffiliateSection(payload.destination, out);
        
        if (out.id) {
          pdfBtn.href = `/api/plan/${out.id}/pdf`;
          icsBtn.href = `/api/plan/${out.id}/ics`;
          show(pdfBtn);
          show(icsBtn);
          // Build interactive checklist
          buildChecklistFromPlan(previewEl, out.id);
        }
        
        trackEvent('full_plan_generated', { 
          destination: payload.destination,
          planId: out.id 
        });
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

  // Wire up events
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

})();
