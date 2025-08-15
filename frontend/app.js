/* Helpers */
const $ = (s)=>document.querySelector(s);
const byName = (n)=>document.querySelector(`[name="${n}"]`);

function simpleMarkdown(md){
  // headings, lists, bold, links
  md = md.replace(/^### (.*)$/gm,'<h3>$1</h3>')
         .replace(/^## (.*)$/gm,'<h2>$1</h2>')
         .replace(/^# (.*)$/gm,'<h1>$1</h1>')
         .replace(/^\- (.*)$/gm,'<li>$1</li>')
         .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
         .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  // wrap list groups
  md = md.replace(/(<li>.*<\/li>)(\n(?!<li>))/g,'<ul>$1</ul>\n');
  // paragraphs
  md = md.split(/\n{2,}/).map(b=>{
    if(/^<h\d|<ul>|<li>/.test(b.trim())) return b;
    return '<p>'+b.replace(/\n/g,'<br>')+'</p>';
  }).join('\n');
  return `<div class="prose">${md}</div>`;
}

function setLinks(aff){
  if(!aff) return;
  $('#linkFlights').href   = aff.flights;
  $('#linkHotels').href    = aff.hotels;
  $('#linkActivities').href= aff.activities;
  $('#linkCars').href      = aff.cars;
  $('#linkInsurance').href = aff.insurance;
  $('#linkReviews').href   = aff.reviews;
}

function loading(on){ $('#loading').classList.toggle('hidden', !on); }

/* — Preview — */
function onPreview(e){
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.budget = Number(data.budget||0);
  data.travelers = Number(data.travelers||1);

  loading(true);
  fetch('/api/preview', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(data)
  }).then(r=>r.json()).then(j=>{
    loading(false);
    window.__PLAN_ID__ = j.id;
    $('#preview').innerHTML = j.teaser_html || '<p>Preview unavailable.</p>';
    setLinks(j.affiliates);
    localStorage.setItem('tm_last', JSON.stringify(data));
  }).catch(err=>{ loading(false); console.error(err); alert('Preview failed. Is backend running with valid keys?'); });
}

/* — Full plan — */
async function onFull(){
  const last = JSON.parse(localStorage.getItem('tm_last')||'null');
  if(!last) return alert('Generate a preview first.');
  loading(true);
  try{
    const r = await fetch('/api/plan', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        destination:last.destination, start:last.start, end:last.end,
        budget:Number(last.budget||0), travelers:Number(last.travelers||1),
        level:last.level, prefs:last.prefs||''
      })
    });
    const j = await r.json();
    loading(false);

    if(!r.ok){ alert(`Full plan failed: ${r.status} : ${j.error||'Unknown error'}`); return; }

    window.__PLAN_ID__ = j.id;
    const html = simpleMarkdown(j.markdown || '# Plan unavailable');
    $('#preview').innerHTML = html;
    $('#pdfBtn').classList.remove('hidden');
    $('#pdfBtn').href = `/api/plan/${j.id}/pdf`;
    setLinks(j.affiliates);

    // Reveal map section now (CSP-safe: open a Maps tab with all points)
    $('#mapSection').classList.remove('hidden');
    $('#plotBtn').onclick = ()=> openGoogleMaps(j.markers || extractPOIsFromMarkdown(j.markdown||'', last.destination||''));
  }catch(err){
    loading(false); console.error(err); alert('Full plan failed. Check OPENAI_API_KEY on the backend.');
  }
}

/* Build a Google Maps search URL with all points */
function openGoogleMaps(names){
  try{
    const list = (names && names.length ? names : []).slice(0,15); // cap to 15 for URL size
    const q = encodeURIComponent(list.join(' • '));
    const url = `https://www.google.com/maps/search/${q}`;
    window.open(url, '_blank','noopener');
  }catch(e){ console.error(e); alert('Could not open map.'); }
}

/* Naive POI extractor (fallback when backend didn’t send markers) */
function extractPOIsFromMarkdown(md, dest){
  const lines = md.split('\n').map(s=>s.trim());
  const poi = [];
  const rx = /^(\-|\*)\s+([A-Za-z0-9][^:;,.]+?)(?:\s*[\:\-–—])/; // bullet “- Berlin Wall — …”
  for(const l of lines){
    const m = l.match(rx);
    if(m && !poi.includes(m[2]) && m[2].length > 3) poi.push(`${m[2]} ${dest}`);
    if(poi.length >= 15) break;
  }
  if(!poi.length && dest) poi.push(dest);
  return poi;
}

/* Save preview (local only) */
function onSave(){
  const plans = JSON.parse(localStorage.getItem('tm_saved')||'[]');
  plans.push({ id: crypto.randomUUID(), at: new Date().toISOString(), html: $('#preview').innerHTML });
  localStorage.setItem('tm_saved', JSON.stringify(plans));
  alert('Saved locally.');
}

/* Hydrate last form values */
(function hydrate(){
  const last = JSON.parse(localStorage.getItem('tm_last')||'null'); if(!last) return;
  for(const [k,v] of Object.entries(last)){
    const el = byName(k); if(!el) continue;
    if(el.type==='radio'){ const r=document.querySelector(`input[name="level"][value="${last.level}"]`); r && (r.checked=true); }
    else el.value = v;
  }
  $('#year').textContent = new Date().getFullYear();
})();

/* Bind */
document.getElementById('tripForm').addEventListener('submit', onPreview);
document.getElementById('buyBtn').addEventListener('click', onFull);
document.getElementById('saveBtn').addEventListener('click', onSave);
