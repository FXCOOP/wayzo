const API = window.location.origin;
const $ = (s)=>document.querySelector(s);
const byName = (n)=>document.querySelector(`[name="${n}"]`);

/* ---------- Dynamic side image (with fallback) ---------- */
function updateSideImage(city){
  const q = (city && city.trim()) ? encodeURIComponent(city) : 'travel';
  const fig = document.getElementById('heroFigureImg');
  if(!fig) return;

  const src = `https://source.unsplash.com/1200x720/?${q},scenic,landmark`;

  // inline SVG fallback (always allowed by CSP via data:)
  const FALLBACK_SVG =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 720'>
         <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
           <stop offset='0' stop-color='#10b981'/><stop offset='1' stop-color='#2563eb'/>
         </linearGradient></defs>
         <rect width='1200' height='720' fill='url(#g)' opacity='.4'/>
         <text x='50%' y='55%' text-anchor='middle' font-size='56' font-family='Segoe UI, Roboto, Arial' fill='#fff' opacity='.95'>
           Wayzo — ${city ? city : 'Travel'}
         </text>
       </svg>`
    );

  const onErr = () => { fig.src = FALLBACK_SVG; fig.removeEventListener('error', onErr); };
  fig.addEventListener('error', onErr, { once: true });

  fig.src = src;
  fig.alt = city ? `Travel inspiration: ${city}` : 'Travel inspiration';
}

// init + debounce typing
(function(){
  updateSideImage('');
  const dest = byName('destination');
  if(dest && dest.value) updateSideImage(dest.value);
  let t;
  dest && dest.addEventListener('input', (e)=>{ clearTimeout(t); t = setTimeout(()=> updateSideImage(e.target.value), 400); });
})();

/* ---------- Minimal markdown -> HTML (with tables + linkify) ---------- */
function simpleMarkdown(md){
  if(!md) return '';

  // GitHub-style table (header | sep | rows)
  md = md.replace(
    /(?:^|\n)\|([^\n]+)\|\n\|[ :\-|]+\|\n((?:\|[^\n]+\|\n?)+)/g,
    (_m, header, body) => {
      const th = header.split('|').map(h => `<th>${h.trim()}</th>`).join('');
      const rows = body.trim().split('\n').map(r => {
        const cells = r.replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>`<td>${c.trim()}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      return `\n<table class="md"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table>\n`;
    }
  );

  // Headings, lists, bold, markdown links
  md = md.replace(/^### (.*)$/gm,'<h3>$1</h3>')
         .replace(/^## (.*)$/gm,'<h2>$1</h2>')
         .replace(/^# (.*)$/gm,'<h1>$1</h1>')
         .replace(/^\- (.*)$/gm,'<li>$1</li>')
         .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
         .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Linkify bare URLs
  md = md.replace(/(^|\s)(https?:\/\/[^\s<>()]+)(?=$|\s)/g, (m, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener">${url}</a>`);

  // Wrap list items with <ul>
  md = md.replace(/(<li>.*<\/li>)(\n(?!<li>))/g,'<ul>$1</ul>\n');

  // Paragraphs
  md = md.split(/\n{2,}/).map(b=>{
    const t = b.trim();
    if(!t) return '';
    if(/^<h\d|<ul>|<li>|<table/.test(t)) return t;
    return '<p>'+t.replace(/\n/g,'<br>')+'</p>';
  }).join('\n');

  return `<div class="md">${md}</div>`;
}

/* ---------- Helpers ---------- */
function setLinks(aff){
  if(!aff) return;
  $('#linkFlights').href   = aff.flights;
  $('#linkHotels').href    = aff.hotels;
  $('#linkActivities').href= aff.activities;
  $('#linkCars').href      = aff.cars;
  $('#linkInsurance').href = aff.insurance;
  $('#linkReviews').href   = aff.reviews;
}
function showLoading(on){ $('#loading').classList.toggle('hidden', !on); }

/* ---------- API calls ---------- */
async function callJSON(url, body){
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
  let payload = {}; try { payload = await r.json(); } catch {}
  if(!r.ok){ const msg = payload && (payload.error || JSON.stringify(payload)); throw new Error(`${r.status} ${r.statusText}: ${msg || 'Unknown error'}`); }
  return payload;
}

async function handleGenerate(e){
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  const body = {
    destination: data.destination, start: data.start, end: data.end,
    budget: Number(data.budget||0), travelers: Number(data.travelers||1),
    level: data.level, prefs: data.prefs || ''
  };
  showLoading(true);
  try{
    const j = await callJSON(`${API}/api/preview`, body);
    window.__PLAN_ID__ = j.id;
    $('#preview').innerHTML = j.teaser_html || 'Preview unavailable';
    setLinks(j.affiliates);
    localStorage.setItem('tm_last', JSON.stringify(body));
  }catch(err){ console.error(err); alert('Preview failed: ' + err.message); }
  finally{ showLoading(false); }
}

async function handleFull(){
  const last = JSON.parse(localStorage.getItem('tm_last') || 'null');
  if(!last){ alert('Generate a preview first.'); return; }
  showLoading(true);
  try{
    const j = await callJSON(`${API}/api/plan`, last);
    window.__PLAN_ID__ = j.id;
    $('#preview').innerHTML = simpleMarkdown(j.markdown || '# Plan unavailable');
    $('#pdfBtn').classList.remove('hidden');
    $('#pdfBtn').href = `/api/plan/${j.id}/pdf`;
    setLinks(j.affiliates);
  }catch(err){ console.error(err); alert('Full plan failed: ' + err.message + '\nTip: check OPENAI_API_KEY in backend/.env'); }
  finally{ showLoading(false); }
}

function handleSave(){
  const plans = JSON.parse(localStorage.getItem('tm_saved')||'[]');
  plans.push({ id: crypto.randomUUID(), at: new Date().toISOString(), html: $('#preview').innerHTML });
  localStorage.setItem('tm_saved', JSON.stringify(plans));
  alert('Saved locally.');
}

/* ---------- Bind + hydrate ---------- */
(function hydrate(){
  const last = JSON.parse(localStorage.getItem('tm_last')||'null'); if(!last) return;
  for(const [k,v] of Object.entries(last)){
    const el = byName(k); if(!el) continue;
    if(el.type==='radio'){ const r=document.querySelector(`input[name="level"][value="${last.level}"]`); r && (r.checked=true); }
    else el.value = v;
  }
})();

document.getElementById('tripForm').addEventListener('submit', handleGenerate);
document.getElementById('buyBtn').addEventListener('click', handleFull);
document.getElementById('saveBtn').addEventListener('click', handleSave);
