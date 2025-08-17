// app.js  — resilient bindings + preview/plan flows

(function () {
  const $ = (sel) => document.querySelector(sel);

  const form       = $('#tripForm');
  const previewEl  = $('#preview');
  const loadingEl  = $('#loading');
  const pdfBtn     = $('#pdfBtn');
  const buyBtn     = $('#buyBtn');
  const saveBtn    = $('#saveBtn');

  if (!form || !previewEl) return; // nothing to wire up

  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');

  const readForm = () => {
    const data = Object.fromEntries(new FormData(form).entries());
    data.travelers = Number(data.travelers || 2);
    data.budget    = Number(data.budget || 0);
    data.level     = data.level || 'budget';
    return data;
  };

  const setAffiliates = (dest) => {
    const q = encodeURIComponent(dest || '');
    const set = (id, url) => { const a = $(id); if (a) a.href = url; };
    set('#linkFlights',   `https://www.kayak.com/flights?search=${q}`);
    set('#linkHotels',    `https://www.booking.com/searchresults.html?ss=${q}`);
    set('#linkActivities',`https://www.getyourguide.com/s/?q=${q}`);
    set('#linkCars',      `https://www.rentalcars.com/SearchResults.do?destination=${q}`);
    set('#linkReviews',   `https://www.tripadvisor.com/Search?q=${q}`);
  };

  // Preview
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = readForm();
    setAffiliates(payload.destination);
    hide(pdfBtn);
    hide(loadingEl);
    show(loadingEl);

    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const out = await res.json();
      previewEl.innerHTML = out.teaser_html || '<p>Preview created.</p>';
    } catch (err) {
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
      const md = (out.markdown || '').trim();
      previewEl.innerHTML = md
        ? `<div class="markdown" style="white-space:pre-wrap">${md}</div>`
        : '<p>Plan generated.</p>';

      if (out.id) {
        pdfBtn.href = `/api/plan/${out.id}/pdf`;
        show(pdfBtn);
      }
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
