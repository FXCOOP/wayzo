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

const WAYZO_VERSION = 'pro-report-2025-08-19-v3'; // <-- visible at /api/version

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
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
app.use(compression());
app.use(morgan('tiny'));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false, validate: { trustProxy: true } }));

// ---------- Static ----------
app.use('/docs', express.static(DOCS_DIR, { setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=604800') }));
app.use(express.static(FRONTEND_DIR, {
  setHeaders: (res, filePath) => {
    if (/\.css$/i.test(filePath)) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    if (/\.js$/i.test(filePath))  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (/\.(css|js|svg|png|jpg|jpeg|webp|ico)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

// Root → HTML
app.get('/', (_req, res) => {
  res.setHeader('X-Wayzo-Version', WAYZO_VERSION);
  if (!fs.existsSync(INDEX_FILE)) return res.status(500).send('index file missing');
  res.sendFile(INDEX_FILE);
});

// Health / Version
app.get('/api/health', (_req, res) => res.json({ ok: true, version: WAYZO_VERSION }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/api/version', (_req, res) => res.json({ version: WAYZO_VERSION }));

// ---------- DB ----------
const dbPath = path.join(REPO_ROOT, 'wayzo.sqlite');
const db = new Database(dbPath);
db.exec(`CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, payload TEXT NOT NULL);`);
const savePlan = db.prepare('INSERT OR REPLACE INTO plans (id, created_at, payload) VALUES (?, ?, ?)');
const getPlan  = db.prepare('SELECT payload FROM plans WHERE id = ?');

const nowIso = () => new Date().toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

// ---------- Affiliates (optional env IDs) ----------
const AFF = {
  bookingAid: process.env.BOOKING_AID || "",   // e.g. 1234567
  gygPid:     process.env.GYG_PID || "",       // e.g. ABCD123
  kayakAid:   process.env.KAYAK_AID || "",
};

// Quick links shown on the page (unchanged)
function affiliatesFor(dest = '') {
  const q = encodeURIComponent(dest || '');
  const bookingAidParam = AFF.bookingAid ? `&aid=${AFF.bookingAid}` : '';
  const gygPidParam     = AFF.gygPid     ? `&partner_id=${AFF.gygPid}` : '';
  return {
    maps:      `https://www.google.com/maps/search/?api=1&query=${q}`,
    flights:   `https://www.kayak.com/flights?search=${q}${AFF.kayakAid ? `&aid=${AFF.kayakAid}` : ''}`,
    hotels:    `https://www.booking.com/searchresults.html?ss=${q}${bookingAidParam}`,
    activities:`https://www.getyourguide.com/s/?q=${q}${gygPidParam}`,
    cars:      `https://www.rentalcars.com/SearchResults.do?destination=${q}`,
    insurance: `https://www.worldnomads.com/`,
    reviews:   `https://www.tripadvisor.com/Search?q=${q}`,
  };
}

// ---------- Token links → Real URLs ----------
function linkFor(kind, place, destination = '') {
  const q = encodeURIComponent(`${place} ${destination}`.trim());
  const bookingAidParam = AFF.bookingAid ? `&aid=${AFF.bookingAid}` : '';
  const gygPidParam     = AFF.gygPid     ? `&partner_id=${AFF.gygPid}` : '';
  switch (kind) {
    case 'map':     return `https://www.google.com/maps/search/?api=1&query=${q}`;
    case 'book':    return `https://www.booking.com/searchresults.html?ss=${q}${bookingAidParam}`;
    case 'tickets': return `https://www.getyourguide.com/s/?q=${q}${gygPidParam}`;
    case 'reviews': return `https://www.tripadvisor.com/Search?q=${q}`;
    case 'cal':     return `https://calendar.google.com/`;
    default:        return '#';
  }
}
function linkifyTokens(markdown, destination = '') {
  if (!markdown) return markdown;
  const re = /\[(Map|Tickets|Book|Reviews|Add to Calendar)\]\((map|tickets|book|reviews|cal):([^)]+)\)/gi;
  return markdown.replace(re, (_m, label, kind, body) => {
    const place = String(body || '').replace(/\s+/g, ' ').trim();
    return `[${label}](${linkFor(kind.toLowerCase(), place, destination)})`;
  });
}

// ---------- Local PRO fallback (so even w/o OpenAI it’s long & professional) ----------
function localPlanMarkdown(input) {
  const { destination='Your destination', start='start', end='end', budget=1500, travelers=2, level='budget', prefs='' } = input || {};
  const md = `# ${destination} Itinerary (${start} – ${end})

**Travelers:** ${travelers} | **Style:** ${level} | **Budget:** $${budget}

Actions: Download PDF | Edit Inputs

## Quick Facts
- Weather: seasonal temps; confirm 48h prior.
- Currency: local; cards widely accepted.
- Language: English availability varies.
- Power: bring adapter.
- Tipping: typical ranges.

**[View Full Trip Map](map:${destination} center)**

## Trip Summary
- Cluster by neighborhoods to reduce transit.
- Mix icons + hidden gems.
- Don’t Miss: signature viewpoint at sunset.

## Where to Stay
- **Budget:** Sample Hotel — central and clean. [Book](book:Sample Hotel ${destination}) | [Map](map:Sample Hotel ${destination})
- **Mid:** Midtown Boutique — quiet, walkable. [Book](book:Midtown Boutique ${destination}) | [Map](map:Midtown Boutique ${destination})
- **High:** Grand Palace — top service & views. [Book](book:Grand Palace ${destination}) | [Map](map:Grand Palace ${destination})

## Highlights
- Main Museum — prebook to skip lines. [Map](map:${destination} Main Museum) | [Tickets](tickets:${destination} Main Museum) | [Reviews](reviews:${destination} Main Museum)
- Old Town — cafés & architecture. [Map](map:${destination} Old Town) | [Reviews](reviews:${destination} Old Town)
- River Cruise — best at dusk. [Map](map:${destination} River Cruise) | [Tickets](tickets:${destination} River Cruise)

## Day-by-Day Plan
### Day 1 — Historic Core
- Morning: Main Museum — hit top halls first. [Map](map:${destination} Main Museum) | [Tickets](tickets:${destination} Main Museum)
- Afternoon: Cathedral & square — short loop. [Map](map:${destination} Cathedral)
- Evening: River Cruise — city lights. [Map](map:${destination} River Cruise) | [Tickets](tickets:${destination} River Cruise)
- Meals: Breakfast “Café One”; Lunch “Bistro Two”; Dinner “Brasserie Three”. [Reviews](reviews:${destination} Café One) | [Map](map:${destination} Café One)
- Transit: ~25m walk + ~15m metro/taxi.

## Getting Around
- Airport → center options with times & costs.
- Day passes save money for 3+ rides/day.
- Taxi/rideshare for late nights.

## Budget Summary (rough)
| Category | Per Day | Total | Notes |
|---|---:|---:|---|
| Stay | $… | $… | by style |
| Food | $… | $… | per person/day |
| Activities | $… | $… | key paid items |
| Transit | $… | $… | passes/transfers |

## Dining Short-List
- Café One — iconic breakfast. [Reviews](reviews:${destination} Café One) | [Map](map:${destination} Café One)
- Le Soufflé — classic mains + dessert. [Reviews](reviews:${destination} Le Soufflé) | [Map](map:${destination} Le Soufflé)

## Bookings Checklist
- Main Museum 9:00 — timed entry. [Tickets](tickets:${destination} Main Museum) | [Add to Calendar](cal:${destination} Main Museum 09:00)
- River Cruise 19:00 — sunset slot. [Tickets](tickets:${destination} River Cruise) | [Add to Calendar](cal:${destination} River Cruise 19:00)

## Footer
Generated by Wayzo.`;
  return linkifyTokens(md, destination);
}

// ---------- OpenAI ----------
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function generateWithOpenAI(payload) {
  const { destination, start, end, travelers, level, budget, prefs, long_input } = payload || {};
  const sys = [
    'You are Wayzo, a professional travel planner.',
    'Return a polished, publication-quality TRIP REPORT in Markdown only.',
    'Add a short sentence (what/why/value) to EVERY recommendation.',
    'Use ONLY token links like: [Map](map:PLACE), [Tickets](tickets:PLACE), [Book](book:PLACE), [Reviews](reviews:PLACE), [Add to Calendar](cal:TITLE).',
    'No real URLs. No HTML. PDF-friendly structure.'
  ].join(' ');
  const user = [
    `Destination: ${destination || '-'}`,
    `Dates: ${start || '-'} → ${end || '-'}`,
    `Travelers: ${travelers || '-'}`,
    `Style: ${level || '-'}`,
    `Budget(USD): ${budget || '-'}`,
    `Preferences: ${prefs || '-'}`,
    long_input ? `Extra brief:\n${long_input}` : '',
    '',
    'SECTION ORDER (exact):',
    '# <Destination> Itinerary (<Start> – <End>)',
    '',
    '**Travelers:** <n> | **Style:** <style> | **Budget:** <budget> | **Season:** <auto>',
    '',
    'Actions: Download PDF | Edit Inputs',
    '',
    '## Quick Facts',
    '- Weather (per-day if possible).',
    '- Currency; payment notes.',
    '- Language.',
    '- Power/plug; adapter note.',
    '- Tipping norms.',
    '',
    `**[View Full Trip Map](map:${destination || 'City Center'})**`,
    '',
    '## Trip Summary',
    '- 2–4 bullets: approach, neighborhoods, pacing.',
    "- Don't Miss: one signature moment.",
    '',
    '## Where to Stay',
    '- Budget: <Hotel — why>. [Book](book:<Hotel>) | [Map](map:<Hotel>)',
    '- Mid: <Hotel — why>. [Book](book:<Hotel>) | [Map](map:<Hotel>)',
    '- High: <Hotel — why>. [Book](book:<Hotel>) | [Map](map:<Hotel>)',
    'Tip which area fits which traveler.',
    '',
    '## Highlights',
    '- <Attraction — value>. [Map](map:<Attraction>) | [Tickets](tickets:<Attraction>) | [Reviews](reviews:<Attraction>)',
    'Include 6–10 items.',
    '',
    '## Day-by-Day Plan',
    '### Day 1 — <Theme>',
    '- Morning: <Place — why>. [Map](map:<Place>) | [Tickets](tickets:<Place>) | [Reviews](reviews:<Place>)',
    '- Afternoon: <Place — why>. [Map](map:<Place>) | [Reviews](reviews:<Place>)',
    '- Evening: <Place — why>. [Map](map:<Place>) | [Tickets](tickets:<Place>)',
    '- If raining: <Indoor alt>. [Map](map:<Alt>)',
    '- With kids: <Kid alt>. [Map](map:<Alt>)',
    '- Meals: Breakfast <Place — cue>. [Reviews](reviews:<Place>) | [Map](map:<Place>); Lunch <...>; Dinner <...>.',
    '- Transit total today: ~<mins> walking, ~<mins> metro/taxi.',
    '',
    '### Day 2 — <Theme>',
    '(Repeat.)',
    '',
    '### Day 3 — <Theme>',
    '(Repeat as needed.)',
    '',
    '## Getting Around',
    '- Airport → city with times/costs.',
    '- Passes and typical ride times.',
    '- Taxi/rideshare ranges.',
    '',
    '## Budget Summary (rough)',
    '| Category | Per Day | Total | Notes |',
    '|---|---:|---:|---|',
    '| Stay | $… | $… | by style |',
    '| Food | $… | $… | per person/day |',
    '| Activities | $… | $… | key paid items |',
    '| Transit | $… | $… | passes/transfers |',
    '',
    '## Dining Short-List',
    '- <Restaurant — cuisine; cue>. [Reviews](reviews:<Restaurant>) | [Map](map:<Restaurant>)',
    'Provide 6–10 items.',
    '',
    '## Bookings Checklist',
    '- <Item — timing>. [Tickets](tickets:<Item>) | [Add to Calendar](cal:<Item>)',
    'Include 5–8 items.',
    '',
    '## Footer',
    '- Generated by Wayzo, <today local time>. Prices/availability can change.'
  ].join('\n');

  let md = '';
  if (openaiEnabled) {
    const resp = await openai.chat.completions.create({
      model: process.env.WAYZO_MODEL || 'gpt-4o-mini',
      temperature: 0.5,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    });
    md = resp.choices?.[0]?.message?.content?.trim() || '';
  }
  if (!md) md = localPlanMarkdown(payload);
  return linkifyTokens(md, destination || '');
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
    let markdown = await generateWithOpenAI(payload); // always try PRO
    const aff = affiliatesFor(payload.destination);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown, affiliates: aff }));
    res.json({ id, markdown, affiliates: aff, version: WAYZO_VERSION });
  } catch (e) {
    console.error('AI error → fallback:', e);
    const markdown = localPlanMarkdown(payload);
    const aff = affiliatesFor(payload.destination);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown, affiliates: aff }));
    res.json({ id, markdown, affiliates: aff, version: WAYZO_VERSION });
  }
});

// PDF view
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
    table{border-collapse:collapse;margin:.4rem 0;width:100%}
    th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
    th{background:#f8fafc}
    .muted{color:#64748b}
    @media print { a { color: inherit; text-decoration: none; } }
  </style></head>
  <body>
    ${marked.parse(saved.markdown || '')}
    <p class="muted">Generated by Wayzo · ${WAYZO_VERSION}</p>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Wayzo-Version', WAYZO_VERSION);
  res.send(html);
});

// SPA catch-all
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
