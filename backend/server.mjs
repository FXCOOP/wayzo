/* Minimal + stable backend that keeps your current UI intact.
   Changes:
   - Better prompt for /api/plan (no UI change)
   - /api/plan/:id/pdf supports ?pro=1 (nicer layout + optional map snapshot)
   - /api/plan/latest/pdf[?pro=1] convenience link (no UI change)
*/

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

// ---------- Paths (keep original structure) ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const repoRoot   = path.resolve(__dirname, '..');
const frontendDir = path.join(repoRoot, 'frontend');           // <— DO NOT CHANGE
let indexFile = path.join(frontendDir, 'index.backend.html');  // <— Your simple UI
if (!fs.existsSync(indexFile)) {
  const alt = path.join(frontendDir, 'index.html');
  if (fs.existsSync(alt)) indexFile = alt;
}
const docsDir = fs.existsSync(path.join(repoRoot, 'docs')) ? path.join(repoRoot, 'docs') : frontendDir;

// ---------- App ----------
const app = express();
const PORT = Number(process.env.PORT || 8080);

app.use(compression());
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// ---------- DB ----------
const dbPath = path.join(repoRoot, 'wayzo.sqlite');
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
const getLatestPlan = db.prepare("SELECT payload FROM plans WHERE json_extract(payload, '$.type')='plan' ORDER BY created_at DESC LIMIT 1");

const nowIso = () => new Date().toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

// ---------- Helpers ----------
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
      <li>Neighborhood grouping to cut transit time</li>
      <li>Morning / Afternoon / Evening anchors</li>
      <li>Two options per block in the full plan</li>
    </ul>
  </div>`;
}

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
Balanced mix of must-sees and local gems in ${destination}. Each block has **two options** in the full plan so you can pick A/B before exporting.

## Day 1 (sample)
- **Morning**: Historic center & museum  
- **Afternoon**: Market + street food  
- **Evening**: Neighborhood bistro

---
`;
}

// ---------- OpenAI (optional) ----------
const openaiEnabled = !!process.env.OPENAI_API_KEY;
let OpenAI = null;
if (openaiEnabled) {
  // Lazy import to avoid breaking if package not present locally
  ({ default: OpenAI } = await import('openai'));
}
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Single in-code prompt (no extra files): keeps UI unchanged
function buildUserPrompt(p) {
  // Only include what you already collect in your form
  return `
Create a superb, practical, JSON-structured trip plan and ALSO a clear human-readable Markdown.

INPUT
- Destination: ${p.destination}
- Dates: ${p.start} to ${p.end}
- Travelers: ${p.travelers}
- Style: ${p.level}
- Budget (USD): ${p.budget}
- Preferences: ${p.prefs || '—'}

REQUIREMENTS
1) FIRST, return a compact JSON in a fenced code block (\`\`\`json ... \`\`\`) following this schema:

{
  "trip": {
    "destination": "City, Country",
    "start": "YYYY-MM-DD",
    "end": "YYYY-MM-DD",
    "style": "budget|mid|luxury",
    "daily_start_time": "09"
  },
  "days": [
    {
      "date": "YYYY-MM-DD",
      "label": "Day 1 - Neighborhood",
      "blocks": [
        {
          "title": "Morning anchor",
          "options": [
            {
              "title": "Option A title",
              "why": "Short benefit explanation (1–2 sentences)",
              "places": [
                { "name": "Place name", "gmaps_url": "https://maps.google.com/?q=..." }
              ],
              "food": [
                { "name": "Restaurant/cafe", "why": "brief reason" }
              ],
              "notes": "practical tip",
              "images": [
                { "url": "https://source.unsplash.com/800x500/?${encodeURIComponent(p.destination||'city')}" }
              ]
            },
            {
              "title": "Option B title",
              "why": "Short benefit explanation (1–2 sentences)",
              "places": [
                { "name": "Place name", "gmaps_url": "https://maps.google.com/?q=..." }
              ],
              "food": [
                { "name": "Restaurant/cafe", "why": "brief reason" }
              ],
              "notes": "practical tip",
              "images": [
                { "url": "https://source.unsplash.com/800x500/?${encodeURIComponent(p.destination||'city')}%20landmark" }
              ]
            }
          ]
        },
        { "title":"Afternoon anchor", "options":[ /* same pattern */ ] },
        { "title":"Evening anchor",   "options":[ /* same pattern */ ] }
      ]
    }
  ],
  "costs": {
    "lodging_per_night": "number or range",
    "food_per_day_per_person": "number",
    "local_transport": "tips/estimate",
    "tickets": "major passes or typical museum costs"
  },
  "tips": ["visa/health/safety/packing notes"]
}

2) THEN below the JSON, provide polished **Markdown** with:
- Title, intro, 1-paragraph trip overview
- Day-by-day sections (show both Option A and B with short “why”)
- Cost breakdown table
- Practical tips list

Always keep recommendations realistic for ${p.destination}.
  `.trim();
}

async function generateAIPlan(payload) {
  const messages = [
    {
      role: 'system',
      content:
`You are Wayzo, a world-class trip planner. Be concise, structured, and practical.
Return both: (1) a JSON block in \`\`\`json fences\`\`\` per the schema, and (2) human-friendly Markdown below it.
If real link unknown, leave gmaps_url blank or a generic Google Maps search URL.
Avoid hallucinating prices; use ranges or typical values.`
    },
    { role: 'user', content: buildUserPrompt(payload) }
  ];

  const model = process.env.WAYZO_MODEL || 'gpt-4o-mini';
  const resp = await openai.chat.completions.create({
    model,
    temperature: 0.6,
    messages
  });

  const text = resp.choices?.[0]?.message?.content || '';
  // extract JSON (last fenced block)
  let wayzo = null;
  const fence = /```json\s*([\s\S]*?)```/g;
  let last;
  for (const m of text.matchAll(fence)) last = m[1];
  if (last) {
    try { wayzo = JSON.parse(last); } catch {}
  }
  const markdown = text.replace(/```json[\s\S]*?```/g, '').trim();
  return { markdown, wayzo };
}

// ---------- API ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/__debug', (_req, res) => {
  res.json({
    now: nowIso(),
    openaiEnabled,
    frontendDir,
    indexFile,
    dbPath
  });
});

app.post('/api/preview', (req, res) => {
  const payload = req.body || {};
  const id = uid();
  const teaser = teaserHTML(payload);
  const aff = affiliatesFor(payload.destination);
  savePlan.run(id, nowIso(), JSON.stringify({ id, type:'preview', data:payload, teaser_html:teaser, affiliates:aff }));
  res.json({ id, teaser_html: teaser, affiliates: aff });
});

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
    savePlan.run(id, nowIso(), JSON.stringify({ id, type:'plan', data:payload, markdown, wayzo, affiliates:aff }));
    res.json({ id, markdown, wayzo, affiliates: aff });
  } catch (err) {
    console.error('AI error, sending fallback markdown:', err);
    const aff = affiliatesFor(payload.destination);
    const markdown = localPlanMarkdown(payload);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type:'plan', data:payload, markdown, wayzo:null, affiliates:aff }));
    res.json({ id, markdown, wayzo:null, affiliates: aff });
  }
});

// Convenience: latest plan -> redirect to pdf
app.get('/api/plan/latest/pdf', (req, res) => {
  const row = getLatestPlan.get();
  if (!row) return res.status(404).send('No plans yet');
  const saved = JSON.parse(row.payload);
  const pro = req.query.pro ? `?pro=${req.query.pro}` : '';
  res.redirect(`/api/plan/${saved.id}/pdf${pro}`);
});

// PDF page (classic + pro=1 improved)
app.get('/api/plan/:id/pdf', (req, res) => {
  const row = getPlan.get(req.params.id);
  if (!row) return res.status(404).send('Plan not found');
  const saved = JSON.parse(row.payload || '{}');
  const { markdown='', wayzo=null } = saved;
  const isPro = String(req.query.pro || '') === '1';

  if (!isPro) {
    // Classic: just render markdown on page with a tiny client-side converter
    const html = `<!doctype html>
<html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Wayzo Trip</title>
<style>
  body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height:1.55; margin: 24px;}
  h1,h2,h3{margin:.6em 0}
  .md h1{font-size:1.6rem}.md h2{font-size:1.3rem}.md h3{font-size:1.1rem}
  .md p{margin:.5rem 0}.md ul{margin:.5rem 0 .75rem 1.25rem}.md li{margin:.25rem 0}
</style>
</head>
<body>
  <h1>Wayzo Trip Plan</h1>
  <div id="root" class="md"></div>
<script>
  const md = ${JSON.stringify(markdown)};
  function simpleMarkdown(md){
    md = md.replace(/^### (.*)$/gm,'<h3>$1</h3>')
           .replace(/^## (.*)$/gm,'<h2>$1</h2>')
           .replace(/^# (.*)$/gm,'<h1>$1</h1>')
           .replace(/^\\- (.*)$/gm,'<li>$1</li>')
           .replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>')
           .replace(/\\[(.+?)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g,'<a href="$2" target="_blank">$1</a>');
    md = md.replace(/(<li>.*<\\/li>)(\\n(?!<li>))/g,'<ul>$1</ul>\\n');
    md = md.split(/\\n{2,}/).map(b=>/^<h\\d|<ul>|<li>/.test(b.trim())?b:'<p>'+b.replace(/\\n/g,'<br>')+'</p>').join('\\n');
    return '<div class="md">'+md+'</div>';
  }
  document.getElementById('root').innerHTML = simpleMarkdown(md || '# Plan');
</script>
</body></html>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.send(html);
  }

  // Pro PDF: use wayzo JSON if available
  const html = `<!doctype html>
<html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Wayzo Trip (Pro PDF)</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height:1.55; margin: 24px; color:#0f172a}
  h1,h2,h3{margin:.6em 0}
  .md h1{font-size:1.6rem}.md h2{font-size:1.3rem}.md h3{font-size:1.1rem}
  .md p{margin:.5rem 0}.md ul{margin:.5rem 0 .75rem 1.25rem}.md li{margin:.25rem 0}
  .why{color:#0b6;font-weight:600}
  .day{border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:10px 0}
  .block{border-top:1px dashed #e5e7eb;padding-top:10px;margin-top:10px}
  .opt{display:flex;gap:10px;align-items:flex-start;margin:8px 0}
  .opt img{width:160px;height:104px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb}
  .mapwrap{page-break-inside:avoid;margin:14px 0;padding:8px;border:1px solid #e5e7eb;border-radius:10px}
</style>
</head>
<body>
  <h1>Wayzo Trip Plan — Pro</h1>
  <section id="md" class="md"></section>

  ${wayzo ? `
  <h2>Your Plan (defaulting to Option A)</h2>
  <div id="plan"></div>

  <h2>Trip Map</h2>
  <div class="mapwrap">
    <div id="map" style="height:360px;"></div>
    <div id="snap" style="margin-top:8px"></div>
    <small>Approximate locations via OpenStreetMap/Nominatim.</small>
  </div>
  ` : ''}

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-image/leaflet-image.js"></script>
<script>
  const markdown = ${JSON.stringify(markdown)};
  const wayzo = ${JSON.stringify(wayzo || {})};

  function simpleMarkdown(md){
    md = md.replace(/^### (.*)$/gm,'<h3>$1</h3>')
           .replace(/^## (.*)$/gm,'<h2>$1</h2>')
           .replace(/^# (.*)$/gm,'<h1>$1</h1>')
           .replace(/^\\- (.*)$/gm,'<li>$1</li>')
           .replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>')
           .replace(/\\[(.+?)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g,'<a href="$2" target="_blank">$1</a>');
    md = md.replace(/(<li>.*<\\/li>)(\\n(?!<li>))/g,'<ul>$1</ul>\\n');
    md = md.split(/\\n{2,}/).map(b=>/^<h\\d|<ul>|<li>/.test(b.trim())?b:'<p>'+b.replace(/\\n/g,'<br>')+'</p>').join('\\n');
    return '<div class="md">'+md+'</div>';
  }
  document.getElementById('md').innerHTML = simpleMarkdown(markdown || '# Plan');

  function renderPlan(w){
    if(!w.days){ document.getElementById('plan').innerHTML = '<p>—</p>'; return; }
    let html='';
    for(let d=0; d<w.days.length; d++){
      const day = w.days[d];
      html += '<div class="day"><h3>'+ (day.label || ('Day '+(d+1))) +'</h3>';
      for(const blk of (day.blocks||[])){
        const opt = (blk.options && blk.options[0]) || blk;
        html += '<div class="block">';
        html += '<p><b>'+(opt.title || blk.title || 'Activity')+'</b>' + (opt.why? ' — <span class="why">'+opt.why+'</span>':'') + '</p>';
        if(opt.images?.length){
          html += '<div class="opt"><img src="'+opt.images[0].url+'" loading="lazy"/><div>';
          if(opt.places?.length){ html += '<div><b>Places:</b> '+opt.places.map(p=>p.name).join(', ')+'</div>'; }
          if(opt.food?.length){ html += '<div><b>Food:</b> '+opt.food.map(f=>f.name).join(', ')+'</div>'; }
          if(opt.notes){ html += '<div><b>Notes:</b> '+opt.notes+'</div>'; }
          html += '</div></div>';
        } else {
          if(opt.places?.length){ html += '<div><b>Places:</b> '+opt.places.map(p=>p.name).join(', ')+'</div>'; }
          if(opt.food?.length){ html += '<div><b>Food:</b> '+opt.food.map(f=>f.name).join(', ')+'</div>'; }
          if(opt.notes){ html += '<div><b>Notes:</b> '+opt.notes+'</div>'; }
        }
        html += '</div>';
      }
      html += '</div>';
    }
    document.getElementById('plan').innerHTML = html;
  }
  renderPlan(wayzo);

  async function buildMap(){
    if(!wayzo.days) return;
    const map = L.map('map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:'© OSM'}).addTo(map);
    const group = L.featureGroup().addTo(map);

    async function geocode(q){
      const u = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q);
      const r = await fetch(u, { headers:{'Accept-Language':'en'} });
      const js = await r.json();
      if(js && js[0]) return [Number(js[0].lon), Number(js[0].lat)];
      return null;
    }

    for (const day of wayzo.days){
      for (const blk of (day.blocks||[])){
        const opt = (blk.options && blk.options[0]) || blk;
        const first = opt.places && opt.places[0];
        if(first && first.name){
          const q = first.name + ' ' + (wayzo.trip?.destination||'');
          const pos = await geocode(q);
          if(pos){
            const latlng=[pos[1],pos[0]];
            L.marker(latlng).addTo(group).bindPopup('<b>'+first.name+'</b>');
          }
        }
        await new Promise(r=>setTimeout(r,350));
      }
    }

    setTimeout(()=>{
      if(group.getLayers().length) map.fitBounds(group.getBounds().pad(0.2));
      else map.setView([0,0],2);

      // snapshot below map
      window.leafletImage(map, function(err, canvas){
        if(err) return;
        const img = new Image();
        img.src = canvas.toDataURL('image/png');
        img.style.maxWidth='100%';
        document.getElementById('snap').appendChild(img);
      });
    }, 400);
  }
  buildMap();
</script>
</body></html>`;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(html);
});

// ---------- Static first, then catch-all (fixes MIME issues) ----------
app.use('/docs', express.static(docsDir));
app.use(express.static(frontendDir));  // serve /style.css, /app.js, images, etc.

app.get('/', (_req, res) => fs.existsSync(indexFile) ? res.sendFile(indexFile) : res.status(500).send('index file missing'));
app.get(/^\/(?!api\/).*/, (_req, res) => fs.existsSync(indexFile) ? res.sendFile(indexFile) : res.status(500).send('index file missing'));

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log(`Serving frontend from: ${frontendDir}`);
  console.log(`Root file: ${indexFile}`);
});
