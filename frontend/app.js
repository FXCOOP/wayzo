// app.js — form UX + preview/plan flow
(function () {
  const $ = (sel) => document.querySelector(sel);

  const form      = $('#tripForm');
  const previewEl = $('#preview');
  const loadingEl = $('#loading');
  const pdfBtn    = $('#pdfBtn');
  const buyBtn    = $('#buyBtn');
  const saveBtn   = $('#saveBtn');

  // Travelers (adults/kids + dynamic ages)
  const kidsInput = $('#kids');
  const kidsAgesWrap = $('#kidsAgesWrap');

  function renderKidsAges() {
    const k = Number(kidsInput.value || 0);
    kidsAgesWrap.innerHTML = '';
    if (k <= 0) { kidsAgesWrap.classList.add('hidden'); return; }
    kidsAgesWrap.classList.remove('hidden');
    kidsAgesWrap.insertAdjacentHTML('beforeend', `<span class="small">Ages:</span>`);
    for (let i = 0; i < k; i++) {
      const sel = document.createElement('select');
      sel.name = 'kids_age_' + i;
      for (let a = 0; a <= 17; a++) {
        const opt = document.createElement('option');
        opt.value = String(a);
        opt.textContent = a;
        sel.appendChild(opt);
      }
      kidsAgesWrap.appendChild(sel);
    }
  }
  kidsInput?.addEventListener('input', renderKidsAges);
  renderKidsAges();

  // Show/Hide helpers
  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');

  // Affiliate anchors
  const setAffiliates = (dest) => {
    const q = encodeURIComponent(dest || '');
    const set = (id, url) => { const a = $(id); if (a) a.href = url; };
    set('#linkMaps',      `https://www.google.com/maps/search/?api=1&query=${q}`);
    set('#linkFlights',   `https://www.kayak.com/flights?search=${q}`);
    set('#linkHotels',    `https://www.booking.com/searchresults.html?ss=${q}`);
    set('#linkActivities',`https://www.getyourguide.com/s/?q=${q}`);
    set('#linkCars',      `https://www.rentalcars.com/SearchResults.do?destination=${q}`);
    set('#linkInsurance', `https://www.worldnomads.com/`);
    set('#linkReviews',   `https://www.tripadvisor.com/Search?q=${q}`);
  };

  // Gather form data
  function readForm() {
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());

    const ages = [];
    const kids = Number(data.kids || 0);
    for (let i = 0; i < kids; i++) {
      const v = fd.get('kids_age_' + i);
      if (v !== null && v !== undefined) ages.push(Number(v));
    }

    return {
      destination: data.destination || '',
      start: data.start || '',
      end: data.end || '',
      budget: Number(data.budget || 0),
      currency: data.currency || 'USD',
      adults: Number(data.adults || 2),
      kids: kids,
      kids_ages: ages,
      style: data.style || 'mid',
      prefs: data.prefs || '',
      diet: data.diet || '',
      special: data.special || '',
      todo: data.todo || '',
    };
  }

  // Preview
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = readForm();
    setAffiliates(payload.destination);
    hide(pdfBtn); show(loadingEl);

    try {
      const res = await fetch('/api/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      previewEl.innerHTML = out.teaser_html || '<p>Preview created.</p>';
    } catch {
      previewEl.innerHTML = '<p class="muted">Preview failed. Please try again.</p>';
    } finally {
      hide(loadingEl);
    }
  });

  // Full plan
  buyBtn?.addEventListener('click', async () => {
    const payload = readForm();
    setAffiliates(payload.destination);
    hide(pdfBtn); show(loadingEl);

    try {
      const res = await fetch('/api/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (out.html) {
        previewEl.innerHTML = `<div class="markdown">${out.html}</div>`;
      } else {
        const md = (out.markdown || '').trim();
        previewEl.innerHTML = md ? `<div class="markdown" style="white-space:pre-wrap">${md}</div>` : '<p>Plan generated.</p>';
      }
      if (out.id) { pdfBtn.href = `/api/plan/${out.id}/pdf`; show(pdfBtn); }
    } catch {
      previewEl.innerHTML = '<p class="muted">Plan failed. Please try again.</p>';
    } finally {
      hide(loadingEl);
    }
  });

  // Save preview (local)
  saveBtn?.addEventListener('click', () => {
    try {
      const html = previewEl.innerHTML || '';
      localStorage.setItem('wayzo_preview', html);
      alert('Preview saved on this device.');
    } catch {}
  });

  // Restore last preview
  const last = localStorage.getItem('wayzo_preview');
  if (last) previewEl.innerHTML = last;
})();
