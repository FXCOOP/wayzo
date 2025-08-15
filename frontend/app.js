/* Wayzo front-end: preview, plan, save, and Google Map plotting */
const $ = (s)=>document.querySelector(s);
const byName = (n)=>document.querySelector(`[name="${n}"]`);

let CONFIG = { googleMapsKey: null };
let GMAPS_LOADED = false;
let MAP, GEOCODER;

/* ---- utils ---- */
function simpleMarkdown(md){
  md = md.replace(/^### (.*)$/gm,'<h3>$1</h3>')
         .replace(/^## (.*)$/gm,'<h2>$1</h2>')
         .replace(/^# (.*)$/gm,'<h1>$1</h1>')
         .replace(/^\- (.*)$/gm,'<li>$1</li>')
         .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
         .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  md = md.replace(/(<li>.*<\/li>)(\n(?!<li>))/g,'<ul>$1</ul>\n');
  md = md.split(/\n{2,}/).map(b=>{
    if(/^<h\d|<ul>|<li>/.test(b.trim())) return b;
    return '<p>'+b.replace(/\n/g,'<br>')+'</p>';
  }).join('\n');
  return `<div class="md">${md}</div>`;
}

function setLinks(aff){
  if(!aff) return;
  $('#linkFlights')?.setAttribute('href', aff.flights);
  $('#linkHotels')?.setAttribute('href', aff.hotels);
  $('#linkActivities')?.setAttribute('href', aff.activities);
  $('#linkCars')?.setAttribute('href', aff.cars);
  $('#linkInsurance')?.setAttribute('href', aff.insurance);
  $('#linkReviews')?.setAttribute('href', aff.reviews);
}

function showLoading(on){ $('#loading')?.classList.toggle('hidden', !on); }

/* ---- form collection ---- */
function collect(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  data.budget    = Number(data.budget||0);
  data.travelers = Number(data.travelers||1);
  // kids toggle (if present)
  const kidsToggle = $('#withKids');
  if (kidsToggle && kidsToggle.checked) {
    data.children = Number(data.children||0);
    data.childrenAges = (data.childrenAges||'')
      .split(',').map(s=>s.trim()).filter(Boolean);
    data.adults = Math.max(0, data.travelers - data.children);
  }
  return data;
}

/* ---- preview ---- */
function handleGenerate(e){
  e.preventDefault();
  const data = collect(e.target);
  showLoading(true);
  fetch('/api/preview', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(data)
  }).then(r=>r.json()).then(j=>{
    showLoading(false);
    window.__PLAN_ID__ = j.id;
    $('#preview').innerHTML = j.teaser_html || 'Preview unavailable';
    setLinks(j.affiliates);
    localStorage.setItem('tm_last', JSON.stringify(data));
  }).catch(err=>{ showLoading(false); console.error(err); alert('Preview failed.'); });
}

/* ---- full plan ---- */
function handleFull(){
  const last = JSON.parse(localStorage.getItem('tm_last')||'null');
  if(!last){ alert('Generate a preview first.'); return; }
  showLoading(true);
  fetch('/api/plan', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(last)
  }).then(r=>r.json()).then(j=>{
    showLoading(false);
    window.__PLAN_ID__ = j.id;
    const html = simpleMarkdown(j.markdown || '# Plan unavailable');
    $('#preview').innerHTML = html;
    $('#pdfBtn')?.classList.remove('hidden');
    $('#pdfBtn').setAttribute('href', `/api/plan/${j.id}/pdf`);
    setLinks(j.affiliates);
    $('#mapNotice').textContent = 'Click “Plot on Map” to see all places on a map.';
  }).catch(err=>{ showLoading(false); console.error(err); alert('Full plan failed. Check OPENAI_API_KEY.'); });
}

/* ---- save ---- */
function handleSave(){
  const plans = JSON.parse(localStorage.getItem('tm_saved')||'[]');
  plans.push({ id: crypto.randomUUID(), at: new Date().toISOString(), html: $('#preview').innerHTML });
  localStorage.setItem('tm_saved', JSON.stringify(plans));
  alert('Saved locally.');
}

/* ---- config ---- */
async function loadConfig(){
  try{
    const j = await fetch('/api/config').then(r=>r.json());
    CONFIG = j || {};
    if(!CONFIG.googleMapsKey){
      $('#mapNotice').textContent = 'To enable the live map, add GOOGLE_MAPS_API_KEY on the server and restrict it to your domain.';
    }
  }catch{ /* ignore */ }
}

/* ---- Google Maps ---- */
function loadGoogleMaps(key){
  return new Promise((resolve, reject)=>{
    if (GMAPS_LOADED && window.google) return resolve();
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    s.async = true;
    s.onload = ()=> { GMAPS_LOADED = true; resolve(); };
    s.onerror = ()=> reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(s);
  });
}

async function plotOnMap(){
  if(!window.__PLAN_ID__) return alert('Generate a full plan first.');
  try{
    const ptsResp = await fetch(`/api/plan/${window.__PLAN_ID__}/points`).then(r=>r.json());
    const { destination, points } = ptsResp;
    if(!points || !points.length) return alert('No mappable places found in the plan yet.');

    if(!CONFIG.googleMapsKey) return alert('Server has no GOOGLE_MAPS_API_KEY. Add it to enable the map.');

    await loadGoogleMaps(CONFIG.googleMapsKey);
    GEOCODER = GEOCODER || new google.maps.Geocoder();
    if(!MAP){
      MAP = new google.maps.Map(document.getElementById('itineraryMap'), {
        zoom: 13,
        center: { lat: 52.52, lng: 13.405 } // Berlin fallback
      });
    }
    const bounds = new google.maps.LatLngBounds();
    let idx = 0;

    const geocodeNext = ()=>{
      if(idx >= points.length){ MAP.fitBounds(bounds); return; }
      const p = points[idx++];

      GEOCODER.geocode({ address: `${p.query}, ${destination}` }, (res, status)=>{
        if(status === 'OK' && res && res[0]){
          const loc = res[0].geometry.location;
          const marker = new google.maps.Marker({
            map: MAP,
            position: loc,
            title: p.name
          });
          const info = new google.maps.InfoWindow({ content: `<strong>${p.name}</strong><br><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.query)}">Open in Maps</a>` });
          marker.addListener('click', ()=> info.open({ map: MAP, anchor: marker }));
          bounds.extend(loc);
        }
        setTimeout(geocodeNext, 250); // simple throttle
      });
    };
    geocodeNext();
  }catch(e){
    console.error(e);
    alert('Could not plot the map. Check console.');
  }
}

/* ---- bind ---- */
function bind(){
  $('#tripForm')?.addEventListener('submit', handleGenerate);
  $('#buyBtn')?.addEventListener('click', handleFull);
  $('#saveBtn')?.addEventListener('click', handleSave);
  $('#plotBtn')?.addEventListener('click', plotOnMap);

  // kids toggle show/hide (if present)
  const kidsToggle = $('#withKids');
  const kidsFields = $('#kidsFields');
  if (kidsToggle && kidsFields){
    kidsToggle.addEventListener('change', (e)=>{
      const on = e.target.checked;
      kidsFields.style.display = on ? 'grid' : 'none';
      if (!on){ byName('children').value='0'; byName('childrenAges').value=''; }
    });
  }
}

loadConfig().then(bind);
