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
    contentSecurityPolicy: false,            // allow external images (Unsplash)
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

// Root
app.get('/', (_req, res) => {
  if (!fs.existsSync(INDEX_FILE)) return res.status(500).send('index file missing');
  res.sendFile(INDEX_FILE);
});

// ---------- Health / Version ----------
const WAYZO_VERSION = process.env.WAYZO_VERSION || 'staging-v8';
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/api/version', (_req, res) => res.json({ version: WAYZO_VERSION }));

// ---------- DB ----------
const dbPath = path.join(REPO_ROOT, 'tripmaster.sqlite');
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
function linkToken(kind, name, city) {
  const q = encodeURIComponent(`${name || ''} ${city || ''}`.trim());
  switch (kind) {
    case 'Map':     return `https://www.google.com/maps/search/?api=1&query=${q}`;
    case 'Tickets': return `https://www.getyourguide.com/s/?q=${q}`;
    case 'Book':    return `https://www.booking.com/searchresults.html?ss=${q}`;
    case 'Reviews': return `https://www.tripadvisor.com/Search?q=${q}`;
    default:        return '#';
  }
}
function tokenLinkify(markdown, city) {
  const lines = (markdown || '').split('\n');
  const out = lines.map((line) => {
    let name = city || '';
    const m1 = line.match(/\*\*([^*]+)\*\*/);
    if (m1) name = m1[1];
    else {
      const m2 = line.match(/^-+\s*([^—:\[\(]+)(?:[—:\(]|$)/);
      if (m2 && m2[1]) name = m2[1].trim();
    }
    return line
      .replace(/\[Map\](?!\()/g,     `[Map](${linkToken('Map', name, city)})`)
      .replace(/\[Tickets\](?!\()/g, `[Tickets](${linkToken('Tickets', name, city)})`)
      .replace(/\[Book\](?!\()/g,    `[Book](${linkToken('Book', name, city)})`)
      .replace(/\[Reviews\](?!\()/g, `[Reviews](${linkToken('Reviews', name, city)})`);
  });
  return out.join('\n');
}
function imageStripMarkdown(dest = '') {
  const q = encodeURIComponent(dest || 'travel');
  // three images, safe aspect
  return [
    `![${dest} highlight](https://source.unsplash.com/1200x600/?${q})`,
    `![${dest} city](https://source.unsplash.com/1200x600/?${q}+city)`,
    `![${dest} food](https://source.unsplash.com/1200x600/?${q}+food)`
  ].join('\n');
}

// ---------- Local fallback ----------
function localPlanMarkdown(input) {
  const {
    destination = 'Your destination',
    start = 'start', end = 'end',
    budget = 1500, travelers = 2,
    level = 'budget', prefs = '', long_input = '',
  } = input || {};
  return `# ${destination} itinerary (${start} → ${end})

**Travelers:** ${travelers} • **Style:** ${level} • **Budget:** $${budget}
**Preferences:** ${prefs || '—'}${long_input ? `\n**Brief:** ${long_input}` : ''}

---

## Trip Summary
Balanced mix of must-sees and local gems in ${destination}. Cluster by neighborhood to reduce transit.

## Day 1
- Morning: Historic center
- Afternoon: Market & park
- Evening: Classic local dinner

## Budget Summary
- Stay • Food • Activities • Transit
`;
}

// ---------- OpenAI ----------
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function generateWithOpenAI(payload) {
  const { destination = '', start, end, travelers, level, budget, prefs = '', long_input = '' } = payload || {};

  const sys = [
    'You are a senior travel planner. Write premium, *practical* itineraries.',
    'Output MUST be GitHub-flavored Markdown, no HTML, and NEVER paste raw URLs.',
    'After each place, append tokens exactly like [Map] [Tickets] [Book] [Reviews] (only those that fit).',
    'Use *real* names of sights, museums, neighborhoods, hotels, and restaurants in the destination—',
    'avoid placeholders like "Main Museum" or "Sample Hotel".',
    'Prefer family options if children are mentioned; include short safety/queue tips.',
    'Structure:',
    'Actions | Quick Facts | Trip Summary | Where to Stay (Budget/Mid/High, 1–2 real options each + one-line why)',
    'Highlights (6–10 real POIs with one-line context + tokens)',
    'Day-by-Day (for the actual dates): each day has Morning/Afternoon/Evening, include compact transit hints [Walk 10m] [Metro 12m], and list 2–3 meal suggestions with cuisine + vibe + tokens)',
    'Getting Around (airport → city options and local passes)',
    'Budget Summary (simple table with numeric rough ranges, exclude flights)',
    'Dining Short-List (6–10 places, cuisine & vibe + tokens)',
    'Bookings Checklist (timed entries with suggested lead time + tokens).',
    'Tone: succinct but specific; no fluff.'
  ].join(' ');

  const user = [
    `Destination: ${destination}`,
    `Dates: ${start || ''} → ${end || ''}`,
    `Travelers: ${travelers || ''}`,
    `Style: ${level || ''}`,
    `Budget(USD): ${budget || ''}`,
    `Preferences: ${prefs || '-'}`,
    long_input ? `Professional brief: ${long_input}` : '',
    'Remember: real places only; tokens instead of URLs; numeric price hints when helpful.',
  ].filter(Boolean).join('\n');

  const resp = await openai.chat.completions.create({
    model: process.env.WAYZO_MODEL || 'gpt-4o-mini',
    temperature: 0.5,
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
    <li>Use <b>Generate full plan (AI)</b> for your detailed plan</li>
  </ul>
</div>`.trim();

  const aff = affiliatesFor(destination);
  savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'preview', data: payload, teaser_html: teaser, affiliates: aff }));
  res.json({ id, teaser_html: teaser, affiliates: aff });
});

app.post('/api/plan', async (req, res) => {
  const payload = req.body || {};
  const id = uid();
  const city = payload.destination || '';

  try {
    let markdown = localPlanMarkdown(payload);
    if (openaiEnabled) {
      const out = await generateWithOpenAI(payload);
      if (out) markdown = out;
    }

    // Convert tokens → affiliate links
    markdown = tokenLinkify(markdown, city);

    // ALWAYS prepend a small image strip so web+PDF have visuals
    markdown = `${imageStripMarkdown(city)}\n\n${markdown}`;

    const aff = affiliatesFor(city);
    const html = marked.parse(markdown);

    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown, html, affiliates: aff }));
    res.json({ id, markdown, html, affiliates: aff });
  } catch (e) {
    console.error('AI error → fallback to local:', e);
    const markdown = localPlanMarkdown(payload);
    const html = marked.parse(markdown);
    const aff = affiliatesFor(payload.destination);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown, html, affiliates: aff }));
    res.json({ id, markdown, html, affiliates: aff });
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
    h1,h2,h3{margin:.8rem 0 .4rem} h1{font-size:28px}
    ul{margin:.3rem 0 .6rem 1.2rem}
    img{max-width:100%;border-radius:10px;margin:.5rem 0}
    table{border-collapse:collapse;width:100%;margin:.6rem 0}
    th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left}
    .muted{color:#64748b}
    .aff{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}
    .aff a{padding:6px 10px;border:1px solid #e5e7eb;border-radius:10px;text-decoration:none;color:#111827}
    .hr{height:1px;background:#e5e7eb;margin:16px 0}
    @media print { a { color: inherit; text-decoration: none; } }
  </style></head>
  <body>
    ${saved.html || marked.parse(saved.markdown || '')}
    <div class="hr"></div>
    <div class="aff">
      <a href="${saved.affiliates?.maps || '#'}">🗺️ Maps</a>
      <a href="${saved.affiliates?.flights || '#'}">✈️ Flights</a>
      <a href="${saved.affiliates?.hotels || '#'}">🏨 Hotels</a>
      <a href="${saved.affiliates?.activities || '#'}">🎟️ Activities</a>
    </div>
    <p class="muted">Generated by Wayzo · ${WAYZO_VERSION}</p>
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
