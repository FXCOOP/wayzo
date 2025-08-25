/* eslint-disable no-console */
/* Wayzo app.js - Enhanced UI/UX and Map Fix - 2025-08-25 15:26 IDT */
"use strict";

// Tiny helpers
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Form and inputs
const form = $('#tripForm');
const destination = $('#destination');
const start = $('#start');
const end = $('#end');
const totalBudget = $('#totalBudget');
const currency = $('#currency');
const adults = $('#adults');
const children = $('#children');
const diet = $('#diet');
const prefs = $('#prefs');
const filesEl = $('#attachments');
const previewEl = $('#attachmentsPreview');
const previewBox = $('#preview');
const loading = $('#loading');
const mapEl = $('#map');
const submitBtn = $('#submitBtn');
const buyBtn = $('#buyBtn');
const saveBtn = $('#saveBtn');
const buildPlanBtn = $('#buildPlanBtn');
const demoBtn = $('#demoBtn');
const pdfBtn = $('#pdfBtn');
const icsBtn = $('#icsBtn');

// Safe helpers
const val = (el) => (el && el.value ? el.value.trim() : '');
const num = (el) => {
  const n = Number((el && el.value ? el.value.replace(/[^\d.]/g, '') : '0'));
  return Number.isFinite(n) ? n : 0;
};

// Collect checkboxes/radios
const selectedStyle = () => {
  const el = document.querySelector('input[name="style"]:checked');
  return el ? el.value : 'mid';
};
const selectedPrefs = () => {
  return Array.from($$('.seg.wrap input[type="checkbox"]:checked')).map(i => i.value);
};

// Inline form validation
function validateForm(payload) {
  const errors = [];
  const fields = { destination, start, end, totalBudget };
  Object.entries(fields).forEach(([, el]) => {
    const field = el?.parentElement;
    if (field) {
      field.classList.remove('error');
      field.removeAttribute('data-error');
    }
  });

  if (!payload.destination) {
    errors.push('Destination is required.');
    if (destination?.parentElement) {
      destination.parentElement.classList.add('error');
      destination.parentElement.setAttribute('data-error', 'Please enter a destination.');
    }
  }
  if (!payload.start) {
    errors.push('Start date is required.');
    if (start?.parentElement) {
      start.parentElement.classList.add('error');
      start.parentElement.setAttribute('data-error', 'Please select a start date.');
    }
  }
  if (!payload.end) {
    errors.push('End date is required.');
    if (end?.parentElement) {
      end.parentElement.classList.add('error');
      end.parentElement.setAttribute('data-error', 'Please select an end date.');
    }
  }
  if (!payload.budget || payload.budget <= 0) {
    errors.push('Budget must be greater than 0.');
    if (totalBudget?.parentElement) {
      totalBudget.parentElement.classList.add('error');
      totalBudget.parentElement.setAttribute('data-error', 'Please enter a valid budget.');
    }
  }
  return errors.length === 0;
}

// Payload preparation
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
    loading.style.display = show ? 'flex' : 'none';
  }
  document.body.style.cursor = show ? 'wait' : 'default';
  [submitBtn, buyBtn, saveBtn, buildPlanBtn, demoBtn].forEach(btn => {
    if (btn) btn.disabled = show;
  });
}

// Preview innerHTML
function setPreviewHTML(html = '') {
  if (previewBox) {
    previewBox.innerHTML = html || '<div class="muted">Enter your trip details and generate a plan to see a detailed itinerary here.</div>';
    previewBox.classList.add('markdown'); // Apply rich styles
    previewBox.querySelectorAll('img[src^="https://unsplash.com"]').forEach(img => {
      img.loading = 'lazy';
      img.onerror = () => { try { img.src = '/frontend/placeholder.jpg'; } catch {} };
    });
    previewBox.querySelectorAll('#map').forEach(place => {
      place.innerHTML = '<div>Map loading...</div>';
    });
  }
}

// Uploads
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
      console.error(`Unsupported file type: ${f.name}`);
    }
  }
}

// Preview request
async function doPreview() {
  showLoading(true);
  const payload = preparePayload();
  if (!validateForm(payload)) {
    showLoading(false);
    return;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    console.log('Sending preview request:', payload);
    const res = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    setPreviewHTML(data.teaser_html);
    console.log('Preview response:', data);
  } catch (e) {
    setPreviewHTML('<div class="muted">Preview failed. Error: ' + e.message + '</div>');
    console.error('Preview error:', e);
  } finally {
    showLoading(false);
  }
}

// Full plan (AI)
async function doFullPlan() {
  showLoading(true);
  const payload = preparePayload();
  if (!validateForm(payload)) {
    showLoading(false);
    return;
  }
  let attempts = 0;
  const maxAttempts = 4;
  while (attempts < maxAttempts) {
    try {
      console.log('Sending full plan request:', payload);
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setPreviewHTML(data.html || '<div class="muted">No plan generated.</div>');
      if (data.id) {
        const base = location.origin;
        if (pdfBtn) {
          pdfBtn.style.display = 'inline-block';
          pdfBtn.href = `${base}/api/plan/${data.id}/pdf`;
        }
        if (icsBtn) {
          icsBtn.style.display = 'inline-block';
          icsBtn.href = `${base}/api/plan/${data.id}/ics`;
        }
      }
      console.log('Full plan response:', data);
      break;
    } catch (e) {
      attempts++;
      if (attempts === maxAttempts) {
        setPreviewHTML('<div class="muted">Plan failed after retries. Error: ' + e.message + '</div>');
      }
      console.error('Full plan error:', e);
    }
  }
  showLoading(false);
}

// Save preview
async function savePreview() {
  try {
    await doPreview();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('wayzo_preview', previewBox.innerHTML || '');
      console.log('Preview saved locally.');
    } else {
      console.error('Local storage not available.');
    }
  } catch (e) {
    console.error('Save preview error:', e);
  }
}

// Demo function
function showDemo() {
  setPreviewHTML('<div class="muted">This is a demo preview. Generate a plan to see real results!</div>');
}

// Debouncing
let debounceTimer;
const debounce = (callback, delay) => {
  return (...args) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => callback(...args), delay);
  };
};

// Wire up events
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing event listeners');
  if (!form) console.error('Form #tripForm not found');
  if (!submitBtn) console.error('Button #submitBtn not found');
  if (!buyBtn) console.error('Button #buyBtn not found');
  if (!saveBtn) console.error('Button #saveBtn not found');
  if (!buildPlanBtn) console.error('Button #buildPlanBtn not found');
  if (!demoBtn) console.error('Button #demoBtn not found');

  form?.addEventListener('submit', (e) => e.preventDefault());
  submitBtn?.addEventListener('click', debounce((e) => {
    e.preventDefault();
    console.log('Submit button clicked');
    doPreview();
  }, 300));
  buyBtn?.addEventListener('click', debounce((e) => {
    e.preventDefault();
    console.log('Buy button clicked');
    doFullPlan();
  }, 300));
  saveBtn?.addEventListener('click', debounce((e) => {
    e.preventDefault();
    console.log('Save button clicked');
    savePreview();
  }, 300));
  buildPlanBtn?.addEventListener('click', debounce((e) => {
    e.preventDefault();
    console.log('Build plan button clicked');
    doPreview();
  }, 300));
  demoBtn?.addEventListener('click', debounce((e) => {
    e.preventDefault();
    console.log('Demo button clicked');
    showDemo();
  }, 300));

  if (filesEl) {
    filesEl.addEventListener('change', async () => {
      try {
        console.log('File input changed');
        await uploadFiles();
      } catch (e) {
        console.error('Upload error:', e);
      }
    });
    filesEl.addEventListener('dragover', (e) => e.preventDefault());
    filesEl.addEventListener('drop', (e) => {
      e.preventDefault();
      try {
        const items = e.dataTransfer?.items ? Array.from(e.dataTransfer.items) : [];
        const dt = new DataTransfer();
        for (const item of items) {
          if (item.kind === 'file') {
            const f = item.getAsFile();
            if (f) dt.items.add(f);
          }
        }
        if (dt.files && dt.files.length > 0) {
          filesEl.files = dt.files;
          uploadFiles();
        }
      } catch (err) {
        console.error('Drag-drop error:', err);
      }
    });
  }

  // Initialize Map
  if (mapEl && typeof mapboxgl !== 'undefined') {
    const meta = document.querySelector('meta[name="mapbox-key"]');
    const mapKey = (meta && meta.content ? meta.content : '').trim();
    if (!mapKey) {
      console.warn('Mapbox API key not set (meta[name="mapbox-key"]). Map will not load.');
    } else {
      mapboxgl.accessToken = mapKey;
      const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [25.276987, 37.441883], // Santorini default
        zoom: 10
      });
      map.on('load', () => {
        mapEl.classList.add('map-loaded');
        console.log('Map loaded successfully');
      });
      map.on('error', (e) => console.error('Mapbox error:', e));
    }
  } else {
    console.error('Mapbox GL JS not loaded or #map element not found');
  }

  // Image debug
  const heroBg = $('.hero-image');
  if (heroBg) {
    heroBg.onerror = () => console.error('hero-bg.jpg failed to load');
  }
  const secondaryImg = $('.secondary-image');
  if (secondaryImg) {
    secondaryImg.onerror = () => console.error('hero-card.jpg failed to load');
  }
});

// Initial checks
console.log('Elements loaded:', {
  form: !!form,
  submitBtn: !!submitBtn,
  buyBtn: !!buyBtn,
  saveBtn: !!saveBtn,
  buildPlanBtn: !!buildPlanBtn,
  demoBtn: !!demoBtn,
  inputs: !!destination && !!start && !!end && !!totalBudget && !!currency && !!adults && !!children && !!diet && !!prefs,
  map: !!mapEl
});