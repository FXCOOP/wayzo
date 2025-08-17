/* eslint-disable no-console */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { marked } from 'marked';
import OpenAI from 'openai';

// ---------------- Paths (stable and safe) ----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const repoRoot   = path.resolve(__dirname, '..');

const FRONTEND_CANDIDATES = [
  path.join(repoRoot, 'frontend'),
  path.join(__dirname, 'frontend'),
  path.resolve(process.cwd(), 'frontend')
];
let frontendDir = FRONTEND_CANDIDATES.find(p => fs.existsSync(p)) || FRONTEND_CANDIDATES[0];

const docsDir = fs.existsSync(path.join(repoRoot, 'docs'))
  ? path.join(repoRoot, 'docs')
  : path.join(frontendDir);

// index.html fallback if index.backend.html missing
let indexFile = path.join(frontendDir, 'index.backend.html');
if (!fs.existsSync(indexFile)) {
  const alt = path.join(frontendDir, 'index.html');
  if (fs.existsSync(alt)) indexFile = alt;
}

console.log('Serving frontend from:', frontendDir);
console.log('Serving docs from:', docsDir);
console.log('Index file:', indexFile);

// ---------------- App ----------------
const app = express();
const PORT = Number(process.env.PORT || 8080);
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
app.use(compression());
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(cors());
app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false, validate: { trustProxy: true } }));

// ---------------- DB ----------------
const dbPath = path.join(repoRoot, 'wayzo.sqlite');
if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    payload TEXT NOT NULL
  );
`);
const savePlan = db.prepare('INSERT OR REPLACE INTO plans (id, created_at, payload) VALUES (?, ?, ?)');
const getPlan  = db.prepare('SELECT payload FROM plans WHERE id = ?');

// ---------------- Helpers ----------------
const nowIso = () => new Date().toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

function affiliatesFor(dest = '') {
  const q = encodeURIComponent(dest || '');
  return {
    flights:    `https://www.kayak.com/flights?query=${q}`,
    hotels:     `https://www.booking.com/searchresults.html?ss=${q}`,
    activities: `https://www.getyourguide.com/s/?q=${q}`,
    cars:       `https://www.rentalcars.com/SearchResults.do?destination=${q}`,
    insurance:  `https://www.worldnomads.com/`,
    reviews:    `https://www.tripadvisor.com/Search?q=${q}`
  };
}

function teaserHTML(input) {
  const { destination, start, end, level='budget', travelers=2 } = input || {};
  return `
  <div class="teaser">
    <h3>${destination || 'Your destination'} — ${level} style</h3>
    <p><b>${travelers}</b> traveler(s) · ${start || 'start'} → ${end || 'end'}</p>
    <ul>
      <li>Smart route grouping by neighborhood.</li>
      <li>3 anchor blocks per day (morning/afternoon/evening).</li>
      <li>Choose between two activity options per block in the full plan.</li>
    </ul>
  </div>`;
}

// Local fallback
function localPlanMarkdown(input) {
  const {
    destination='Your destination', start='start', end='end',
    budget=1500, travelers=2, level='budget', prefs=''
  } = input || {};
  return `# ${destination} Itinerary (${start} → ${end})

**Party:** ${travelers} traveler(s)  •  **Style:** ${level}  •  **Budget:** $${budget}

**Preferences:** ${prefs || '—'}

---

## Trip Summary
- Balanced mix of must-sees and local gems in ${destination}.
- Grouped by neighborhoods to minimize transit.
- Each block has **two options** in the full plan so you can pick A/B before exporting.

## Day by Day (sample)
### Day 1
- **Morning**: Historic center & museum  
- **Afternoon**: Market + street food  
- **Evening**: Neighborhood bistro

---

## Cost Overview (rough)
- Lodging varies by style • Food $20–$40 pp/day • Museums $10–$25 • Day passes are best value.
`;
}

// ---------------- OpenAI (conditional) ----------------
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const promptsDir = path.join(repoRoot, 'prompts');
const sysPath = path.join(promptsDir, 'wayzo_system.txt');
const usrPath = path.join(promptsDir, 'wayzo_user.txt');

function fillTemplate(tpl, vars) {
  return tpl
    .replaceAll('{{destination}}', vars.destination ?? '')
    .replaceAll('{{start}}', vars.start ?? '')
    .replaceAll('{{end}}', vars.end ?? '')
    .replaceAll('{{flex_enabled}}', String(vars.flex_enabled ?? false))
    .replaceAll('{{flex_days}}', String(vars.flex_days ?? 0))
    .replaceAll('{{adults}}', String(vars.adults ?? vars.travelers ?? 2))
    .replaceAll('{{children_suffix}}', vars.children_suffix ?? '')
    .replaceAll('{{style}}', vars.level ?? vars.style ?? 'budget')
    .replaceAll('{{pace}}', vars.pace ?? 'balanced')
    .replaceAll('{{daily_start}}', vars.daily_start ?? '09')
    .replaceAll('{{currency}}', vars.currency ?? 'USD')
    .replaceAll('{{budget_total}}', String(vars.budget ?? 0))
    .replaceAll('{{includes_flights}}', String(vars.includes_flights ?? true))
    .replaceAll('{{dietary}}', vars.dietary ?? 'none')
    .replaceAll('{{lodging_type}}', vars.lodging_type ?? 'hotel')
    .replaceAll('{{purpose_list}}', Array.isArray(vars.purpose) ? vars.purpose.join(', ') : (vars.purpose ?? ''))
    .replaceAll('{{prefs}}', vars.prefs ?? '')
    .replaceAll('{{max_drive_minutes}}', String(vars.max_drive_minutes ?? 90))
    .replaceAll('{{access_needs}}', vars.access_needs ?? 'none')
    .replaceAll('{{nap_windows}}', vars.nap_windows ?? 'n/a')
    .replaceAll('{{weather_notes}}', vars.weather_notes ?? 'seasonal conditions apply');
}

function extractWayzoJson(text) {
  const fence = /```json\s*([\s\S]*?)```/g;
  let last;
  for (const m of text.matchAll(fence)) last = m[1];
  if (last) { try { return JSON.parse(last); } catch { } }
  const idx = text.lastIndexOf('{"trip"');
  if (idx >= 0) {
    const slice = text.slice(idx);
    try {
      let depth = 0, end = -1;
      for (let i=0;i<slice.length;i++){
        if (slice[i]==='{') depth++;
        if (slice[i]==='}') { depth--; if (depth===0){ end = i+1; break; } }
      }
      if (end>0) return JSON.parse(slice.slice(0,end));
    } catch {}
  }
  return null;
}
const stripJsonFromText = (t)=> t.replace(/```json[\s\S]*?```/g, '').trim();

async function generateAIPlan(payload) {
  const system = fs.existsSync(sysPath) ? fs.readFileSync(sysPath,'utf8') : '';
  const userTpl = fs.existsSync(usrPath) ? fs.readFileSync(usrPath,'utf8') : '';

  const adults = Number(payload.adults ?? payload.travelers ?? 2);
  const children = Number(payload.children ?? 0);
  const childrenAges = payload.children_ages || [];
  const childrenSuffix = children > 0 ? ` + ${children} children (ages ${childrenAges.join(', ') || '—'})` : '';

  const vars = {
    ...payload,
    adults,
    children_suffix: childrenSuffix,
    flex_enabled: payload.flex_enabled ?? false,
    flex_days: payload.flex_days ?? 0,
    daily_start: payload.daily_start ?? '09',
    currency: payload.currency ?? 'USD',
    includes_flights: payload.includes_flights ?? true,
    lodging_type: payload.lodging_type ?? 'hotel',
    purpose: payload.purpose || [],
    max_drive_minutes: payload.max_drive_minutes ?? 90,
    access_needs: payload.access_needs ?? 'none',
    nap_windows: payload.nap_windows ?? 'n/a',
    weather_notes: payload.weather_notes ?? ''
  };

  const user = fillTemplate(userTpl, vars);

  const resp = await openai.chat.completions.create({
    model: process.env.WAYZO_MODEL || 'gpt-4o-mini',
    temperature: 0.6,
    messages: [
      { role:'system', content: system + `

IMPORTANT ADDITIONS:
- For each "blocks" item, include an "options" array with TWO alternatives:
  [{
    "title": "Option A title",
    "why": "1-2 sentence short explanation of why this is a good fit",
    "places": [...], "food": [...], "notes": "tips", 
    "images": [{"url": "https://source.unsplash.com/600x400/?{CITY}%20{PLACE}"}]
  },
  {
    "title": "Option B title",
    "why": "...",
    "places": [...], "food": [...], "notes": "...",
    "images": [{"url": "https://source.unsplash.com/600x400/?{CITY}%20{PLACE}"}]
  }]
- Keep the original "blocks" structure but the UI will primarily use "options".
- Include short explanations ("why") for key advice.
` },
      { role:'user',   content: user }
    ]
  });

  const text = resp.choices?.[0]?.message?.content || '';
  const obj  = extractWayzoJson(text);
  const markdown = stripJsonFromText(text);
  return { markdown, wayzo: obj };
}

// ---------------- API ----------------
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/__debug', (_req, res) => {
  res.json({ now: nowIso(), node: process.version, openaiEnabled, paths: { repoRoot, frontendDir, indexFile, docsDir, dbPath } });
});

// Preview (teaser)
app.post('/api/preview', (req, res) => {
  const payload = req.body || {};
  const id = uid();
  const teaser = teaserHTML(payload);
  const aff = affiliatesFor(payload.destination);
  savePlan.run(id, nowIso(), JSON.stringify({ id, type:'preview', data:payload, teaser_html:teaser, affiliates:aff }));
  res.json({ id, teaser_html: teaser, affiliates: aff });
});

// Full plan (AI if available)
app.post('/api/plan', async (req, res) => {
  const payload = req.body || {};
  const id = uid();
  try {
    let markdown = localPlanMarkdown(payload);
    let wayzo = null;

    if (openaiEnabled) {
      const out = await generateAIPlan(payload);
      if (out?.markdown) markdown = out.markdown.trim();
      if (out?.wayzo) wayzo = out.wayzo;
    }

    const aff = affiliatesFor(payload.destination);
    // add auto image as fallback for places if missing
    if (wayzo?.days) {
      for (const day of wayzo.days) {
        for (const blk of (day.blocks || [])) {
          for (const opt of (blk.options || [])) {
            (opt.places || []).forEach(p => {
              if (!p.images && !opt.images) {
                const q = encodeURIComponent(`${wayzo.trip?.destination || ''} ${p.name || ''}`);
                opt.images = [{ url: `https://source.unsplash.com/600x400/?${q}` }];
              }
            });
          }
        }
      }
    }

    savePlan.run(id, nowIso(), JSON.stringify({ id, type:'plan', data:payload, markdown, wayzo, affiliates:aff }));
    res.json({ id, markdown, wayzo, affiliates: aff });
  } catch (err) {
    console.error('AI plan error → fallback to local:', err);
    const markdown = localPlanMarkdown(payload);
    const aff = affiliatesFor(payload.destination);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type:'plan', data:payload, markdown, wayzo:null, affiliates:aff }));
    res.json({ id, markdown, wayzo:null, affiliates: aff });
  }
});

// Fetch JSON (for map & calendar)
app.get('/api/plan/:id/json', (req, res) => {
  const row = getPlan.get(req.params.id);
  if (!row) return res.status(404).send('Plan not found');
  const saved = JSON.parse(row.payload);
  res.json(saved.wayzo || {});
});

// ---- ICS Calendar export (honors user choices if provided) ----
function icsEscape(s=''){return s.replace(/[,;]/g,'\\$&').replace(/\n/g,'\\n');}
function dt(date, time='09'){ return (date || '').replaceAll('-','') + 'T' + (time.padStart(2,'0')) + '0000'; }

app.get('/api/plan/:id/ics', (req,res) => {
  const row = getPlan.get(req.params.id);
  if (!row) return res.status(404).send('Plan not found');
  const saved = JSON.parse(row.payload);
  const wayzo = saved.wayzo;
  if (!wayzo?.days?.length) return res.status(400).send('No structured plan');

  let choices = {};
  try { if (req.query.choices) choices = JSON.parse(Buffer.from(String(req.query.choices),'base64').toString()); } catch {}
  const tz = 'UTC'; // keep simple; can add tz later

  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Wayzo//Trip//EN\r\n';
  for (let d=0; d<wayzo.days.length; d++){
    const day = wayzo.days[d];
    const date = day.date;
    const blocks = day.blocks || [];
    const startHour = Number(wayzo.trip?.daily_start_time || '09');

    let hour = startHour;
    for (let b=0; b<blocks.length; b++){
      const blk = blocks[b];
      let opt = (blk.options && blk.options[0]) || blk; // default A
      const key = `${d}:${b}`;
      if (choices[key] === 'B' && blk.options?.[1]) opt = blk.options[1];

      const title = `D${d+1} ${opt.title || blk.title || 'Activity'}`;
      const loc = (opt.places?.[0]?.name) || wayzo.trip?.destination || '';
      const url = (opt.places?.[0]?.gmaps_url) || '';
      const desc = icsEscape((opt.why ? `Why: ${opt.why}\n` : '') + (opt.notes || ''));

      const dtStart = dt(date, String(hour).padStart(2,'0'));
      hour = hour + 3; // 3h blocks
      const dtEnd = dt(date, String(hour).padStart(2,'0'));

      ics += `BEGIN:VEVENT\r\nDTSTART:${dtStart}\r\nDTEND:${dtEnd}\r\nSUMMARY:${icsEscape(title)}\r\nLOCATION:${icsEscape(loc)}\r\nDESCRIPTION:${desc}\r\nURL:${url}\r\nEND:VEVENT\r\n`;
    }
  }
  ics += 'END:VCALENDAR\r\n';

  res.setHeader('Content-Type','text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="wayzo-trip.ics"');
  res.send(ics);
});

// ---- GeoJSON for map (names only; client can geocode) ----
app.get('/api/plan/:id/geojson', (req,res) => {
  const row = getPlan.get(req.params.id);
  if (!row) return res.status(404).send('Plan not found');
  const saved = JSON.parse(row.payload);
  const w = saved.wayzo;
  if (!w?.days?.length) return res.json({ type:'FeatureCollection', features: [] });

  const features = [];
  let order=1;
  for (let i=0;i<w.days.length;i++){
    const day = w.days[i];
    for (const blk of (day.blocks || [])) {
      const options = blk.options || [];
      for (const opt of options) {
        for (const p of (opt.places || [])) {
          features.push({
            type: 'Feature',
            properties: { name: p.name, day: i+1, order: order++, url: p.gmaps_url || '' },
            geometry: { type: 'Point', coordinates: [0,0] } // client will geocode
          });
        }
      }
    }
  }
  res.json({ type:'FeatureCollection', features });
});

// ---- Map viewer page (Leaflet + client-side geocoding) ----
app.get('/plan/:id/map', (req,res) => {
  const id = req.params.id;
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Wayzo Trip Map</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{height:100%;margin:0}
  .legend{position:absolute;top:10px;left:10px;background:#fff;padding:8px 10px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.1);font:14px/1.3 system-ui;}
</style>
</head>
<body>
<div id="map"></div>
<div class="legend">Wayzo Map — points are geocoded live (Nominatim)</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(async function(){
  const res = await fetch('/api/plan/${id}/geojson');
  const gj = await res.json();
  const map = L.map('map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:'© OSM'}).addTo(map);

  const group = L.featureGroup(); group.addTo(map);

  async function geocode(name){
    const q = encodeURIComponent(name);
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&q='+q,{headers:{'Accept-Language':'en'}});
    const js = await r.json();
    if(js && js[0]) return [Number(js[0].lon), Number(js[0].lat)];
    return null;
  }

  for (const f of gj.features){
    const name = f.properties.name;
    const pos = await geocode(name);
    if(pos){
      const latlng = [pos[1], pos[0]];
      const m = L.marker(latlng).addTo(group).bindPopup('<b>'+name+'</b><br>Day '+(f.properties.day||'?'));
    }
    await new Promise(r=>setTimeout(r,350)); // polite throttle
  }

  setTimeout(()=> { if(group.getLayers().length){ map.fitBounds(group.getBounds().pad(0.2)); } else { map.setView([0,0],2);} }, 200);
})();
</script>
</body>
</html>`;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(html);
});

// ---- PDF page (HTML with A/B choices applied + map snapshot) ----
// choices param: base64(JSON like { "0:0": "A", "0:1": "B", ... })
app.get('/api/plan/:id/pdf', (req, res) => {
  const row = getPlan.get(req.params.id);
  if (!row) return res.status(404).send('Plan not found');
  const saved = JSON.parse(row.payload || '{}');
  const { markdown, wayzo } = saved;

  let choices = {};
  try { if (req.query.choices) choices = JSON.parse(Buffer.from(String(req.query.choices),'base64').toString()); } catch {}

  const html = `<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Wayzo Trip</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.55; margin: 20px;}
  h1,h2,h3{margin:.6em 0}
  .why{color:#0b6; font-weight:600}
  .imggrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:8px 0}
  .mapwrap{page-break-inside:avoid;margin:14px 0;padding:8px;border:1px solid #e5e7eb;border-radius:8px}
  .footer{margin-top:2rem; font-size:12px; color:#475569}
  img{max-width:100%; border-radius:8px}
</style>
</head>
<body>
  <h1>Wayzo Trip Plan</h1>

  <section id="md">${marked.parse(markdown || '# Plan')}</section>

  ${wayzo ? `
  <h2>Selected Options (A/B)</h2>
  <div id="chosen"></div>

  <h2>Trip Points Map</h2>
  <div class="mapwrap">
    <div id="map" style="height:360px;"></div>
    <div id="snap" style="margin-top:8px"></div>
    <small>Note: Map is rendered client-side from place names (OSM/Nominatim); positions are approximate.</small>
  </div>
  ` : ''}

  <div class="footer">Generated by Wayzo — wayzo.online</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-image/leaflet-image.js"></script>
<script>
  const wayzo = ${JSON.stringify(wayzo || {})};
  const choices = ${JSON.stringify(choices || {})};

  function renderChosen(){
    if(!wayzo.days){ return; }
    const root = document.getElementById('chosen');
    let html = '';
    for(let d=0; d<wayzo.days.length; d++){
      const day = wayzo.days[d];
      html += '<h3>'+ (day.label || ('Day '+(d+1))) +'</h3>';
      for(let b=0; b<(day.blocks||[]).length; b++){
        const blk = day.blocks[b];
        const opt = (choices[\`\${d}:\${b}\`] === 'B' && blk.options?.[1]) ? blk.options[1] : (blk.options?.[0] || blk);
        html += '<p><b>'+(opt.title || blk.title || 'Activity')+'</b>' + (opt.why? ' — <span class="why">'+opt.why+'</span>':'') + '</p>';
        if(opt.images?.length){
          html += '<div class="imggrid">';
          for(const im of opt.images.slice(0,2)) html += '<img src="'+im.url+'" loading="lazy"/>';
          html += '</div>';
        }
      }
    }
    root.innerHTML = html || '<p>—</p>';
  }

  async function buildMap(){
    if(!wayzo.days){ return; }
    const map = L.map('map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:'© OSM'}).addTo(map);
    const group = L.featureGroup().addTo(map);
    async function geocode(q){
      const url='https://nominatim.openstreetmap.org/search?format=json&q='+encodeURIComponent(q);
      const r = await fetch(url, {headers:{'Accept-Language':'en'}});
      const js = await r.json();
      if(js && js[0]) return [Number(js[0].lon), Number(js[0].lat)];
      return null;
    }
    for(let d=0; d<wayzo.days.length; d++){
      const day = wayzo.days[d];
      for(let b=0; b<(day.blocks||[]).length; b++){
        const blk = day.blocks[b];
        const opt = (choices[\`\${d}:\${b}\`] === 'B' && blk.options?.[1]) ? blk.options[1] : (blk.options?.[0] || blk);
        const first = opt.places && opt.places[0];
        if(first && first.name){
          const pos = await geocode(first.name + ' ' + (wayzo.trip?.destination||''));
          if(pos){
            const latlng=[pos[1],pos[0]];
            L.marker(latlng).addTo(group).bindPopup('<b>'+first.name+'</b> (Day '+(d+1)+')');
          }
        }
        await new Promise(r=>setTimeout(r,350));
      }
    }
    setTimeout(()=>{
      if(group.getLayers().length) map.fitBounds(group.getBounds().pad(0.2));
      else map.setView([0,0],2);

      // snapshot → image under the map
      window.leafletImage(map, function(err, canvas){
        if(err) return;
        const img = new Image();
        img.src = canvas.toDataURL('image/png');
        img.style.maxWidth='100%';
        document.getElementById('snap').appendChild(img);
      });
    },400);
  }

  renderChosen();
  buildMap();
</script>
</body></html>`;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(html);
});

// ---------------- Static ----------------
app.use('/docs', express.static(docsDir, { setHeaders: (res)=>res.setHeader('Cache-Control','public,max-age=604800') }));
app.use(express.static(frontendDir, {
  setHeaders: (res, filePath) => {
    if (/\.(css)$/i.test(filePath)) res.setHeader('Content-Type','text/css; charset=utf-8');
    if (/\.(js)$/i.test(filePath))  res.setHeader('Content-Type','application/javascript; charset=utf-8');
    if (/\.(css|js|svg|png|jpg|jpeg|webp|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    }
  }
}));
app.use('/assets', express.static(frontendDir));

app.get('/', (_req, res) => fs.existsSync(indexFile) ? res.sendFile(indexFile) : res.status(500).send('index file missing'));
app.get(/^\/(?!api\/).*/, (_req, res) => fs.existsSync(indexFile) ? res.sendFile(indexFile) : res.status(500).send('index file missing'));

// ---------------- Start ----------------
app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log(`Serving frontend from: ${frontendDir}`);
});
