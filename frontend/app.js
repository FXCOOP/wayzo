// app.js — preview/plan flow (keeps existing wiring)
(function () {
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const form      = $('#tripForm');
  const previewEl = $('#preview');
  const loadingEl = $('#loading');
  const pdfBtn    = $('#pdfBtn');
  const buyBtn    = $('#buyBtn');
  const saveBtn   = $('#saveBtn');

  // --- version badge (non-blocking)
  (async () => {
    try {
      const r = await fetch('/api/version', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      const pill = $('#verPill');
      if (pill && j?.version) pill.textContent = `AI powered · ${j.version}`;
    } catch {}
  })();

  if (!form || !previewEl) return;

  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');

  const readForm = () => {
    const data = Object.fromEntries(new FormData(form).entries());
    data.travelers = Number(data.travelers || 2);
    data.budget    = Number(data.budget || 0);
    data.level     = data.level || 'budget';
    // long_input is just another field; backend already reads it
    return data;
  };

  // 🔗 Affiliate + maps links (edit these to your partner URLs)
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

  // --- PRO BRIEF UI (template, autosize, counter, meter)
  const brief        = $('#proBrief');
  const briefBar     = $('#briefBar');
  const briefCount   = $('#briefCount');
  const briefChars   = $('#briefChars');
  const briefClear   = $('#briefClear');
  const briefTplBtn  = $('#briefTemplate');

  const HARD_CHAR_CAP = 2000;     // tweak if you want
  const WORD_SOFT_MIN = 150;
  const WORD_SOFT_MAX = 400;

  const TEMPLATE = `Preferences & vibe:
- Energetic cultural trip with time to relax in cafés; photo-friendly spots.

Must-see (priority order):
1) Iconic landmark A
2) Museum B
3) Neighborhood C
Must-skip: Crowded tourist traps unless off-peak.

Group details:
- 2 adults + 1 teen; good walkers; prefer ≤30 min single transit hops.

Dining:
- Mid-range; love bakeries & markets; one special dinner; avoid shellfish.

Timing windows:
- Land 10:30, hotel 14:00 check-in; one early night; sunrise photos one day.

Constraints:
- Max $300/day for food & activities total; avoid long queues.

Anchor events:
- Tickets for Evening Show on Day 2 at 19:00.

Neighborhoods:
- Prefer historic center & riverside; avoid very hilly areas.

Rainy-day backups:
- Indoor galleries, covered passages, food hall.`;

  const autosize = (ta) => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(420, Math.max(160, ta.scrollHeight)) + 'px';
  };

  const countWords = (txt) => (txt.trim() ? txt.trim().split(/\s+/).length : 0);

  const updateBriefMeta = () => {
    const val   = brief.value || '';
    const words = countWords(val);
    const chars = val.length;

    briefCount.textContent = String(words);
    briefChars.textContent = String(chars);

    const pct = Math.min(100, Math.round((chars / HARD_CHAR_CAP) * 100));
    briefBar.style.width = pct + '%';
    briefBar.classList.toggle('ok',  words >= WORD_SOFT_MIN && words <= WORD_SOFT_MAX);
    briefBar.classList.toggle('warn', words < WORD_SOFT_MIN || words > WORD_SOFT_MAX);
    briefBar.classList.toggle('cap', chars >= HARD_CHAR_CAP);

    if (chars > HARD_CHAR_CAP) brief.value = val.slice(0, HARD_CHAR_CAP);
    autosize(brief);
  };

  if (brief) {
    brief.addEventListener('input', updateBriefMeta);
    brief.addEventListener('change', updateBriefMeta);
    updateBriefMeta();

    briefTplBtn?.addEventListener('click', () => {
      brief.value = TEMPLATE;
      updateBriefMeta();
      brief.focus();
    });
    briefClear?.addEventListener('click', () => {
      brief.value = '';
      updateBriefMeta();
      brief.focus();
    });
  }

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
