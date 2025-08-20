// app.js — robust plan flow + uploads + counters + affiliate anchors
(function () {
  const $ = (sel) => document.querySelector(sel);

  const form       = $('#tripForm');
  const previewEl  = $('#preview');
  const loadingEl  = $('#loading');
  const pdfBtn     = $('#pdfBtn');
  const buyBtn     = $('#buyBtn');
  const saveBtn    = $('#saveBtn');

  const briefCount = (el, out) => {
    const t = (el?.value || '').trim();
    const words = t ? t.split(/\s+/).length : 0;
    const chars = t.length;
    if (out) out.textContent = `${words} words • ${chars} chars`;
  };

  // Ages row logic
  const adultsEl   = $('#adults');
  const childrenEl = $('#children');
  const agesRow    = $('#agesRow');

  function renderAgePickers() {
    const n = Math.max(0, Number(childrenEl.value || 0));
    agesRow.innerHTML = '';
    if (n <= 0) { agesRow.classList.add('hidden'); return; }
    agesRow.classList.remove('hidden');

    for (let i = 0; i < n; i++) {
      const sel = document.createElement('select');
      sel.name = 'age_' + i;
      sel.className = 'age-select';
      for (let a = 0; a <= 17; a++) {
        const opt = document.createElement('option');
        opt.value = String(a);
        opt.textContent = String(a);
        sel.appendChild(opt);
      }
      agesRow.appendChild(sel);
    }
  }
  childrenEl?.addEventListener('input', renderAgePickers);
  renderAgePickers();

  if (!form || !previewEl) return;

  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');

  // affiliate/link helpers
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

  async function uploadAttachments() {
    const input = $('#attachments');
    if (!input || !input.files || input.files.length === 0) return [];
    const fd = new FormData();
    [...input.files].forEach(f => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) return [];
    const out = await res.json().catch(()=>({files:[]}));
    return out.files || [];
  }

  const readForm = async () => {
    const d = Object.fromEntries(new FormData(form).entries());
    const ages = [...(agesRow?.querySelectorAll('select') || [])].map(s => Number(s.value || 0));
    const attachments = await uploadAttachments();

    return {
      destination: d.destination || '',
      start: d.start || '',
      end: d.end || '',
      budget: Number(d.budget || 0),
      currency: d.currency || 'USD $',
      level: d.level || 'mid',
      prefs: d.prefs || '',
      diet: d.diet || '',
      special: d.special || '',
      travelers: Number(d.adults || 0) + Number(d.children || 0),
      adults: Number(d.adults || 0),
      children: Number(d.children || 0),
      childAges: ages,
      attachments
    };
  };

  async function safeJson(res) {
    const txt = await res.text();
    try { return JSON.parse(txt); } catch { return { html: `<pre class="muted small">${txt || 'Server error'}</pre>` }; }
  }

  // Preview
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = await readForm();
    setAffiliates(payload.destination);
    hide(pdfBtn);
    show(loadingEl);

    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const out = await safeJson(res);
      previewEl.innerHTML = out.teaser_html || '<p>Preview created.</p>';
    } catch {
      previewEl.innerHTML = '<p class="muted">Preview failed. Please try again.</p>';
    } finally {
      hide(loadingEl);
    }
  });

  // Full plan
  buyBtn?.addEventListener('click', async () => {
    const payload = await readForm();
    setAffiliates(payload.destination);
    hide(pdfBtn);
    show(loadingEl);

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const out = await safeJson(res);
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
