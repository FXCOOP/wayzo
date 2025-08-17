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

/* ---------------- Paths (Render Root Directory = backend) ---------------- */
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

let indexFile = path.join(frontendDir, 'index.backend.html');
if (!fs.existsSync(indexFile)) {
  const alt = path.join(frontendDir, 'index.html');
  if (fs.existsSync(alt)) indexFile = alt;
}

console.log('Serving frontend from:', frontendDir);
console.log('Serving docs from:', docsDir);
console.log('Index file:', indexFile);

/* --------------------------------- App ---------------------------------- */
const app = express();
const PORT = Number(process.env.PORT || 8080);

// trust exactly one proxy (Render)
app.set('trust proxy', 1);

// secure headers (CSP disabled to allow your external CSS/JS)
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
app.use(compression());
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// rate limit; safe with trust proxy = 1
app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false, validate: { trustProxy: true } }));

/* ---------------------------------- DB ---------------------------------- */
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

/* ------------------------------- Helpers -------------------------------- */
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
      <li>Top sights, food & neighborhoods tailored to you.</li>
      <li>Morning / Afternoon / Evening blocks for easy pacing.</li>
      <li>Use <b>Generate full plan (AI)</b> for a complete schedule & costs.</li>
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
- Balanced mix of must-sees and local gems in ${destination}.
- Grouped by neighborhoods to minimize transit.
- Booking shortcuts adapt to **${destination}**.

## Day by Day (sample)
### Day 1
- **Morning**: Historic center & museum  
- **Afternoon**: Market + street food  
- **Evening**: Neighborhood bistro

### Day 2
- **Morning**: Headline sight  
- **Afternoon**: Park/river loop  
- **Evening**: Food hall + dessert

---

## Cost Overview (rough)
- **Accommodation**: varies by style
- **Food**: $20–$40 pp/day
- **Activities**: museums $10–$25
- **Transport**: day passes are best value

Happy travels!`;
}

/* ------------------------------- OpenAI --------------------------------- */
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

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
  if (last) {
    try { return JSON.parse(last); } catch { /* ignore */ }
  }
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

function stripJsonFromText(text) {
  return text.replace(/```json[\s\S]*?```/g, '').trim();
}

async function generateAIPlan(payload) {
  const sysPath  = path.join(repoRoot, 'prompts', 'wayzo_system.txt');
  const usrPath  = path.join(repoRoot, 'prompts', 'wayzo_user.txt');
  const system   = fs.readFileSync(sysPath, 'utf8');
  const userTpl  = fs.readFileSync(usrPath, 'utf8');

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
      { role:'system', content: system },
      { role:'user',   content: user }
    ]
  });

  const text = resp.choices?.[0]?.message?.content || '';
  const obj  = extractWayzoJson(text);
  const markdown = stripJsonFromText(text);
  return { markdown, wayzo: obj };
}

/* --------------------------------- API ---------------------------------- */
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/__debug', (_req, res) => {
  res.json({ now: nowIso(), node: process.version, openaiEnabled, paths: { repoRoot, frontendDir, indexFile, docsDir, dbPath } });
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
    console.error('AI plan error → fallback to local:', err);
    const markdown = localPlanMarkdown(payload);
    const aff = affiliatesFor(payload.destination);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type:'plan', data:payload, markdown, wayzo:null, affiliates:aff }));
    res.json({ id, markdown, wayzo:null, affiliates: aff });
  }
});

app.get('/api/plan/:id/json', (req, res) => {
  const row = getPlan.get(req.params.id);
  if (!row) return res.status(404).send('Plan not found');
  const saved = JSON.parse(row.payload);
  res.json(saved.wayzo || {});
});

app.get('/api/plan/:id/pdf', (req, res) => {
  const row = getPlan.get(req.params.id);
  if (!row) return res.status(404).send('Plan not found');
  const { markdown } = JSON.parse(row.payload || '{}');
  const html = `<!doctype html>
  <html><head>
    <meta charset="utf-8"/>
    <title>Wayzo Plan</title>
    <style>
      body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.55; margin: 24px;}
      h1,h2,h3{margin:.6em 0}
      ul{margin:.4em 0 .6em 1.2em}
      .footer{margin-top:2rem; font-size:12px; color:#475569}
      a{color:#2563eb; text-decoration:none}
    </style>
  </head>
  <body>
    <div class="content">${marked.parse(markdown || '# Plan')}</div>
    <div class="footer">Generated by Wayzo — wayzo.online</div>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/* ------------------------------- Static --------------------------------- */
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

// Catch-all AFTER static
app.get('/', (_req, res) => fs.existsSync(indexFile) ? res.sendFile(indexFile) : res.status(500).send('index file missing'));
app.get(/^\/(?!api\/).*/, (_req, res) => fs.existsSync(indexFile) ? res.sendFile(indexFile) : res.status(500).send('index file missing'));

/* -------------------------------- Start --------------------------------- */
app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log(`Serving frontend from: ${frontendDir}`);
});
