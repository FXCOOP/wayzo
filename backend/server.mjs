/* eslint-disable no-console */
/**
 * Wayzo backend — stable, map-free baseline.
 * - Serves /frontend (repo root) correctly on Render (Root Directory = backend).
 * - Also serves /docs for images, PDFs, etc.
 * - Keeps preview/plan/PDF endpoints.
 */

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

// ---------- Resolve paths robustly ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// repo root is parent of /backend
const repoRoot = path.resolve(__dirname, '..');

// Prefer ../frontend (repo root). Fallbacks in case structure changes.
const FRONTEND_CANDIDATES = [
  path.join(repoRoot, 'frontend'),
  path.join(__dirname, 'frontend'),
  path.resolve(process.cwd(), 'frontend')
];

let frontendDir = FRONTEND_CANDIDATES.find(p => fs.existsSync(p)) || FRONTEND_CANDIDATES[0];
const docsDir = fs.existsSync(path.join(repoRoot, 'docs'))
  ? path.join(repoRoot, 'docs')
  : path.join(frontendDir); // fallback so /docs/* doesn’t 404 if you store images in frontend

// index file: use index.backend.html if present, else index.html
let indexFile = path.join(frontendDir, 'index.backend.html');
if (!fs.existsSync(indexFile)) {
  const alt = path.join(frontendDir, 'index.html');
  if (fs.existsSync(alt)) indexFile = alt;
}

console.log('Static root:', frontendDir);
console.log('Index file:', indexFile);
console.log('Docs dir:', docsDir);

// ---------- App ----------
const app = express();
const PORT = Number(process.env.PORT || 8080);

// Render/proxy aware (1 proxy = Render)
app.set('trust proxy', 1);

// Security (relaxed CSP to avoid blocking your inline/on-page code)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));

app.use(compression());
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// Rate limit (safe with trustProxy = 1)
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true }
}));

// ---------- SQLite (repo root) ----------
const dbPath = path.join(repoRoot, 'wayzo.sqlite');
const dbDir  = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

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

// ---------- Affiliates / Teaser / Markdown (local, no LLM) ----------
function affiliatesFor(dest = '') {
  const q = encodeURIComponent(dest || '');
  return {
    flights:    `https://www.kayak.com/flights?aff=YOUR_AFF_ID&query=${q}`,
    hotels:     `https://www.booking.com/searchresults.html?aid=YOUR_AFF_ID&ss=${q}`,
    activities: `https://www.getyourguide.com/s/?q=${q}&partner_id=YOUR_PARTNER_ID`,
    cars:       `https://www.rentalcars.com/SearchResults.do?affiliateCode=YOUR_AFF_ID&destination=${q}`,
    insurance:  `https://www.worldnomads.com/?aff=YOUR_AFF_ID`,
    reviews:    `https://www.tripadvisor.com/Search?q=${q}`
  };
}

function teaserHTML(input) {
  const { destination, start, end, level = 'budget', travelers = 2 } = input || {};
  return `
  <div class="teaser">
    <h3>${destination || 'Your destination'} — ${level} style</h3>
    <p><b>${travelers}</b> traveler(s) · ${start || 'start'} → ${end || 'end'}</p>
    <ul>
      <li>Top sights, food & neighborhoods personalized to your inputs.</li>
      <li>Morning / Afternoon / Evening blocks to fit your pace.</li>
      <li>Click <b>Generate full plan (AI)</b> for a complete day-by-day schedule & cost table.</li>
    </ul>
  </div>`;
}

function planMarkdown(input) {
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
- Morning: headline highlight. Afternoon: neighborhood walk/major site. Evening: local dining.
- Booking shortcuts adapt to **${destination}**.

## Day by Day (sample)
### Day 1
- **Morning**: Historic center & a key museum  
- **Afternoon**: Market + street food  
- **Evening**: Neighborhood bistro

### Day 2
- **Morning**: Big-ticket sight  
- **Afternoon**: Park/river loop  
- **Evening**: Food hall + dessert

*(Generate more days similarly…)*

---

## Cost Overview (rough)
- **Accommodation**: varies by style
- **Food**: $20–$40 pp/day
- **Activities**: museums $10–$25
- **Transport**: day passes are best value

Happy travels!`;
}

// ---------- API ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

app.get('/__debug', (_req, res) => {
  res.json({
    now: nowIso(),
    node: process.version,
    paths: { repoRoot, frontendDir, indexFile, docsDir, dbPath }
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

app.post('/api/plan', (req, res) => {
  const payload = req.body || {};
  const id = uid();
  const md = planMarkdown(payload);
  const aff = affiliatesFor(payload.destination);
  savePlan.run(id, nowIso(), JSON.stringify({ id, type:'plan', data:payload, markdown:md, affiliates:aff }));
  res.json({ id, markdown: md, affiliates: aff });
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
    </style>
  </head>
  <body>
    <div class="content">${marked.parse(markdown || '# Plan')}</div>
    <div class="footer">Generated by Wayzo — wayzo.online</div>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ---------- Static files ----------
// Serve /docs (images, etc.)
app.use('/docs', express.static(docsDir, {
  setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=604800')
}));

// Serve frontend two ways so both "/style.css" and "/assets/style.css" work
app.use(express.static(frontendDir, {
  setHeaders: (res, filePath) => {
    if (/\.(css)$/i.test(filePath)) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    if (/\.(js)$/i.test(filePath))  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (/\.(css|js|svg|png|jpg|jpeg|webp|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));
app.use('/assets', express.static(frontendDir)); // optional alias

// Root → index file
app.get('/', (_req, res) => {
  if (!fs.existsSync(indexFile)) {
    return res.status(500).send('index file not found in frontend directory');
  }
  res.sendFile(indexFile);
});

// SPA fallback for non-API routes
app.get(/^\/(?!api\/).*/, (_req, res) => {
  if (!fs.existsSync(indexFile)) {
    return res.status(500).send('index file not found in frontend directory');
  }
  res.sendFile(indexFile);
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log(`Serving frontend from: ${frontendDir}`);
});
