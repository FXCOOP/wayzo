/* eslint-disable no-console */
/* Wayzo app.js - Enhanced UI/UX - 2025-08-24 15:59 IDT */

"use strict";

// Tiny helpers
const $ = (sel) => document.querySelector(sel);

// Form and inputs
const form = document.getElementById('tripForm');
if (form) form.addEventListener('submit', (e) => e.preventDefault());

const destination = $('#destination');
const start = $('#start');
const end = $('#end');
const totalBudget = $('#totalBudget');
const currency = $('#currency');
const adults = $('#adults');
const children = $('#children');
const diet = $('#diet');
const prefs = $('#prefs');

// Uploads
const filesEl = document.getElementById('attachments') || document.getElementById('photo');
const previewEl = document.getElementById('attachmentsPreview') || document.getElementById('filesPreview');

if (!previewEl && filesEl) {
  previewEl = document.createElement('div');
  previewEl.id = 'attachmentsPreview';
  previewEl.className = 'files';
  filesEl.insertAdjacentElement('afterend', previewEl);
}

// Buttons
const submitBtn = $("button[type='submit']");
const buyBtn = $('#buyBtn');
const saveBtn = $('#saveBtn');
const pdfBtn = $('#pdfBtn');
const icsBtn = $('#icsBtn');

// Output
const previewBox = $('#preview');
const loading = $('#loading');

// Safe helpers
const val = (el) => (el && el.value || '').trim();
const num = (el) => {
  const n = Number((el && el.value || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Collect checkboxes/radios
const selectedStyle = () => {
  const el = document.querySelector('input[name="style"]:checked');
  return el ? el.value : 'mid';
};
const selectedPrefs = () => {
  return Array.from(document.querySelectorAll('.seg.wrap input[type="checkbox"]:checked')).map(i => i.value);
};

// Validate form with enhanced feedback
function validateForm(payload) {
  const errors = [];
  if (!payload.destination) errors.push('Please enter a destination.');
  if (!payload.start || !payload.end) errors.push('Please select start and end dates.');
  if (errors.length > 0) {
    alert(errors.join('\n'));
    return false;
  }
  return true;
}

// Payload preparation with default values
function preparePayload() {
  return {
    destination: val(destination) || 'Unknown Destination',
    start: val(start) || new Date().toISOString().split('T')[0],
    end: val(end) || new Date(Date.now() + 86400000).toISOString().split('T')[0],
    budget: num(totalBudget) || 1000,
    currency: val(currency) || 'USD',
    adults: num(adults) || 1,
    children: num(children) || 0,
    diet: val(diet) || 'None',
    prefs: val(prefs) || '',
    style: selectedStyle(),
    interests: selectedPrefs()
  };
}

// Loading state management
function showLoading(show = true) {
  if (loading) {
    loading.style.display = show ? 'block' : 'none';
    document.body.style.cursor = show ? 'wait' : 'default';
  }
}

// Preview innerHTML with enhanced rendering
function setPreviewHTML(html = '') {
  if (previewBox) {
    previewBox.innerHTML = html;
    const imgs = previewBox.querySelectorAll('img[src^="https://unsplash.com"]');
    imgs.forEach(img => {
      img.loading = 'lazy';
      img.onerror = () => img.src = '/frontend/placeholder.jpg';
    });
    const mapPlaces = previewBox.querySelectorAll('#map');
    mapPlaces.forEach(place => {
      place.innerHTML = '<div>Map loading...</div>';
    });
  }
}

// Uploads with file type check
async function uploadFiles() {
  if (!filesEl || !previewEl) return;
  const files = filesEl.files;
  if (!files.length) return;
  previewEl.innerHTML = '';
  for (const f of files) {
    if (f.type.startsWith('image/') || f.type === 'application/pdf') {
      const div = document.createElement('div');
      div.className = 'file';
      div.textContent = f.name;
      previewEl.appendChild(div);
    } else {
      alert(`Unsupported file type: ${f.name}`);
    }
  }
}

// Preview request with timeout
async function doPreview() {
  showLoading(true);
  const payload = preparePayload();
  if (!validateForm(payload)) {
    showLoading(false);
    return;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    setPreviewHTML(data.teaser_html || '<div class="muted">No preview available.</div>');
  } catch (e) {
    setPreviewHTML('<div class="muted">Preview failed. Try again. Error: ' + (e.name === 'AbortError' ? 'Timeout' : e.message) + '</div>');
    console.error('Preview error:', e); // Debug
  } finally {
    showLoading(false);
  }
}

// Full plan (AI) with retry logic
async function doFullPlan() {
  showLoading(true);
  const payload = preparePayload();
  if (!validateForm(payload)) {
    showLoading(false);
    return;
  }
  let attempts = 0, maxAttempts = 2;
  while (attempts < maxAttempts) {
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setPreviewHTML(data.html || '');
      if (data.id) {
        const base = location.origin;
        if (pdfBtn) { pdfBtn.style.display = 'inline-block'; pdfBtn.href = `${base}/api/plan/${data.id}/pdf`; }
        if (icsBtn) { icsBtn.style.display = 'inline-block'; icsBtn.href = `${base}/api/plan/${data.id}/ics`; }
      }
      break;
    } catch (e) {
      attempts++;
      if (attempts === maxAttempts) {
        setPreviewHTML('<div class="muted">Plan failed after retries. Try again. Error: ' + e.message + '</div>');
      }
      console.error('Full plan error:', e); // Debug
    }
  }
  showLoading(false);
}

// Save preview with local storage check
async function savePreview() {
  try {
    await doPreview();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('wayzo_preview', previewBox.innerHTML || '');
      alert('Preview saved locally.');
    } else {
      alert('Local storage not available. Preview not saved.');
    }
  } catch (e) {
    console.error('Save preview error:', e); // Debug
  }
}

// Debouncing for button clicks
let debounceTimer;
const debounce = (callback, delay) => {
  return (...args) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => callback(...args), delay);
  };
};

// Wire up events with error handling
form?.addEventListener('submit', (e) => e.preventDefault());
submitBtn?.addEventListener('click', debounce((e) => { e.preventDefault(); doPreview(); }, 300));
buyBtn?.addEventListener('click', debounce((e) => { e.preventDefault(); doFullPlan(); }, 300));
saveBtn?.addEventListener('click', debounce((e) => { e.preventDefault(); savePreview(); }, 300));

// Upload and drag-and-drop
filesEl?.addEventListener('change', async () => {
  try { await uploadFiles(); } catch (e) { console.error('Upload error:', e); }
});
filesEl?.addEventListener('dragover', (e) => e.preventDefault());
filesEl?.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.items) {
    const files = Array.from(e.dataTransfer.items)
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile());
    filesEl.files = new FileList(files);
    uploadFiles();
  }
});

// Initialize Map
document.addEventListener('DOMContentLoaded', () => {
  mapboxgl.accessToken = 'your_mapbox_key'; // Replace with your Mapbox key
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [2.3522, 48.8566], // Paris default
    zoom: 10
  });
});