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

// ---------- paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const DOCS_DIR = path.join(ROOT, 'docs');

let INDEX_FILE = path.join(FRONTEND_DIR, 'index.backend.html');
if (!fs.existsSync(INDEX_FILE)) {
  const alt = path.join(FRONTEND_DIR, 'index.html');
  if (fs.existsSync(alt)) INDEX_FILE = alt;
}

// ---------- app ----------
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

// static
app.use('/docs', express.static(DOCS_DIR));
app.use(express.static(FRONTEND_DIR));

// health
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// ---------- db ----------
const db = new Database(path.join(ROOT, 'wayzo.sqlite'));
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

// ---------- openai (optional) ----------
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const MODEL = process.env.WAYZO_MODEL || 'gpt-4o-mini';

// ---------- preview ----------
app.post('/api/preview', async (req, res) => {
  const { destination = '', start = '', end = '' } = req.body || {};
  const teaser_html = `
    <section id="preview">
      <h3>${destination || 'Your trip'} — preview</h3>
      <ul>
        <li>Morning / Afternoon / Evening blocks for each day.</li>
        <li>Neighborhood clustering to reduce transit.</li>
        <li>Ticket + timing tips for the top sights.</li>
      </ul>
      <p class="cta">Generate full plan →</p>
    </section>`.trim();
  res.json({ teaser_html });
});

// ---------- helpers ----------
function gm(place, city) {
  const q = encodeURIComponent(`${place} ${city}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function localPlanMarkdown(p) {
  const {
    destination = 'Your destination',
    start = 'start',
    end = 'end',
    budget = 1500,
    travelers = 2,
    level = 'budget',
    prefs = '',
  } = p || {};
  return `# ${destination} itinerary (${start} → ${end})

**Party:** ${travelers} • **Style:** ${level} • **Budget:** $${budget}

**Preferences:** ${prefs || '—'}

---

## Trip Summary
- Balanced mix of must-sees and local gems in ${destination}.
- Group sights by neighborhoods to minimize transit.

## Day 1
- **Morning:** Historic Center — [Open in Maps](${gm('Historic Center', destination)})
- **Afternoon:** Central Market — [Open in Maps](${gm('Central Market', destination)})
- **Evening:** Classic local dinner — [Open in Maps](${gm('Old Town', destination)})

## Day 2
- **Morning:** Headliner Museum — [Open in Maps](${gm('City Museum', destination)})
- **Afternoon:** River Walk — [Open in Maps](${gm('River Walk', destination)})
- **Evening:** Food Hall + Dessert — [Open in Maps](${gm('Food Hall', destination)})

---

## Rough Costs
- **Accommodation:** varies by style
- **Food:** $25–$45 pp/day
- **Activities:** $10–$25 / museum
- **Transit:** day passes best value
`;
}

// ---------- plan (markdown → also return html) ----------
app.post('/api/plan', async (req, res) => {
  const payload = req.body || {};
  const id = uid();

  try {
    let markdown = localPlanMarkdown(payload);

    if (openaiEnabled) {
      const sys = `You produce concise, realistic travel itineraries with concrete logistics and restaurant picks.
Return output strictly in Markdown (headings + bullet lists). 
For every named sight/restaurant/hotel, append a Google Maps link using:
[Open in Maps](https://www.google.com/maps/search/?api=1&query=<PLACE%20NAME%20CITY>)
Keep place names accurate; include neighborhood or city to disambiguate. Keep text tight.`;
      const usr = `Destination: ${payload.destination}
Dates: ${payload.start || payload.startDate} → ${payload.end || payload.endDate}
Travelers: ${payload.travelers}
Style: ${payload.level}
Budget(USD): ${payload.budget}
Prefs: ${payload.prefs || payload.interests || '-'}
Return Markdown only. Include [Open in Maps](...) links as described.`;
      const resp = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.6,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: usr },
        ],
      });
      const out = resp.choices?.[0]?.message?.content?.trim();
      if (out) markdown = out;
    }

    const html = marked.parse(markdown || '');
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown, html }));
    res.json({ id, markdown, html });
  } catch (e) {
    console.error('plan error', e);
    const markdown = localPlanMarkdown(payload);
    const html = marked.parse(markdown || '');
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown, html }));
    res.json({ id, markdown, html });
  }
});

// ---------- “PDF” html view ----------
app.get('/api/plan/:id/pdf', (req, res) => {
  const row = getPlan.get(req.params.id);
  if (!row) return res.status(404).send('Not found');

  const saved = JSON.parse(row.payload || '{}');
  const html = `
  <html><head><meta charset="utf-8"/>
  <title>Wayzo Plan</title>
  <style>
    body{font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:24px;color:#0f172a}
    h1,h2,h3{margin:.8rem 0 .4rem}
    ul{margin:.3rem 0 .6rem 1.2rem}
    .muted{color:#64748b}
    a{color:#2563eb;text-decoration:none}
  </style></head>
  <body>
    ${saved.html || marked.parse(saved.markdown || '')}
    <p class="muted">Generated by Wayzo</p>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ---------- catch-all ----------
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(INDEX_FILE);
});

app.listen(PORT, () => console.log(`Wayzo backend running on :${PORT}`));
