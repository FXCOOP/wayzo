"use strict";

// Tiny helpers
const $ = (sel) => document.querySelector(sel);

// form + inputs
const form         = document.getElementById('tripForm');
if (form) form.addEventListener('submit', (e) => { e.preventDefault(); });

const destination  = $('#destination');
const start        = $('#start');
const end          = $('#end');
const totalBudget  = $('#totalBudget');
const currency     = $('#currency');
const adults       = $('#adults');
const children     = $('#children');
const diet         = $('#diet');
const prefs        = $('#prefs');

// uploads (robust selection + preview container)
const filesElRaw   = document.getElementById('attachments') || document.getElementById('photo');
const filesEl      = filesElRaw || null;
let previewEl      = document.getElementById('attachmentsPreview') || document.getElementById('filesPreview');

if (!previewEl && filesEl) {
  previewEl = document.createElement('div');
  previewEl.id = 'attachmentsPreview';
  previewEl.className = 'files';
  filesEl.insertAdjacentElement('afterend', previewEl);
}

// buttons (robust binding)
const submitBtn    = $("button[type='submit']");
const buyBtn       = $('#buyBtn');
const saveBtn      = $('#saveBtn');
const pdfBtn       = $('#pdfBtn');
const icsBtn       = $('#icsBtn');

// output
const previewBox   = $('#preview');
const loading      = $('#loading');

// safe helpers
const val = (el) => (el && el.value || '').trim();
const num = (el) => {
  const n = Number((el && el.value || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// collect checkboxes/radios
const selectedStyle = () => {
  const el = document.querySelector('input[name="style"]:checked');
  return el ? el.value : 'mid';
};
const selectedPrefs = () => {
  return Array.from(document.querySelectorAll('.seg.wrap input[type="checkbox"]:checked')).map(i => i.value);
};

// payload
function preparePayload() {
  return {
    destination : val(destination),
    start       : val(start),
    end         : val(end),
    budget      : num(totalBudget),
    currency    : val(currency) || 'USD $',
    adults      : num(adults) || 2,
    children    : num(children) || 0,
    level       : selectedStyle(),
    prefs       : selectedPrefs().join(', '),
    diet        : val(diet),
  };
}

// simple toaster
function showLoading(on) {
  if (!loading) return;
  loading.hidden = !on;
}
function setPreviewHTML(html) {
  previewBox.innerHTML = html || '';
}

// upload selected files (images/PDF) and render thumbnails
async function uploadFiles() {
  if (!filesEl || !filesEl.files || filesEl.files.length === 0) return [];
  const fd = new FormData();
  for (const f of Array.from(filesEl.files)) fd.append('files', f);

  const res = await fetch('/api/upload', { method:'POST', body: fd });
  if (!res.ok) return [];
  const { files = [] } = await res.json();

  // thumbnails if we have a box
  if (previewEl) {
    previewEl.innerHTML = '';
    for (const f of files) {
      if (f.mime && f.mime.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = f.url;
        img.alt = f.name || 'image';
        img.loading = 'lazy';
        previewEl.appendChild(img);
      } else if (String(f.name || '').toLowerCase().endsWith('.pdf')) {
        const a = document.createElement('a');
        a.href = f.url;
        a.textContent = f.name || 'document.pdf';
        a.target = '_blank';
        a.rel = 'noopener';
        previewEl.appendChild(a);
      }
    }
  }
  return files;
}

// preview button
async function doPreview() {
  try {
    showLoading(true);
    const payload = preparePayload();
    await uploadFiles(); // optional; thumbnails + stores files

    const res = await fetch('/api/preview', {
      method:'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    setPreviewHTML(data.teaser_html || '<div class="muted">No preview available.</div>');
  } catch (e) {
    setPreviewHTML('<div class="muted">Preview failed. Try again.</div>');
  } finally {
    showLoading(false);
  }
}

// full plan (AI)
async function doFullPlan() {
  try {
    showLoading(true);
    const payload = preparePayload();
    const res = await fetch('/api/plan', {
      method:'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    setPreviewHTML(data.html || '');
    // PDF + ICS links if present
    if (data.id) {
      const base = location.origin;
      if (pdfBtn) { pdfBtn.style.display='inline-block'; pdfBtn.href = `${base}/api/plan/${data.id}/pdf`; }
      if (icsBtn) { icsBtn.style.display='inline-block';  icsBtn.href  = `${base}/api/plan/${data.id}/ics`; }
    }
  } catch (e) {
    setPreviewHTML('<div class="muted">Plan failed. Try again.</div>');
  } finally {
    showLoading(false);
  }
}

// save preview (no-op placeholder hitting same preview)
async function savePreview() {
  try {
    await doPreview();
    alert('Preview saved (client-side placeholder).');
  } catch {}
}

// wire up (prevent default on all)
form?.addEventListener('submit', (e)=> e.preventDefault());
submitBtn?.addEventListener('click', (e)=> { e.preventDefault(); doPreview(); });
buyBtn?.addEventListener('click',   (e)=> { e.preventDefault(); doFullPlan(); });
saveBtn?.addEventListener('click',  (e)=> { e.preventDefault(); savePreview(); });

// live thumbnail render on selection
filesEl?.addEventListener('change', async () => {
  try { await uploadFiles(); } catch {}
});
