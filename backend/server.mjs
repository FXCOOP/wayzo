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

// -------- Version --------
const WAYZO_VERSION = 'staging-v10';

// -------- Paths --------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const REPO_ROOT  = path.resolve(__dirname, '..');

const FRONTEND_DIR = path.join(REPO_ROOT, 'frontend');
const DOCS_DIR     = path.join(REPO_ROOT, 'docs');

let INDEX_FILE = path.join(FRONTEND_DIR, 'index.backend.html');
if (!fs.existsSync(INDEX_FILE)) {
  const alt = path.join(FRONTEND_DIR, 'index.html');
  if (fs.existsSync(alt)) INDEX_FILE = alt;
}

// -------- App --------
const app  = express();
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

// -------- Static --------
app.use(
  '/docs',
  express.static(DOCS_DIR, {
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=604800'),
  })
);
const staticHeaders = {
  setHeaders: (res, filePath) => {
    if (/\.css$/i.test(filePath)) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    if (/\.js$/i.test(filePath))  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (/\.(css|js|svg|png|jpg|jpeg|webp|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
};
app.use('/frontend', express.static(FRONTEND_DIR, staticHeaders));
app.use(express.static(FRONTEND_DIR, staticHeaders));

// Root -> index
app.get('/', (_req, res) => {
  res.setHeader('X-Wayzo-Version', WAYZO_VERSION);
  if (!fs.existsSync(INDEX_FILE)) return res.status(500).send('index file missing');
  res.sendFile(INDEX_FILE);
});

// -------- Health & Version --------
app.get('/api/health', (_req, res) => res.json({ ok: true, version: WAYZO_VERSION }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/api/version', (_req, res) => res.json({ version: WAYZO_VERSION }));

// -------- DB --------
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

// -------- Affiliates --------
const AFF = {
  bookingAid: process.env.BOOKING_AID || process.env.AFF_BOOKING_AID || '',
  gygPid:     process.env.GYG_PID     || process.env.AFF_GYG_PARTNER || '',
  kayakAid:   process.env.KAYAK_AID   || process.env.AFF_KAYAK_AFF   || '',
};

function affiliatesFor(dest = '') {
  const q = encodeURIComponent(dest || '');
  const bookingAidParam = AFF.bookingAid ? `&aid=${AFF.bookingAid}` : '';
  const gygPidParam     = AFF.gygPid     ? `&partner_id=${AFF.gygPid}` : '';
  return {
    maps:      (term) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(term || dest)}`,
    flights:   () => `https://www.kayak.com/flights?search=${q}${AFF.kayakAid ? `&aid=${AFF.kayakAid}` : ''}`,
    hotels:    (term) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(term || dest)}${bookingAidParam}`,
    activities:(term) => `https://www.getyourguide.com/s/?q=${encodeURIComponent(term || dest)}${gygPidParam}`,
    cars:      () => `https://www.rentalcars.com/SearchResults.do?destination=${q}`,
    insurance: () => `https://www.worldnomads.com/`,
    reviews:   (term) => `https://www.tripadvisor.com/Search?q=${encodeURIComponent(term || dest)}`,
    image:     (term) => `https://source.unsplash.com/featured/?${encodeURIComponent(term || dest)}`,
  };
}

// -------- Token Linkifier (map/book/tickets/reviews/cal/image) --------
function linkFor(kind, place, dest = '') {
  const aff = affiliatesFor(dest);
  switch (kind) {
    case 'map':     return aff.maps(place);
    case 'book':    return aff.hotels(place);
    case 'tickets': return aff.activities(place);
    case 'reviews': return aff.reviews(place);
    case 'cal':     return 'https://calendar.google.com/';
    case 'image':   return aff.image(place);
    default:        return '#';
  }
}
function linkifyTokens(md = '', dest = '') {
  if (!md) return md;
  // [Text](map: Eiffel Tower)
  md = md.replace(/\]\((map|book|tickets|reviews|cal):\s*([^)]+)\)/gi,
    (_m, kind, body) => `](${linkFor(kind.toLowerCase(), String(body).trim(), dest)})`);
  // ![Alt](image: Eiffel Tower sunset)
  md = md.replace(/\!\[([^\]]*?)\]\(\s*image:\s*([^)]+)\)/gi,
    (_m, alt, body) => `![${alt}](${linkFor('image', String(body).trim(), dest)})`);
  // bare (map:query) -> (url)
  md = md.replace(/\(map:([^)]+)\)/gi, (_m, body) => `(${linkFor('map', String(body).trim(), dest)})`);
  return md;
}

// -------- Local Fallback (kept rich & tokenized) --------
function localPlanMarkdown(input = {}) {
  const {
    destination='Your destination',
    start='start', end='end',
    currency='USD',
    budget=0,
    adults=2, children=0, childAges=[],
    level='mid',
    prefs='', special='', diet='', todo=''
  } = input;

  const travelerLine =
    `${adults} adult${adults===1?'':'s'}` +
    (children ? ` + ${children} kid${children===1?'':'s'}${childAges?.length?` (${childAges.join(', ')})`:''}` : '');

  return `![City hero](image:${destination} skyline)

# ${destination} Itinerary (${start} – ${end})

**Travelers:** ${travelerLine} | **Style:** ${level} | **Budget:** ${budget} ${currency}

${prefs ? `**Preferences:** ${prefs}\n` : ''}${diet ? `**Dietary Needs:** ${diet}\n` : ''}${special ? `**Special Requests:** ${special}\n` : ''}

Actions: Download PDF | Edit Inputs

## Quick Facts
- Language: local + English availability.
- Currency: ${currency}.
- Power: bring adapter if needed.
- Tipping: common ranges by venue.

**[View Full Trip Map](map:${destination} center)**

## Trip Summary
- Cluster by neighborhoods to reduce transit time.
- Mix icons with hidden gems and timed entries where needed.
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
- Meals: Breakfast “Café One”; Lunch “Bistro Two”; Dinner “Brasserie Three”. [Reviews](reviews:${destination} Café One) | [Map](map:${destination} Café One)
- Transit: ~25m walk + ~15m metro/taxi.

### Day 2 — Parks & Views
- Morning: City Park playgrounds (kids). [Map](map:${destination} main park)
- Afternoon: Viewpoint/ropeway. [Map](map:${destination} viewpoint)
- Evening: Night market. [Map](map:${destination} night market) | [Reviews](reviews:${destination} night market)

## Getting Around
- Airport → center options with times & costs.
- Day passes save money for 3+ rides/day.
- Taxi/rideshare for late nights.

## Budget Summary (rough)
| Category | Per Day | Total | Notes |
|---|---:|---:|---|
| Stay | … | … | by style |
| Food | … | … | per person/day |
| Activities | … | … | key paid items |
| Transit | … | … | passes/transfers |

## Dining Short-List
- Café One — iconic breakfast. [Reviews](reviews:${destination} Café One) | [Map](map:${destination} Café One)
- Le Soufflé — classic mains + dessert. [Reviews](reviews:${destination} Le Soufflé) | [Map](map:${destination} Le Soufflé)

## Bookings Checklist
- Main Museum 09:00 — timed entry. [Tickets](tickets:${destination} Main Museum) | [Add to Calendar](cal:${destination} Main Museum 09:00)
- River Cruise 19:00 — sunset slot. [Tickets](tickets:${destination} River Cruise) | [Add to Calendar](cal:${destination} River Cruise 19:00)

## Footer
Generated by Wayzo.`;
}

// -------- OpenAI --------
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const REQUIRED_SECTIONS = [
  '## Quick Facts','## Trip Summary','## Where to Stay','## Highlights',
  '## Day-by-Day Plan','## Getting Around','## Budget Summary','## Dining Short-List','## Bookings Checklist','## Footer'
];
const looksComplete = (md='') => REQUIRED_SECTIONS.every(h => md.includes(h));

async function generateWithOpenAI(payload) {
  const {
    destination='', start='', end='',
    currency='USD', budget=0,
    adults=2, children=0, childAges=[],
    level='mid', prefs='', special='', diet='', todo=''
  } = payload || {};

  const travelerLine =
    `${adults} adult${adults===1?'':'s'}` +
    (children ? ` + ${children} kid${children===1?'':'s'}${childAges?.length?` (${childAges.join(', ')})`:''}` : '');

  const sys = `
You are a senior travel designer. Produce a polished, *link-ready* Markdown report for families or couples as applicable.

Rules:
- **Return Markdown only** (no HTML). Keep to 900–1400 words.
- Use tokens instead of raw URLs:
  [Map](map: PLACE), [Book](book: PLACE), [Tickets](tickets: PLACE), [Reviews](reviews: PLACE), [Add to Calendar](cal: TITLE), and optional hero images with ![Alt](image: QUERY).
- Make every recommendation include a short *why/value* sentence.
- Section order (exact): Title; "Travelers | Style | Budget"; "Actions"; "Quick Facts"; "Trip Summary"; "Where to Stay"; "Highlights"; "Day-by-Day Plan"; "Getting Around"; "Budget Summary (rough)"; "Dining Short-List"; "Bookings Checklist"; "Footer".
- Use the user’s currency code and symbol in the text (do not crawl rates).`;

  const user = `
Destination: ${destination}
Dates: ${start} → ${end}
Travelers: ${travelerLine}
Style: ${level}
Budget: ${budget} ${currency}
Preferences: ${prefs || '-'}
Dietary Needs: ${diet || '-'}
Special Requests: ${special || '-'}
Extra To-Dos from client: ${todo || '-'}

Return well-structured Markdown following the section order above. Include 1–3 hero images with ![Alt](image: ${destination} skyline, ${destination} family attractions). Use the token links everywhere (no raw URLs).`;

  let md = '';
  if (openaiEnabled) {
    const resp = await openai.chat.completions.create({
      model: process.env.WAYZO_MODEL || 'gpt-4o-mini',
      temperature: 0.6,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    });
    md = resp.choices?.[0]?.message?.content?.trim() || '';
  }
  if (!md || !looksComplete(md)) md = localPlanMarkdown(payload);
  return linkifyTokens(md, destination);
}

// -------- API --------
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
  savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'preview', data: payload, teaser_html: teaser }));
  res.json({ id, teaser_html: teaser, affiliates: aff, version: WAYZO_VERSION });
});

app.post('/api/plan', async (req, res) => {
  const payload = req.body || {};
  const id = uid();

  try {
    const md = await generateWithOpenAI(payload);
    const mdLinked = linkifyTokens(md, payload.destination);
    const html = marked.parse(mdLinked);
    const aff = affiliatesFor(payload.destination);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown: mdLinked }));
    res.json({ id, markdown: mdLinked, html, affiliates: aff, version: WAYZO_VERSION });
  } catch (e) {
    console.error('AI error → fallback to local:', e);
    const md = linkifyTokens(localPlanMarkdown(payload), payload.destination);
    const html = marked.parse(md);
    const aff = affiliatesFor(payload.destination);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown: md }));
    res.json({ id, markdown: md, html, affiliates: aff, version: WAYZO_VERSION });
  }
});

// -------- HTML “PDF view” --------
app.get('/api/plan/:id/pdf', (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const saved = JSON.parse(row.payload || '{}');

  const html = `
  <html><head><meta charset="utf-8"/>
  <title>Wayzo PDF</title>
  <style>
    body{font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:24px;color:#0f172a;background:#ffffff}
    h1,h2,h3{margin:.8rem 0 .5rem}
    ul{margin:.3rem 0 .6rem 1.2rem}
    table{border-collapse:collapse;width:100%;margin:.6rem 0}
    th,td{border:1px solid #cbd5e1;padding:.5rem .6rem;text-align:left}
    thead th, th{background:#f1f5f9}
    img{max-width:100%;height:auto;border-radius:10px}
    .muted{color:#64748b}
    @media print { a { color: inherit; text-decoration: none; } }
  </style></head>
  <body>
    ${marked.parse(saved.markdown || '')}
    <p class="muted">Generated by Wayzo — ${WAYZO_VERSION}</p>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// -------- SPA catch-all --------
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.setHeader('X-Wayzo-Version', WAYZO_VERSION);
  if (!fs.existsSync(INDEX_FILE)) return res.status(500).send('index file missing');
  res.sendFile(INDEX_FILE);
});

app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log('Version:', WAYZO_VERSION);
  console.log('Serving frontend from:', FRONTEND_DIR);
  console.log('Serving docs from:', DOCS_DIR);
  console.log('Index file:', INDEX_FILE);
});
