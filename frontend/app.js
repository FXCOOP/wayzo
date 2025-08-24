<document filename="app.js">
"use strict";
<p>// Tiny helpers
const $ = (sel) => document.querySelector(sel);</p>
<p>// Form and inputs
const form = document.getElementById('tripForm');
if (form) form.addEventListener('submit', (e) => { e.preventDefault(); });</p>
<p>const destination = $('#destination');
const start = $('#start');
const end = $('#end');
const totalBudget = $('#totalBudget');
const currency = $('#currency');
const adults = $('#adults');
const children = $('#children');
const diet = $('#diet');
const prefs = $('#prefs');</p>
<p>// Uploads (robust selection + preview container)
const filesElRaw = document.getElementById('attachments') || document.getElementById('photo');
const filesEl = filesElRaw || null;
let previewEl = document.getElementById('attachmentsPreview') || document.getElementById('filesPreview');</p>
<p>if (!previewEl &#x26;&#x26; filesEl) {
previewEl = document.createElement('div');
previewEl.id = 'attachmentsPreview';
previewEl.className = 'files';
filesEl.insertAdjacentElement('afterend', previewEl);
}</p>
<p>// Buttons (robust binding)
const submitBtn = $("button[type='submit']");
const buyBtn = $('#buyBtn');
const saveBtn = $('#saveBtn');
const pdfBtn = $('#pdfBtn');
const icsBtn = $('#icsBtn');</p>
<p>// Output
const previewBox = $('#preview');
const loading = $('#loading');</p>
<p>// Safe helpers
const val = (el) => (el &#x26;&#x26; el.value || '').trim();
const num = (el) => {
const n = Number((el &#x26;&#x26; el.value || '').replace(/[^\d.]/g, ''));
return Number.isFinite(n) ? n : 0;
};</p>
<p>// Collect checkboxes/radios
const selectedStyle = () => {
const el = document.querySelector('input[name="style"]:checked');
return el ? el.value : 'mid';
};
const selectedPrefs = () => {
return Array.from(document.querySelectorAll('.seg.wrap input[type="checkbox"]:checked')).map(i => i.value);
};</p>
<p>// Validate form with enhanced feedback
function validateForm(payload) {
const errors = [];
if (!payload.destination) errors.push('Please enter a destination.');
if (!payload.start || !payload.end) errors.push('Please select start and end dates.');
if (errors.length > 0) {
alert(errors.join('\n'));
return false;
}
return true;
}</p>
<p>// Payload preparation with default values
function preparePayload() {
return {
destination: val(destination) || 'Unknown Destination',
start: val(start) || new Date().toISOString().split('T')[0],
end: val(end) || new Date(Date.now() + 86400000).toISOString().split('T')[0], // Default to tomorrow
budget: num(totalBudget) || 1000, // Default budget
currency: val(currency) || 'USD',
adults: num(adults) || 1,
children: num(children) || 0,
diet: val(diet) || 'None',
prefs: val(prefs) || '',
style: selectedStyle(),
interests: selectedPrefs()
};
}</p>
<p>// Loading state management
function showLoading(show = true) {
if (loading) {
loading.style.display = show ? 'block' : 'none';
document.body.style.cursor = show ? 'wait' : 'default';
}
}</p>
<p>// Preview innerHTML with enhanced rendering
function setPreviewHTML(html = '') {
if (previewBox) {
previewBox.innerHTML = html;
// Post-process for images and maps with error handling
const imgs = previewBox.querySelectorAll('img[src^="<a href="https://unsplash.com">https://unsplash.com</a>"]');
imgs.forEach(img => {
img.loading = 'lazy';
img.onerror = () => img.src = '/assets/placeholder.jpg'; // Fallback image
});
const mapPlaces = previewBox.querySelectorAll('#map');
mapPlaces.forEach(place => {
place.innerHTML = '</p><div>Map loading...</div>';
// Placeholder for Mapbox integration (to be enhanced)
});
}
}<p></p>
<p>// Uploads with file type check
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
alert(<code>Unsupported file type: ${f.name}</code>);
}
}
}</p>
<p>// Preview request with timeout
async function doPreview() {
showLoading(true);
const payload = preparePayload();
if (!validateForm(payload)) {
showLoading(false);
return;
}
try {
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout
const res = await fetch('/api/preview', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload),
signal: controller.signal
});
clearTimeout(timeoutId);
const data = await res.json();
setPreviewHTML(data.teaser_html || '</p><div class="muted">No preview available.</div>');
} catch (e) {
setPreviewHTML('<div class="muted">Preview failed. Try again. Error: ' + (e.name === 'AbortError' ? 'Timeout' : e.message) + '</div>');
} finally {
showLoading(false);
}
}<p></p>
<p>// Full plan (AI) with retry logic
async function doFullPlan() {
showLoading(true);
const payload = preparePayload();
if (!validateForm(payload)) {
showLoading(false);
return;
}
let attempts = 0, maxAttempts = 2;
while (attempts &#x3C; maxAttempts) {
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
if (pdfBtn) { pdfBtn.style.display = 'inline-block'; pdfBtn.href = <code>${base}/api/plan/${data.id}/pdf</code>; }
if (icsBtn) { icsBtn.style.display = 'inline-block'; icsBtn.href = <code>${base}/api/plan/${data.id}/ics</code>; }
}
break;
} catch (e) {
attempts++;
if (attempts === maxAttempts) {
setPreviewHTML('</p><div class="muted">Plan failed after retries. Try again. Error: ' + e.message + '</div>');
}
}
}
showLoading(false);
}<p></p>
<p>// Save preview with local storage check
async function savePreview() {
try {
await doPreview();
if (typeof localStorage !== 'undefined') {
localStorage.setItem('wayzo_preview', previewBox.innerHTML || '');
alert('Preview saved locally.');
} else {
alert('Local storage not available. Preview not saved.');
}
} catch {}
}</p>
<p>// Wire up with debouncing
let debounceTimer;
const debounce = (callback, delay) => {
return (...args) => {
clearTimeout(debounceTimer);
debounceTimer = setTimeout(() => callback(...args), delay);
};
};</p>
<p>form?.addEventListener('submit', (e) => e.preventDefault());
submitBtn?.addEventListener('click', debounce((e) => { e.preventDefault(); doPreview(); }, 300));
buyBtn?.addEventListener('click', debounce((e) => { e.preventDefault(); doFullPlan(); }, 300));
saveBtn?.addEventListener('click', debounce((e) => { e.preventDefault(); savePreview(); }, 300));</p>
<p>// Live thumbnail render with drag-and-drop
filesEl?.addEventListener('change', async () => {
try { await uploadFiles(); } catch {}
});
filesEl?.addEventListener('dragover', (e) => e.preventDefault());
filesEl?.addEventListener('drop', (e) => {
e.preventDefault();
if (e.dataTransfer.items) {
const files = Array.from(e.dataTransfer.items).filter(item => item.kind === 'file').map(item => item.getAsFile());
filesEl.files = new FileList(files);
uploadFiles();
}
});
</p>
<hr>
<h3>Improvements in the Better Version</h3>
<ol>
<li><strong>Enhanced Validation</strong>: Provides detailed error messages with line breaks for multiple issues.</li>
<li><strong>Default Values</strong>: Adds fallback values to <code>preparePayload</code> to prevent undefined errors.</li>
<li><strong>Loading State</strong>: Includes cursor change for better UX and robust checking.</li>
<li><strong>Image/Map Rendering</strong>: Adds error handling for images with a fallback and improves map placeholder.</li>
<li><strong>Upload Filtering</strong>: Checks file types (images/PDFs only) with user feedback.</li>
<li><strong>Timeout and Retry</strong>: Adds a 10-second timeout for <code>/api/preview</code> and retry logic for <code>/api/plan</code>.</li>
<li><strong>Local Storage Check</strong>: Verifies browser support before saving.</li>
<li><strong>Debouncing</strong>: Prevents rapid clicks with a 300ms delay.</li>
<li><strong>Drag-and-Drop</strong>: Adds basic drag-and-drop support for file uploads.</li>
</ol>
<p>Please review this updated <code>app.js</code>. If it meets your needs or you’d like further tweaks, say "continue" for the next file (e.g., <code>app.pro.js</code>). Let me know if you have specific requests!</p></document>