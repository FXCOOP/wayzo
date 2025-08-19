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
      if (/\.js$/i.test(filePath)) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
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
const getPlan = db.prepare('SELECT payload FROM plans WHERE id = ?');

const nowIso = () => new Date().toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

// ---------- Helpers ----------
function affiliatesFor(dest = '') {
  const q = encodeURIComponent(dest || '');
  return {
    flights: `https://www.kayak.com/flights?search=${q}`,
    hotels: `https://www.booking.com/searchresults.html?ss=${q}`,
    activities: `https://www.getyourguide.com/s/?q=${q}`,
    cars: `https://www.rentalcars.com/SearchResults.do?destination=${q}`,
    insurance: `https://www.worldnomads.com/`,
    reviews: `https://www.tripadvisor.com/Search?q=${q}`,
  };
}

function localPlanMarkdown(input) {
  const {
    destination = 'Your destination',
    start = 'start',
    end = 'end',
    budget = 1500,
    travelers = 2,
    level = 'budget',
    prefs = '',
  } = input || {};
  return `# ${destination} itinerary (${start} → ${end})

**Party:** ${travelers} • **Style:** ${level} • **Budget:** $${budget}
**Prefs:** ${prefs || '—'}

## Day 1
- Arrive and check-in
- Walk the historic center
- Dinner: local classic

## Day 2
- Morning museum
- Afternoon river walk
- Evening food hall

## Day 3
- Day trip to nearby highlight
- Market lunch
- Final sunset viewpoint
`;
}

// ---- Optional OpenAI ----
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function generateWithOpenAI(payload) {
  const sys = `You produce concise, realistic travel itineraries with logistics and dining. Output strictly in Markdown (no HTML). Use short bullet points.`;
  const user = `Destination: ${payload.destination}
Dates: ${payload.start} → ${payload.end}
Travelers: ${payload.travelers}
Style: ${payload.level}
Budget(USD): ${payload.budget}
Prefs: ${payload.prefs || '-'}

Return an elegant Markdown itinerary.`;

  const resp = await openai.chat.completions.create({
    model: process.env.WAYZO_MODEL || 'gpt-4o-mini',
    temperature: 0.6,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
  });
  return resp.choices?.[0]?.message?.content?.trim() || '';
}

// ---------- Enrichment (Markdown -> nice HTML with links) ----------
function linkifyLabel(label, destination) {
  const q = encodeURIComponent(`${label} ${destination || ''}`.trim());
  const map = `https://www.google.com/maps/search/?api=1&query=${q}`;
  const book = `https://www.getyourguide.com/s/?q=${q}`;
  return { map, book };
}

function renderPlanHTML(markdown, destination) {
  // Basic markdown -> HTML
  const raw = marked.parse(markdown || '');

  // Post-process list items to add map/booking links + a hint sentence
  // Replace each <li>...</li> with a decorated version.
  const html = raw.replace(/<li>([\s\S]*?)<\/li>/g, (_m, inner) => {
    const text = inner.replace(/<[^>]+>/g, '').trim();
    if (!text) return `<li>${inner}</li>`;
    const { map, book } = linkifyLabel(text, destination);
    const hint =
      ` <span class="li-meta"> — <a href="${map}" target="_blank" rel="noopener">Map</a> · <a href="${book}" target="_blank" rel="noopener">Book activity</a><span class="li-hint"> (tap to navigate or reserve)</span></span>`;
    return `<li>${inner}${hint}</li>`;
  });

  // Wrap in a nice report container with CSS class hooks
  return `
  <article class="report">
    ${html}
  </article>
  `.trim();
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
    <li>Use <b>Generate full plan (AI)</b> for the full schedule</li>
  </ul>
</div>`.trim();

  const aff = affiliatesFor(destination);
  savePlan.run(
    id,
    nowIso(),
    JSON.stringify({ id, type: 'preview', data: payload, teaser_html: teaser, affiliates: aff })
  );
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
    const html = renderPlanHTML(markdown, payload.destination);
    const aff = affiliatesFor(payload.destination);

    savePlan.run(
      id,
      nowIso(),
      JSON.stringify({ id, type: 'plan', data: payload, markdown, html, affiliates: aff })
    );

    // keep backwards compat (frontend will prefer 'html' if present)
    res.json({ id, markdown, html, affiliates: aff });
  } catch (e) {
    console.error('AI error → fallback:', e);
    const markdown = localPlanMarkdown(payload);
    const html = renderPlanHTML(markdown, payload.destination);
    const aff = affiliatesFor(payload.destination);

    savePlan.run(
      id,
      nowIso(),
      JSON.stringify({ id, type: 'plan', data: payload, markdown, html, affiliates: aff })
    );
    res.json({ id, markdown, html, affiliates: aff });
  }
});

// Pretty PDF view (prints beautifully in browser or Render HTML → PDF)
app.get('/api/plan/:id/pdf', (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const saved = JSON.parse(row.payload || '{}');
  const html = saved.html || renderPlanHTML(saved.markdown || '', saved?.data?.destination || '');

  const page = `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>Wayzo — Trip Plan</title>
    <style>
      /* Print-friendly theme */
      @media print { a { color: inherit; text-decoration: none } }
      body{font:15px/1.55 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;margin:28px;color:#0f172a}
      h1,h2,h3{margin:.8rem 0 .4rem}
      .muted{color:#64748b}
      .report{max-width:900px;margin:0 auto}
      .report h1{font-size:28px;margin-top:0}
      .report h2{font-size:20px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-top:18px}
      .report ul{margin:.3rem 0 .7rem 1.15rem}
      .report li{margin:.18rem 0}
      .li-meta{font-size:.9em;color:#475569}
      .li-hint{color:#94a3b8}
      .cover{display:flex;gap:16px;align-items:center;margin-bottom:12px}
      .badge{display:inline-block;background:#eef2ff;color:#3730a3;border-radius:999px;padding:2px 8px;font-size:12px;margin-left:6px}
    </style>
  </head>
  <body>
    <div class="cover">
      <h1>Trip Itinerary <span class="badge">Wayzo</span></h1>
    </div>
    ${html}
    <p class="muted">Generated by Wayzo · ${new Date().toLocaleString()}</p>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(page);
});

// Catch-all for SPA
app.get(/^\/(?!api\/).*/, (_req, res) => {
  if (!fs.existsSync(INDEX_FILE)) return res.status(500).send('index file missing');
  res.sendFile(INDEX_FILE);
});

// Start
app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log('Serving frontend from:', FRONTEND_DIR);
  console.log('Serving docs from:', DOCS_DIR);
  console.log('Index file:', INDEX_FILE);
});
