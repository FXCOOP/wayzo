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
const enhancedPdfBtn = $('#enhancedPdfBtn');
const icsBtn = $('#icsBtn');
const reportBtn = $('#reportBtn');

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
        if (enhancedPdfBtn) {
          enhancedPdfBtn.style.display = 'inline-block';
          enhancedPdfBtn.href = `${base}/api/plan/${data.id}/enhanced-pdf`;
        }
        if (icsBtn) {
          icsBtn.style.display = 'inline-block';
          icsBtn.href = `${base}/api/plan/${data.id}/ics`;
        }
        if (reportBtn) {
          reportBtn.style.display = 'inline-block';
          reportBtn.href = `${base}/api/plan/${data.id}/report`;
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

  // Add report button functionality
  if (reportBtn) {
    reportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const planId = reportBtn.href.split('/').pop();
      if (planId) {
        showTripReport(planId);
      }
    });
  }
});

// Display comprehensive trip report
async function showTripReport(planId) {
  try {
    const response = await fetch(`/api/plan/${planId}/report`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const report = await response.json();
    
    // Create modal for report
    const modal = document.createElement('div');
    modal.className = 'report-modal';
    modal.innerHTML = `
      <div class="report-modal-content">
        <div class="report-modal-header">
          <h2>📊 Trip Report - ${report.summary.destination}</h2>
          <button class="close-btn" onclick="this.closest('.report-modal').remove()">&times;</button>
        </div>
        <div class="report-modal-body">
          <div class="report-section">
            <h3>🌍 Trip Overview</h3>
            <div class="report-grid">
              <div class="report-card">
                <div class="report-value">${report.summary.dates.duration}</div>
                <div class="report-label">Days</div>
              </div>
              <div class="report-card">
                <div class="report-value">${report.summary.travelers.total}</div>
                <div class="report-label">Travelers</div>
              </div>
              <div class="report-card">
                <div class="report-value">${report.summary.budget.currency} ${report.summary.budget.perPersonPerDay}</div>
                <div class="report-label">Per Person/Day</div>
              </div>
              <div class="report-card">
                <div class="report-value">${report.summary.style}</div>
                <div class="report-label">Style</div>
              </div>
            </div>
          </div>
          
          <div class="report-section">
            <h3>📈 Smart Analysis</h3>
            <div class="analysis-grid">
              <div class="analysis-item">
                <h4>Seasonal Factors</h4>
                <p><strong>Season:</strong> ${report.analysis.seasonal.season}</p>
                <p><strong>Peak Season:</strong> ${report.analysis.seasonal.isPeakSeason ? 'Yes 🌡️' : 'No 🌿'}</p>
                <p><strong>Price Factor:</strong> ${report.analysis.seasonal.priceMultiplier}x</p>
                <ul>
                  ${report.analysis.seasonal.recommendations.map(rec => `<li>💡 ${rec}</li>`).join('')}
                </ul>
              </div>
              <div class="analysis-item">
                <h4>Timing Analysis</h4>
                <p><strong>Advance Notice:</strong> ${report.analysis.timing.advanceNotice} days</p>
                <p><strong>Weekend Start:</strong> ${report.analysis.timing.isWeekend ? 'Yes' : 'No'}</p>
                <ul>
                  ${report.analysis.timing.recommendations.map(rec => `<li>💡 ${rec}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
          
          <div class="report-section">
            <h3>💰 Budget Analysis</h3>
            <div class="budget-analysis">
              <p><strong>Category:</strong> ${report.analysis.budget.category}</p>
              <p><strong>Efficiency:</strong> ${report.analysis.budget.efficiency}</p>
              <ul>
                ${report.analysis.budget.recommendations.map(rec => `<li>💡 ${rec}</li>`).join('')}
              </ul>
            </div>
          </div>
          
          <div class="report-section">
            <h3>🏨 Recommendations</h3>
            <div class="recommendations-grid">
              <div class="rec-item">
                <h4>Accommodation</h4>
                <p><strong>Type:</strong> ${report.recommendations.accommodation.type}</p>
                <ul>
                  ${report.recommendations.accommodation.tips.map(tip => `<li>💡 ${tip}</li>`).join('')}
                </ul>
              </div>
              <div class="rec-item">
                <h4>Transportation</h4>
                <ul>
                  ${report.recommendations.transportation.recommendations.map(rec => `<li>🚗 ${rec}</li>`).join('')}
                </ul>
              </div>
              <div class="rec-item">
                <h4>Activities</h4>
                <p><strong>Daily Budget:</strong> ${report.summary.budget.currency} ${report.recommendations.activities.daily}</p>
                <ul>
                  ${report.recommendations.activities.recommendations.map(rec => `<li>🎯 ${rec}</li>`).join('')}
                </ul>
              </div>
              <div class="rec-item">
                <h4>Dining</h4>
                <p><strong>Daily Budget:</strong> ${report.summary.budget.currency} ${report.recommendations.dining.daily}</p>
                <ul>
                  ${report.recommendations.dining.recommendations.map(rec => `<li>🍽️ ${rec}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
          
          <div class="report-section">
            <h3>🌤️ Practical Information</h3>
            <div class="practical-grid">
              <div class="practical-item">
                <h4>Weather & Packing</h4>
                <p><strong>Season:</strong> ${report.practical.weather.season}</p>
                <p><strong>Typical:</strong> ${report.practical.weather.typical}</p>
                <p><strong>Pack:</strong> ${report.practical.weather.packing.join(', ')}</p>
              </div>
              <div class="practical-item">
                <h4>Essentials</h4>
                <p><strong>Documents:</strong> ${report.practical.essentials.documents.join(', ')}</p>
                <p><strong>Electronics:</strong> ${report.practical.essentials.electronics.join(', ')}</p>
                <p><strong>Health:</strong> ${report.practical.essentials.health.join(', ')}</p>
              </div>
              <div class="practical-item">
                <h4>Local Info</h4>
                <p><strong>Language:</strong> ${report.practical.local.language}</p>
                <p><strong>Currency:</strong> ${report.practical.local.currency}</p>
                <p><strong>Voltage:</strong> ${report.practical.local.voltage}</p>
                <p><strong>Tipping:</strong> ${report.practical.local.tipping}</p>
                <p><strong>Emergency:</strong> ${report.practical.local.emergency}</p>
              </div>
            </div>
          </div>
        </div>
        <div class="report-modal-footer">
          <button class="btn btn-primary" onclick="window.open('/api/plan/${planId}/enhanced-pdf', '_blank')">Download Enhanced PDF</button>
          <button class="btn btn-ghost" onclick="this.closest('.report-modal').remove()">Close</button>
        </div>
      </div>
    `;
    
    // Add modal to page
    document.body.appendChild(modal);
    
    // Add modal styles if not already present
    if (!document.getElementById('report-modal-styles')) {
      const styles = document.createElement('style');
      styles.id = 'report-modal-styles';
      styles.textContent = `
        .report-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
        }
        .report-modal-content {
          background: white;
          border-radius: 20px;
          max-width: 1200px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .report-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 25px 30px;
          border-bottom: 2px solid #e2e8f0;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: white;
          border-radius: 20px 20px 0 0;
        }
        .report-modal-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
        }
        .close-btn {
          background: none;
          border: none;
          color: white;
          font-size: 28px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s;
        }
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .report-modal-body {
          padding: 30px;
        }
        .report-section {
          margin-bottom: 40px;
        }
        .report-section h3 {
          color: #1e293b;
          margin: 0 0 20px 0;
          font-size: 20px;
          font-weight: 700;
          border-bottom: 2px solid #6366f1;
          padding-bottom: 10px;
        }
        .report-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }
        .report-card {
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }
        .report-value {
          font-size: 24px;
          font-weight: 800;
          color: #6366f1;
          margin-bottom: 5px;
        }
        .report-label {
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .analysis-grid, .recommendations-grid, .practical-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }
        .analysis-item, .rec-item, .practical-item {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
        }
        .analysis-item h4, .rec-item h4, .practical-item h4 {
          color: #6366f1;
          margin: 0 0 15px 0;
          font-size: 16px;
          font-weight: 700;
        }
        .analysis-item p, .rec-item p, .practical-item p {
          margin: 8px 0;
          color: #374151;
        }
        .analysis-item ul, .rec-item ul, .practical-item ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        .analysis-item li, .rec-item li, .practical-item li {
          margin-bottom: 5px;
          color: #4b5563;
        }
        .budget-analysis {
          background: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 12px;
          padding: 20px;
        }
        .report-modal-footer {
          padding: 25px 30px;
          border-top: 2px solid #e2e8f0;
          display: flex;
          gap: 15px;
          justify-content: center;
          background: #f8fafc;
          border-radius: 0 0 20px 20px;
        }
        @media (max-width: 768px) {
          .report-modal-content {
            margin: 10px;
            max-height: 95vh;
          }
          .report-modal-header, .report-modal-body, .report-modal-footer {
            padding: 20px;
          }
          .analysis-grid, .recommendations-grid, .practical-grid {
            grid-template-columns: 1fr;
          }
        }
      `;
      document.head.appendChild(styles);
    }
    
  } catch (error) {
    console.error('Failed to load trip report:', error);
    alert('Failed to load trip report. Please try again.');
  }
}

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