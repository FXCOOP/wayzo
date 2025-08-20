// app.js — preview/plan flow + live counters + affiliate anchors
(function () {
  const $ = (sel) => document.querySelector(sel);

  const form      = $('#tripForm');
  const previewEl = $('#preview');
  const loadingEl = $('#loading');
  const pdfBtn    = $('#pdfBtn');
  const buyBtn    = $('#buyBtn');
  const saveBtn   = $('#saveBtn');
  const briefEl   = $('#brief');
  const countEl   = $('#briefCount');

  if (!form || !previewEl) return;

  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');

  // word counter for the brief (works even if the details panel is closed)
  const countBrief = () => {
    const t = (briefEl?.value || '').trim();
    const words = t ? t.split(/\s+/).length : 0;
    const chars = t.length;
    if (countEl) countEl.textContent = `${words} words • ${chars} chars`;
  };
  briefEl?.addEventListener('input', countBrief);
  countBrief();

  const readForm = () => {
    const data = Object.fromEntries(new FormData(form).entries());
    data.travelers = Number(data.travelers || 2);
    data.budget    = Number(data.budget || 0);
    data.level     = data.level || 'budget';
    data.brief     = data.brief || '';
    return data;
  };

  // Affiliate + maps links
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

      // Prefer server-rendered HTML; fallback to Markdown
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
