<!-- app.js -->
<script>
(function () {
  const $ = (s) => document.querySelector(s);

  const form      = $('#tripForm');
  const previewEl = $('#preview');
  const loadingEl = $('#loading');
  const pdfBtn    = $('#pdfBtn');
  const buyBtn    = $('#buyBtn');
  const saveBtn   = $('#saveBtn');
  const buildTag  = $('#buildTag');
  const chipsEl   = $('#summaryChips');

  fetch('/version').then(r=>r.json()).then(j=>buildTag && (buildTag.textContent = j.version || 'AI powered')).catch(()=>{});

  /* Ages UI */
  const adultsEl   = $('#adults');
  const childrenEl = $('#children');
  const agesRow    = $('#agesRow');

  function renderAgePickers() {
    const n = Math.max(0, Number(childrenEl?.value || 0));
    if (!agesRow) return;
    agesRow.innerHTML = '';
    if (n <= 0) { agesRow.classList.add('hidden'); paintSummary(); return; }
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
      sel.addEventListener('change', paintSummary);
      agesRow.appendChild(sel);
    }
    paintSummary();
  }
  childrenEl?.addEventListener('input', renderAgePickers);

  /* Live traveler summary */
  function paintSummary() {
    if (!chipsEl) return;
    const dest = $('#destination')?.value || '';
    const ad   = Number(adultsEl?.value || 0);
    const ch   = Number(childrenEl?.value || 0);
    const ages = Array.from(agesRow?.querySelectorAll('select') || []).map(s => Number(s.value||0));
    const level= (document.querySelector('input[name="level"]:checked')?.value)||'mid';
    const style= level==='luxury'?'Luxury':level==='budget'?'Budget':'Mid-range';

    chipsEl.innerHTML = `
      <span class="chip"><b>Destination:</b> ${dest || '—'}</span>
      <span class="chip"><b>Travelers:</b> ${ad} adult${ad===1?'':'s'}${ch?` + ${ch} kid${ch===1?'':'s'}`:''}</span>
      ${ch?`<span class="chip"><b>Ages:</b> ${ages.join(', ') || '—'}</span>`:''}
      <span class="chip"><b>Style:</b> ${style}</span>
    `;
  }
  ['input','change'].forEach(ev=>{
    form?.addEventListener(ev,(e)=>{
      if (e.target && (e.target.id==='destination'||e.target.id==='adults'||e.target.id==='children'||e.target.name==='level')) paintSummary();
    });
  });
  renderAgePickers(); paintSummary();

  const setHref = (id, url) => { const a = $(id); if (a) { a.href = url; a.target = "_blank"; a.rel="noopener"; } };

  async function uploadAttachments() {
    const input = $('#attachments');
    if (!input || !input.files || input.files.length === 0) return [];
    const fd = new FormData();
    Array.from(input.files).forEach(f => fd.append('files', f));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (!res.ok) return [];
    const out = await res.json().catch(()=>({files:[]}));
    return out.files || [];
  }

  async function readForm() {
    const d = Object.fromEntries(new FormData(form).entries());
    const ages = Array.from(agesRow?.querySelectorAll('select') || []).map(s => Number(s.value || 0));
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
  }

  function setAffiliates(dest) {
    const q = encodeURIComponent(dest || '');
    setHref('#linkMaps',      `https://www.google.com/maps/search/?api=1&query=${q}`);
    setHref('#linkFlights',   `https://www.kayak.com/flights?search=${q}`);
    setHref('#linkHotels',    `https://www.booking.com/searchresults.html?ss=${q}`);
    setHref('#linkActivities',`https://www.getyourguide.com/s/?q=${q}`);
    setHref('#linkCars',      `https://www.rentalcars.com/SearchResults.do?destination=${q}`);
    setHref('#linkInsurance', `https://www.worldnomads.com/`);
    setHref('#linkReviews',   `https://www.tripadvisor.com/Search?q=${q}`);
  }

  async function safeJson(res) {
    const txt = await res.text();
    try { return JSON.parse(txt); }
    catch { return { html: `<pre class="muted small">${txt || 'Server error'}</pre>` }; }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = await readForm();
    setAffiliates(payload.destination);
    pdfBtn.style.display = 'none';
    loadingEl.classList.remove('hidden');

    try {
      const res = await fetch('/api/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const out = await safeJson(res);
      previewEl.innerHTML = out.teaser_html || '<p>Preview created.</p>';
    } catch {
      previewEl.innerHTML = '<p class="muted">Preview failed. Please try again.</p>';
    } finally {
      loadingEl.classList.add('hidden');
    }
  });

  buyBtn?.addEventListener('click', async () => {
    const payload = await readForm();
    setAffiliates(payload.destination);
    pdfBtn.style.display = 'none';
    loadingEl.classList.remove('hidden');

    try {
      const res = await fetch('/api/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const out = await safeJson(res);
      previewEl.innerHTML = out.html ? `<div class="markdown">${out.html}</div>` :
                           (out.markdown ? `<div class="markdown" style="white-space:pre-wrap">${out.markdown}</div>` : '<p>Plan generated.</p>');
      if (out.id) { pdfBtn.href = `/api/plan/${out.id}/pdf`; pdfBtn.style.display = 'inline-flex'; }
    } catch {
      previewEl.innerHTML = '<p class="muted">Plan failed. Please try again.</p>';
    } finally {
      loadingEl.classList.add('hidden');
    }
  });

  saveBtn?.addEventListener('click', () => {
    try { localStorage.setItem('wayzo_preview', previewEl.innerHTML || ''); alert('Preview saved on this device.'); } catch {}
  });
})();
</script>
