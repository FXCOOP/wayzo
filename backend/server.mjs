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
import multer from 'multer';

const WAYZO_VERSION = 'staging-v11';

// ---------- Paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const REPO_ROOT  = path.resolve(__dirname, '..');

const FRONTEND_DIR = path.join(REPO_ROOT, 'frontend');
const DOCS_DIR     = path.join(REPO_ROOT, 'docs');
const UPLOAD_DIR   = path.join(REPO_ROOT, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

let INDEX_FILE = path.join(FRONTEND_DIR, 'index.backend.html');
if (!fs.existsSync(INDEX_FILE)) {
  const alt = path.join(FRONTEND_DIR, 'index.html');
  if (fs.existsSync(alt)) INDEX_FILE = alt;
}

// ---------- App ----------
const app = express();
const PORT = Number(process.env.PORT || 10000);

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));
app.use(compression());
app.use(morgan('tiny'));
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use(rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true },
}));

// ---------- Static ----------
const staticHeaders = {
  setHeaders: (res, filePath) => {
    if (/\.css$/i.test(filePath)) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    if (/\.js$/i.test(filePath))  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (/\.(css|js|svg|png|jpg|jpeg|webp|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
};

app.use('/docs',    express.static(DOCS_DIR, staticHeaders));
app.use('/uploads', express.static(UPLOAD_DIR, { setHeaders: (res)=>res.setHeader('Cache-Control','public, max-age=1209600') }));
app.use('/frontend', express.static(FRONTEND_DIR, staticHeaders));
app.use(express.static(FRONTEND_DIR, staticHeaders));

// ---------- Root / Health / Version ----------
app.get('/', (_req, res) => {
  res.setHeader('X-Wayzo-Version', WAYZO_VERSION);
  if (!fs.existsSync(INDEX_FILE)) return res.status(500).send('index file missing');
  res.sendFile(INDEX_FILE);
});
app.get('/api/health', (_req, res) => res.json({ ok: true, version: WAYZO_VERSION }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/api/version', (_req, res) => res.json({ version: WAYZO_VERSION }));

// ---------- Uploads ----------
const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 8 * 1024 * 1024, files: 8 }, // 8MB, 8 files
});
app.post('/api/upload', upload.array('files', 8), (req, res) => {
  const files = (req.files || []).map(f => ({
    name: f.originalname,
    size: f.size,
    url: `/uploads/${path.basename(f.path)}`,
    mime: f.mimetype,
  }));
  res.json({ files });
});

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
const AFF = {
  bookingAid: process.env.BOOKING_AID || process.env.AFF_BOOKING_AID || "",
  gygPid:     process.env.GYG_PID     || process.env.AFF_GYG_PARTNER || "",
  kayakAid:   process.env.KAYAK_AID   || process.env.AFF_KAYAK_AFF   || "",
};

function affiliatesFor(dest = '') {
  const q = encodeURIComponent(dest || '');
  const bookingAidParam = AFF.bookingAid ? `&aid=${AFF.bookingAid}` : '';
  const gygPidParam     = AFF.gygPid     ? `&partner_id=${AFF.gygPid}` : '';
  return {
    maps:      (term)=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(term || dest)}`,
    flights:   ()=>`https://www.kayak.com/flights?search=${q}${AFF.kayakAid ? `&aid=${AFF.kayakAid}` : ''}`,
    hotels:    (term)=>`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(term || dest)}${bookingAidParam}`,
    activities:(term)=>`https://www.getyourguide.com/s/?q=${encodeURIComponent(term || dest)}${gygPidParam}`,
    cars:      ()=>`https://www.rentalcars.com/SearchResults.do?destination=${q}`,
    insurance: ()=>`https://www.worldnomads.com/`,
    reviews:   (term)=>`https://www.tripadvisor.com/Search?q=${encodeURIComponent(term || dest)}`,
    image:     (term)=>`https://source.unsplash.com/featured/?${encodeURIComponent(term || dest)}`,
  };
}

// ---------- Token linkifier (map:/book:/tickets:/reviews:/image:/cal:) ----------
function linkifyTokens(markdown, dest = '') {
  if (!markdown) return markdown;
  const aff = affiliatesFor(dest);

  // [Text](map:QUERY) and friends
  markdown = markdown.replace(/\]\((map|book|tickets|reviews|cal):\s*([^)]+)\)/gi,
    (_m, type, term) => {
      const t = String(term || '').trim();
      switch (type.toLowerCase()) {
        case 'map':     return `](${aff.maps(t)})`;
        case 'book':    return `](${aff.hotels(t)})`;
        case 'tickets': return `](${aff.activities(t)})`;
        case 'reviews': return `](${aff.reviews(t)})`;
        case 'cal':     return `](https://calendar.google.com/)`;
        default:        return `](#)`;
      }
    });

  // ![Alt](image:QUERY)
  markdown = markdown.replace(/\!\[([^\]]*?)\]\(\s*image:\s*([^)]+)\)/gi,
    (_m, alt, term) => `![${alt}](${aff.image(String(term || '').trim())})`);

  // bare (map:query) → linkify
  markdown = markdown.replace(/\(map:([^)]+)\)/gi,
    (_m, t) => `(${aff.maps(String(t || '').trim())})`);

  return markdown;
}

// ---------- Helpers ----------
const daysBetween = (start, end) => {
  const s = new Date(start), e = new Date(end);
  if (isNaN(s) || isNaN(e)) return 3;
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
};

function computeBudget(total = 0, days = 1, style = 'mid', travelers = 2) {
  const t = Math.max(1, Number(total) || 0);
  const d = Math.max(1, Number(days) || 1);
  const perDay = t / d;

  // rough split by style
  const split =
    style === 'luxury' ? { stay: 0.55, food: 0.22, act: 0.18, transit: 0.05 } :
    style === 'budget' ? { stay: 0.38, food: 0.27, act: 0.20, transit: 0.15 } :
                         { stay: 0.47, food: 0.25, act: 0.18, transit: 0.10 };

  const round = (x) => Math.round(x);
  return {
    stay:     { perDay: round(perDay * split.stay),     total: round(t * split.stay),     notes: 'by style' },
    food:     { perDay: round(perDay * split.food / travelers), total: round(t * split.food), notes: 'per person/day' },
    act:      { perDay: round(perDay * split.act),      total: round(t * split.act),      notes: 'key paid items' },
    transit:  { perDay: round(perDay * split.transit),  total: round(t * split.transit),  notes: 'passes/transfers' },
  };
}

function ensureDaySections(md, nDays, start) {
  // If AI returned too few days, append stubs so PDF has full range.
  const count = (md.match(/^\s*###\s*Day\s+\d+/gmi) || []).length;
  if (count >= nDays) return md;

  const parts = [];
  for (let i = count + 1; i <= nDays; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + (i - 1));
    const label = date.toISOString().slice(0,10);
    parts.push(`
### Day ${i} — Open Exploration (${label})
- Morning: Choose a neighborhood stroll. [Map](map:${label} walking tour)
- Afternoon: Local museum or market. [Map](map:${label} market) | [Tickets](tickets:${label} museum)
- Evening: Signature view or waterfront. [Map](map:${label} viewpoint)
- Meals: Choose from the Dining list. [Reviews](reviews:${label} best restaurants)
- Transit today: mix of walking + short metro/taxi.
`.trim());
  }
  return md.trim() + '\n\n' + parts.join('\n\n');
}

// ---------- Local fallback ----------
function localPlanMarkdown(input) {
  const {
    destination='Your destination',
    start='start', end='end',
    budget=1500, travelers=2,
    adults=2, children=0, childAges=[],
    level='mid', prefs='', diet='', currency='USD $'
  } = input || {};

  const nDays = daysBetween(start, end);
  const b     = computeBudget(budget, nDays, level, Math.max(1, adults + children));

  return linkifyTokens(`
# ${destination} itinerary (${start} – ${end})

![City hero](image:${destination} skyline)

**Travelers:** ${adults} adults${children ? ` + ${children} kids (${childAges.join(', ')})` : ''} • **Style:** ${level} • **Budget:** ${budget} ${currency}

${prefs ? `**Preferences:** ${prefs}\n` : ''}${diet ? `**Dietary needs:** ${diet}\n` : ''}

Actions: Download PDF | Edit Inputs

## Quick Facts
- Language: local + English availability.
- Currency: ${currency.replace('$','USD')}.
- Power: bring adapter if needed.
- Tipping: common ranges by venue.

**[View Full Trip Map](map:${destination} center)**

## Trip Summary
- Cluster by neighborhoods to reduce transit time.
- Mix icons + hidden gems with timed entries where needed.
- Don’t Miss: signature viewpoint at sunset.

## Where to Stay
- **Budget:** Friendly Inn — great value near transit. [Book](book:Friendly Inn ${destination}) | [Map](map:Friendly Inn ${destination}) | [Reviews](reviews:Friendly Inn ${destination})
- **Mid:** Midtown Boutique — walkable & quiet. [Book](book:Midtown Boutique ${destination}) | [Map](map:Midtown Boutique ${destination}) | [Reviews](reviews:Midtown Boutique ${destination})
- **High:** Grand Palace — views + pool. [Book](book:Grand Palace ${destination}) | [Map](map:Grand Palace ${destination}) | [Reviews](reviews:Grand Palace ${destination})

## Highlights
- Main Museum — prebook to skip lines. [Map](map:${destination} Main Museum) | [Tickets](tickets:${destination} Main Museum) | [Reviews](reviews:${destination} Main Museum)
- Old Town — cafés & architecture. [Map](map:${destination} Old Town) | [Reviews](reviews:${destination} Old Town)
- River Cruise — best at dusk. [Map](map:${destination} River Cruise) | [Tickets](tickets:${destination} River Cruise)

## Day-by-Day Plan
### Day 1 — Historic Core
- Morning: Main Museum (kid-friendly exhibits). [Map](map:${destination} Main Museum) | [Tickets](tickets:${destination} Main Museum)
- Afternoon: Cathedral & square — short loop. [Map](map:${destination} Cathedral)
- Evening: River Cruise — city lights. [Map](map:${destination} River Cruise) | [Tickets](tickets:${destination} River Cruise)
- Meals: Breakfast “Café One”; Lunch “Bistro Two”; Dinner “Brasserie Three”. [Reviews](reviews:${destination} restaurants) | [Map](map:${destination} food)
- Transit: ~25m walk + ~15m metro/taxi.

### Day 2 — Parks & Views
- Morning: City Park playgrounds (kids). [Map](map:${destination} City Park)
- Afternoon: Viewpoint/ropeway. [Map](map:${destination} Viewpoint)
- Evening: Night market. [Map](map:${destination} Night market) | [Reviews](reviews:${destination} night market)

## Getting Around
- Airport → center options with times & costs.
- Day passes save money for 3+ rides/day.
- Taxi/rideshare for late nights.

## Budget Summary (rough)
| Category | Per Day | Total | Notes |
|---|---:|---:|---|
| Stay | ${b.stay.perDay} | ${b.stay.total} | ${b.stay.notes} |
| Food | ${b.food.perDay} | ${b.food.total} | ${b.food.notes} |
| Activities | ${b.act.perDay} | ${b.act.total} | ${b.act.notes} |
| Transit | ${b.transit.perDay} | ${b.transit.total} | ${b.transit.notes} |

## Dining Short-List
- Café One — iconic breakfast. [Reviews](reviews:${destination} breakfast) | [Map](map:${destination} breakfast)
- Le Soufflé — classic mains + dessert. [Reviews](reviews:${destination} dinner) | [Map](map:${destination} dinner)

## Bookings Checklist
- Main Museum 09:00 — timed entry. [Tickets](tickets:${destination} Main Museum) | [Add to Calendar](cal:${destination} Main Museum 09:00)
- River Cruise 19:00 — sunset slot. [Tickets](tickets:${destination} River Cruise) | [Add to Calendar](cal:${destination} River Cruise 19:00)

## Footer
Generated by Wayzo.
`, destination);
}

// ---------- OpenAI ----------
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function withTimeout(promise, ms = 25000) {
  const timer = new Promise((_r, rej) => setTimeout(()=>rej(new Error('timeout')), ms));
  return Promise.race([promise, timer]);
}

async function generateWithOpenAI(payload) {
  const {
    destination, start, end, budget, currency='USD $',
    travelers=2, adults=2, children=0, childAges=[],
    level='mid', prefs='', diet='', special='', attachments=[]
  } = payload || {};

  const nDays = daysBetween(start, end);

  const sys =
`You are Wayzo, a professional travel planner. Return only Markdown.
Respect this exact section order:
Title line; "Travelers | Style | Budget"; "Actions"; "Quick Facts"; "Trip Summary";
"Where to Stay"; "Highlights"; "Day-by-Day Plan"; "Getting Around"; "Budget Summary (rough)";
"Dining Short-List"; "Bookings Checklist"; "Footer".

Rules:
- Use token links only: [Map](map:PLACE) [Book](book:PLACE) [Tickets](tickets:PLACE) [Reviews](reviews:PLACE) [Add to Calendar](cal:TEXT).
- Optionally include 1–3 hero images using: ![Alt](image: QUERY).
- Fill **every day** from start to end (${nDays} days). Use Morning/Afternoon/Evening + Meals + Transit.
- Use the provided currency label (${currency}) consistently in budget numbers outside the table.
- Be concise but specific, family-aware if kids present.
- No raw URLs.`;

  const user =
`Destination: ${destination}
Dates: ${start} → ${end}  (days: ${nDays})
Travelers: ${adults} adults${children ? ` + ${children} kids (${childAges.join(', ')})` : ''}
Style: ${level}
Budget: ${budget} ${currency}
Preferences: ${prefs || '-'}
Dietary: ${diet || '-'}
Special requests: ${special || '-'}
Attached docs: ${attachments.map(a=>a.name || a.url).join(', ') || '-'}

Return polished Markdown only.`;

  if (!openaiEnabled) return localPlanMarkdown(payload);

  const resp = await withTimeout(
    openai.chat.completions.create({
      model: process.env.WAYZO_MODEL || 'gpt-4o-mini',
      temperature: 0.5,
      max_tokens: Number(process.env.WAYZO_MAX_TOKENS || 2200),
      messages: [
        { role: 'system', content: sys },
        { role: 'user',   content: user },
      ],
    })
  );

  let md = resp.choices?.[0]?.message?.content?.trim() || '';
  if (!md) md = localPlanMarkdown(payload);
  // Ensure we have full range & links & images resolved
  md = linkifyTokens(md, destination);
  md = ensureDaySections(md, nDays, start);
  return md;
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
  res.json({ id, teaser_html: teaser, affiliates: aff, version: WAYZO_VERSION });
});

app.post('/api/plan', async (req, res) => {
  const payload = req.body || {};
  const id = uid();

  try {
    let markdown = await generateWithOpenAI(payload);
    const html = marked.parse(markdown);
    const aff  = affiliatesFor(payload.destination);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown }));
    res.json({ id, markdown, html, affiliates: aff, version: WAYZO_VERSION });
  } catch (e) {
    console.error('AI error → fallback:', e.message || e);
    try {
      const markdown = localPlanMarkdown(payload);
      const html = marked.parse(markdown);
      const aff  = affiliatesFor(payload.destination);
      savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown }));
      res.json({ id, markdown, html, affiliates: aff, version: WAYZO_VERSION });
    } catch (err) {
      res.status(200).json({ id, markdown: '# Plan unavailable right now.\nPlease try again in a minute.', html: '<p>Plan unavailable right now.</p>', version: WAYZO_VERSION });
    }
  }
});

// ---------- PDF (HTML render) ----------
app.get('/api/plan/:id/pdf', (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const saved = JSON.parse(row.payload || '{}');

  const html = `
<!doctype html><html><head><meta charset="utf-8"/>
<title>Wayzo Trip Report</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root{
    --ink:#0f172a; --muted:#475569; --brand:#6366f1; --bg:#ffffff;
    --accent:#eef2ff; --border:#e2e8f0;
  }
  *{box-sizing:border-box}
  body{font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,Arial;color:var(--ink);margin:28px;background:var(--bg)}
  header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid var(--border)}
  .logo{display:flex;gap:10px;align-items:center}
  .badge{width:28px;height:28px;border-radius:8px;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:700}
  .tagline{color:var(--muted);font-size:14px}
  .pill{background:var(--accent);color:#3730a3;border-radius:999px;padding:3px 8px;font-size:12px}
  img{max-width:100%;height:auto;border-radius:10px}
  table{border-collapse:collapse;width:100%;margin:.75rem 0}
  th,td{border:1px solid var(--border);padding:.5rem .6rem;text-align:left}
  thead th{background:#f8fafc}
  footer{margin-top:24px;color:var(--muted);font-size:13px;border-top:1px solid var(--border);padding-top:10px}
  @media print { a { color: inherit; text-decoration: none; } }
</style>
</head>
<body>
  <header>
    <div class="logo"><div class="badge">WZ</div><div><b>Wayzo</b><div class="tagline">Trips that plan themselves.</div></div></div>
    <span class="pill">${WAYZO_VERSION}</span>
  </header>
  ${marked.parse(saved.markdown || '')}
  <footer>Generated by Wayzo — ${WAYZO_VERSION}</footer>
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ---------- SPA catch-all ----------
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.setHeader('X-Wayzo-Version', WAYZO_VERSION);
  if (!fs.existsSync(INDEX_FILE)) return res.status(500).send('index file missing');
  res.sendFile(INDEX_FILE);
});

app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log('Version:', WAYZO_VERSION);
  console.log('Serving frontend from:', FRONTEND_DIR);
  console.log('Uploads at:', UPLOAD_DIR);
  console.log('Index file:', INDEX_FILE);
});
