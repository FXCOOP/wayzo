/* eslint-disable no-console */
import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { marked } from 'marked';
import OpenAI from 'openai';

// ---------- Paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const FRONTEND_DIR = path.join(REPO_ROOT, 'frontend');
const DOCS_DIR = path.join(REPO_ROOT, 'docs');
let INDEX_FILE = path.join(FRONTEND_DIR, 'index.backend.html');
if (!fs.existsSync(INDEX_FILE)) {
  const alt = path.join(FRONTEND_DIR, 'index.html');
  if (fs.existsSync(alt)) INDEX_FILE = alt;
}

// ---------- App ----------
const app = express();
const PORT = Number(process.env.PORT || 10000);

app.set('trust proxy', 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);
app.use(compression());
app.use(morgan('tiny'));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: true },
  })
);

// ---------- Static ----------
app.use(
  '/docs',
  express.static(DOCS_DIR, {
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=604800'),
  })
);
app.use(
  express.static(FRONTEND_DIR, {
    setHeaders: (res, filePath) => {
      if (/\.css$/i.test(filePath)) res.setHeader('Content-Type', 'text/css; charset=utf-8');
      if (/\.js$/i.test(filePath))  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      if (/\.(css|js|svg|png|jpg|jpeg|webp|ico)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

// Root -> index
app.get('/', (_req, res) => {
  if (!fs.existsSync(INDEX_FILE)) return res.status(500).send('index file missing');
  res.sendFile(INDEX_FILE);
});

// ---------- Health ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// ---------- DB ----------
const dbPath = path.join(REPO_ROOT, 'wayzo.sqlite');
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

const nowIso = () => new Date().toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

// ---------- Affiliates ----------
function affiliatesFor(dest = '') {
  const q = encodeURIComponent(dest || '');
  return {
    maps:      `https://www.google.com/maps/search/?api=1&query=${q}`,
    flights:   `https://www.kayak.com/flights?search=${q}`,
    hotels:    `https://www.booking.com/searchresults.html?ss=${q}`,
    activities:`https://www.getyourguide.com/s/?q=${q}`,
    cars:      `https://www.rentalcars.com/SearchResults.do?destination=${q}`,
    insurance: `https://www.worldnomads.com/`,
    reviews:   `https://www.tripadvisor.com/Search?q=${q}`,
  };
}

// ---------- Local fallback content ----------
function localPlanMarkdown(input) {
  const {
    destination = 'Your destination',
    start = 'start', end = 'end',
    budget = 1500, travelers = 2,
    level = 'budget', prefs = '',
  } = input || {};
  return `# ${destination} itinerary (${start} → ${end})

**Party:** ${travelers} • **Style:** ${level} • **Budget:** $${budget}

**Preferences:** ${prefs || '—'}

---

## Trip Summary
- Balanced mix of must-sees and local gems in ${destination}.
- Cluster sights by neighborhood to minimize transit.

## Day 1
- **Morning:** Historic center
- **Afternoon:** Market & park
- **Evening:** Classic local dinner

## Day 2
- **Morning:** Headliner museum
- **Afternoon:** River walk
- **Evening:** Food hall + dessert

---

## Rough Costs
- **Accommodation:** varies by style
- **Food:** $25–$45 pp/day
- **Activities:** $10–$25 / museum
- **Transit:** day passes are best value
`;
}

// ---------- Optional OpenAI ----------
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function generateWithOpenAI(payload) {
  // Tighter prompt: time slots, logistics, no raw URLs (we attach affiliates)
  const sys =
    'You are a travel planner. Produce a realistic, concise, day-by-day itinerary with time blocks (Morning/Afternoon/Evening), practical logistics (transit modes, durations, neighborhoods), and 2–3 specific food picks per day when appropriate. Output strictly in Markdown (no HTML). Do NOT include any raw URLs. Use short paragraphs and bullet lists.';

  const user = `Destination: ${payload.destination}
Dates: ${payload.start} → ${payload.end}
Travelers: ${payload.travelers}
Style: ${payload.level}
Budget(USD): ${payload.budget}
Preferences: ${payload.prefs || '-'}

Return an elegant Markdown itinerary only. Avoid URLs; we'll attach maps/booking links.`;

  const resp = await openai.chat.completions.create({
    model: process.env.WAYZO_MODEL || 'gpt-4o-mini',
    temperature: 0.6,
    messages: [
      { role: 'system', content: sys },
      { role: 'user',   content: user },
    ],
  });
  return resp.choices?.[0]?.message?.content?.trim() || '';
}

// ---------- API ----------
app.post('/api/preview', (req, res) => {
  const payload = req.body || {};
  const id = uid();
  const { destination = '' } = payload;

  const teaser = `
<div>
  <h3 class="h3">${destination || 'Your destination'} — preview</h3>
  <ul>
    <li>Morning / Afternoon / Evening blocks</li>
    <li>Neighborhood clustering to reduce transit</li>
    <li>Use <b>Generate full plan (AI)</b> for a complete schedule</li>
  </ul>
</div>`.trim();

  const aff = affiliatesFor(destination);
  savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'preview', data: payload, teaser_html: teaser, affiliates: aff }));
  res.json({ id, teaser_html: teaser, affiliates: aff });
});

app.post('/api/plan', async (req, res) => {
  const payload = req.body || {};
  const id = uid();

  try {
    let markdown = localPlanMarkdown(payload);
    if (openaiEnabled) {
      const out = await generateWithOpenAI(payload);
      if (out) markdown = out;
    }
    const aff = affiliatesFor(payload.destination);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown, affiliates: aff }));
    res.json({ id, markdown, affiliates: aff });
  } catch (e) {
    console.error('AI error → fallback to local:', e);
    const markdown = localPlanMarkdown(payload);
    const aff = affiliatesFor(payload.destination);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown, affiliates: aff }));
    res.json({ id, markdown, affiliates: aff });
  }
});

// HTML “PDF view”
app.get('/api/plan/:id/pdf', (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const saved = JSON.parse(row.payload || '{}');

  const html = `
  <html><head><meta charset="utf-8"/>
  <title>Wayzo PDF</title>
  <style>
    body{font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:24px;color:#0f172a}
    h1,h2,h3{margin:.8rem 0 .4rem}
    ul{margin:.3rem 0 .6rem 1.2rem}
    .muted{color:#64748b}
    @media print { a { color: inherit; text-decoration: none; } }
  </style></head>
  <body>
    ${marked.parse(saved.markdown || '')}
    <p class="muted">Generated by Wayzo</p>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// SPA catch-all
app.get(/^\/(?!api\/).*/, (_req, res) => {
  if (!fs.existsSync(INDEX_FILE)) return res.status(500).send('index file missing');
  res.sendFile(INDEX_FILE);
});

app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log('Serving frontend from:', FRONTEND_DIR);
  console.log('Serving docs from:', DOCS_DIR);
  console.log('Index file:', INDEX_FILE);
});
