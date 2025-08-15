// Wayzo frontend logic

const $ = (s)=>document.querySelector(s);
const byName = (n)=>document.querySelector(`[name="${n}"]`);
const state = { planId: null, mapSearch: '' };

function simpleMarkdown(md){
  // Minimal Markdown → HTML
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

function showLoading(on){
  $('#loading').classList.toggle('hidden', !on);
}

function setLinks(aff){
  if(!aff) return;
  $('#linkFlights').href    = aff.flights;
  $('#linkHotels').href     = aff.hotels;
  $('#linkActivities').href = aff.activities;
  $('#linkCars').href       = aff.cars;
  $('#linkInsurance').href  = aff.insurance;
  $('#linkReviews').href    = aff.reviews;
}

function hydrate(){
  const last = JSON.parse(localStorage.getItem('tm_last')||'null'); if(!last) return;
  for(const [k,v] of Object.entries(last)){
    const el = byName(k); if(!el) continue;
    if(el.type==='radio'){
      const r=document.querySelector(`input[name="level"][value="${last.level}"]`); r && (r.checked=true);
    } else el.value = v;
  }
}
document.getElementById('year').textContent = new Date().getFullYear();
hydrate();

/* ---- Preview */
document.getElementById('tripForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.budget = Number(data.budget||0);
  data.travelers = Number(data.travelers||1);

  showLoading(true);
  try{
    const r = await fetch('/api/preview',{
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data)
    });
    const j = await r.json();
    state.planId = j.id;
    state.mapSearch = j.mapSearch || encodeURIComponent(data.destination||'');
    $('#preview').innerHTML = j.teaser_html || 'Preview unavailable.';
    setLinks(j.affiliates);
    localStorage.setItem('tm_last', JSON.stringify(data));
    $('#mapWrap').classList.add('hidden'); // only show map after full plan
  }catch(err){
    console.error(err);
    alert('Preview failed. Is the backend live?');
  }finally{
    showLoading(false);
  }
});

/* ---- Full plan */
document.getElementById('buyBtn').addEventListener('click', async ()=>{
  const last = JSON.parse(localStorage.getItem('tm_last')||'null');
  if(!last){ alert('Please generate a preview first.'); return; }

  showLoading(true);
  try{
    const r = await fetch('/api/plan',{
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(last)
    });
    if(!r.ok){ const t=await r.text(); throw new Error(t); }
    const j = await r.json();
    state.planId = j.id;
    state.mapSearch = j.mapSearch || encodeURIComponent(last.destination||'');
    const html = simpleMarkdown(j.markdown || '# Plan unavailable');
    $('#preview').innerHTML = html;
    setLinks(j.affiliates);
    const pdf = document.getElementById('pdfBtn');
    pdf.classList.remove('hidden');
    pdf.href = `/api/plan/${j.id}/pdf`;

    // now allow the map block
    $('#mapWrap').classList.remove('hidden');
  }catch(err){
    console.error(err);
    alert('Full plan failed. Check OPENAI_API_KEY on backend.');
  }finally{
    showLoading(false);
  }
});

/* ---- Save */
document.getElementById('saveBtn').addEventListener('click', ()=>{
  const plans = JSON.parse(localStorage.getItem('tm_saved')||'[]');
  plans.push({ id: crypto.randomUUID(), at: new Date().toISOString(), html: $('#preview').innerHTML });
  localStorage.setItem('tm_saved', JSON.stringify(plans));
  alert('Saved locally.');
});

/* ---- Map */
document.getElementById('plotBtn').addEventListener('click', ()=>{
  const q = state.mapSearch || '';
  if(!q){ return alert('Generate a full plan first.'); }
  // Simple: open a search centered on the destination; user can save list/route in Maps
  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
});
