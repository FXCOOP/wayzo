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

  // Enhanced preview generation
  const generatePreview = async (e) => {
    e.preventDefault();
    const payload = readForm();
    
    if (!payload.destination || !payload.start || !payload.end || !payload.budget) {
      previewEl.innerHTML = '<p class="error">Please fill in all required fields.</p>';
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
      
    } catch (err) {
      console.error('Preview error:', err);
      previewEl.innerHTML = '<p class="error">Preview failed. Please try again.</p>';
    } finally {
      hide(loadingEl);
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
