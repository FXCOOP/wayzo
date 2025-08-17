// Tiny helpers
const $ = (s) => document.querySelector(s);
const byName = (n) => document.querySelector(`[name="${n}"]`);

function simpleMarkdown(md){
  if (!md) return '';
  md = md.replace(/^### (.*)$/gm,'<h3>$1</h3>')
         .replace(/^## (.*)$/gm,'<h2>$1</h2>')
         .replace(/^# (.*)$/gm,'<h1>$1</h1>')
         .replace(/^\- (.*)$/gm,'<li>$1</li>')
         .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
         .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank">$1</a>');
  md = md.replace(/(<li>.*<\/li>)(\n(?!<li>))/g,'<ul>$1</ul>\n');
  md = md.split(/\n{2,}/).map(b=>{
    if(/^<h\d|<ul>|<li>/.test(b.trim())) return b;
    return '<p>'+b.replace(/\n/g,'<br>')+'</p>';
  }).join('\n');
  return `<div class="md">${md}</div>`;
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

// Preview
function handleGenerate(e){
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.budget    = Number(data.budget||0);
  data.travelers = Number(data.travelers||1);

  fetch('/api/preview', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(data)
  }).then(r=>r.json()).then(j=>{
    window.__PLAN_ID__ = j.id;
    $('#preview').innerHTML = j.teaser_html || 'Preview unavailable';
    setLinks(j.affiliates);
    localStorage.setItem('tm_last', JSON.stringify(data));
  }).catch(err=>{
    console.error(err);
    alert('Preview failed. Is backend running?');
  });
}

// Full plan
function handleFull(){
  const last = JSON.parse(localStorage.getItem('tm_last')||'null');
  if(!last){ alert('Generate a preview first.'); return; }
  fetch('/api/plan', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(last)
  }).then(r=>r.json()).then(j=>{
    window.__PLAN_ID__ = j.id;
    $('#preview').innerHTML = simpleMarkdown(j.markdown || '# Plan unavailable');
    $('#pdfBtn').classList.remove('hidden');
    $('#pdfBtn').href = `/api/plan/${j.id}/pdf`;
    setLinks(j.affiliates);
  }).catch(err=>{
    console.error(err);
    alert('Full plan failed.');
  });
}

// Save preview locally
function handleSave(){
  const plans = JSON.parse(localStorage.getItem('tm_saved')||'[]');
  plans.push({ id: crypto.randomUUID(), at: new Date().toISOString(), html: $('#preview').innerHTML });
  localStorage.setItem('tm_saved', JSON.stringify(plans));
  alert('Saved locally.');
}

// Hydrate previous inputs
(function hydrate(){
  const last = JSON.parse(localStorage.getItem('tm_last')||'null'); if(!last) return;
  for(const [k,v] of Object.entries(last)){
    const el = byName(k); if(!el) continue;
    if(el.type==='radio'){
      const r = document.querySelector(`input[name="level"][value="${last.level}"]`);
      if (r) r.checked = true;
    } else {
      el.value = v;
    }
  }
})();

document.getElementById('tripForm').addEventListener('submit', handleGenerate);
document.getElementById('buyBtn').addEventListener('click', handleFull);
document.getElementById('saveBtn').addEventListener('click', handleSave);
