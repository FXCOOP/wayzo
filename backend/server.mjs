/* eslint-disable no-console */
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import Database from 'better-sqlite3';
import { marked } from 'marked';

// ──────────────────────────────────────────────────────────────
// Paths (Render Root Directory is `backend`; repo root is .. )
// ──────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const frontendDir = path.join(repoRoot, 'frontend');     // serve CSS/JS/HTML
const docsDir     = path.join(repoRoot, 'docs');         // serve images
let indexFile     = path.join(frontendDir, 'index.backend.html');
if (!fs.existsSync(indexFile)) {
  const alt = path.join(frontendDir, 'index.html');
  if (fs.existsSync(alt)) indexFile = alt;
}

console.log('Static root:', frontendDir);
console.log('Index file:', indexFile);

// ──────────────────────────────────────────────────────────────
// App
// ──────────────────────────────────────────────────────────────
const app = express();
const PORT = Number(process.env.PORT || 10000);

app.use(cors());
app.use(compression());
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));

// Health for Render
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// ──────────────────────────────────────────────────────────────
/** DB (store generated plans so /pdf works after refresh) */
// ──────────────────────────────────────────────────────────────
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

const nowIso = () => new Date().toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

// ──────────────────────────────────────────────────────────────
// Simple local plan generator (fallback when no OpenAI key)
// ──────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────
// API
// ──────────────────────────────────────────────────────────────
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
    // Fallback local markdown by default (keeps site working if API key is absent)
    const markdown = localPlanMarkdown(payload);
    const aff = affiliatesFor(payload.destination);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type:'plan', data:payload, markdown, affiliates:aff }));
    res.json({ id, markdown, affiliates: aff });
  } catch (err) {
    console.error('Plan generation error:', err);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
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
      body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.55; margin: 24px; color:#0f172a;}
      h1,h2,h3{margin:.6em 0}
      ul{margin:.4em 0 .6em 1.2em}
      .footer{margin-top:2rem; font-size:12px; color:#475569}
      .content img{max-width:100%; border-radius:8px}
    </style>
  </head>
  <body>
    <div class="content">${marked.parse(markdown || '# Plan')}</div>
    <div class="footer">Generated by Wayzo — wayzo.online</div>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ──────────────────────────────────────────────────────────────
// Static (IMPORTANT: no `/frontend/...` in links; use `/style.css`, `/app.js`)
// ──────────────────────────────────────────────────────────────
app.use('/docs', express.static(docsDir));      // images like /docs/hero-mountains.jpg
app.use(express.static(frontendDir));           // serves /style.css, /app.js, and index file

app.get('/', (_req, res) => fs.existsSync(indexFile)
  ? res.sendFile(indexFile)
  : res.status(500).send('index file missing'));

app.get(/^\/(?!api\/).*/, (_req, res) => fs.existsSync(indexFile)
  ? res.sendFile(indexFile)
  : res.status(500).send('index file missing'));

app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log(`Serving frontend from: ${frontendDir}`);
});
