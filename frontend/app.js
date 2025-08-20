// app.js — preview/plan flow + live counters + affiliate anchors + children age UI
(function () {
  const $ = (sel) => document.querySelector(sel);

  const form      = $('#tripForm');
  const previewEl = $('#preview');
  const loadingEl = $('#loading');
  const pdfBtn    = $('#pdfBtn');
  const buyBtn    = $('#buyBtn');
  const saveBtn   = $('#saveBtn');

  // travelers fields
  const adultsEl   = $('#adults');
  const childrenEl = $('#children');
  const agesWrap   = $('#childAgesWrap');

  if (!form || !previewEl) return;

  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');

  // dynamic child ages
  function renderAgeSelects() {
    const n = Math.max(0, Number(childrenEl.value || 0));
    if (!agesWrap) return;
    if (n === 0) { agesWrap.innerHTML = ''; return; }
    let html = '<div style="display:flex;flex-wrap:wrap;gap:6px"><span style="margin-right:6px">Ages:</span>';
    for (let i = 0; i < n; i++) {
      html += `<select class="child-age" aria-label="Child ${i+1} age">
        ${Array.from({length:18}).map((_,a)=>`<option value="${a}">${a}</option>`).join('')}
      </select>`;
    }
    html += '</div>';
    agesWrap.innerHTML = html;
  }
  childrenEl?.addEventListener('input', renderAgeSelects);
  renderAgeSelects();

  // collect data
  function readForm() {
    const data = Object.fromEntries(new FormData(form).entries());
    data.adults    = Number(data.adults || 2);
    data.children  = Number(data.children || 0);
    data.childAges = Array.from(document.querySelectorAll('.child-age')).map(s => Number(s.value));
    data.budget    = Number(data.budget || 0);
    data.level     = data.level || 'mid';
    data.currency  = data.currency || 'USD';
    // rename long inputs
    data.special   = data.special || '';
    data.todo      = data.todo || '';
    return data;
  }

  // affiliate quick links
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

  // Preview
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = readForm();
    setAffiliates(payload.destination);
    hide(pdfBtn);
    show(loadingEl);

    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      previewEl.innerHTML = out.teaser_html || '<p>Preview created.</p>';
      previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    hide(pdfBtn);
    show(loadingEl);

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      if (out.html) {
        previewEl.innerHTML = `<div class="markdown">${out.html}</div>`;
      } else {
        const md = (out.markdown || '').trim();
        previewEl.innerHTML = md
          ? `<div class="markdown" style="white-space:pre-wrap">${md}</div>`
          : '<p>Plan generated.</p>';
      }
      if (out.id) {
        pdfBtn.href = `/api/plan/${out.id}/pdf`;
        show(pdfBtn);
      }
      previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      previewEl.innerHTML = '<p class="muted">Plan failed. Please try again.</p>';
    } finally {
      hide(loadingEl);
    }
  });

  // Save preview locally
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
