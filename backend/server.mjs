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

// ---------- Version ----------
const WAYZO_VERSION = 'staging-v11';

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
const staticHeaders = {
  setHeaders: (res, filePath) => {
    if (/\.css$/i.test(filePath)) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    if (/\.js$/i.test(filePath)) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (/\.(css|js|svg|png|jpg|jpeg|webp|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
};
app.use('/docs', express.static(DOCS_DIR, { setHeaders: (r) => r.setHeader('Cache-Control', 'public, max-age=604800') }));
app.use('/frontend', express.static(FRONTEND_DIR, staticHeaders));
app.use(express.static(FRONTEND_DIR, staticHeaders));

// ---------- Root / Health / Version ----------
app.get('/', (_req, res) => {
  res.setHeader('X-Wayzo-Version', WAYZO_VERSION);
  if (!fs.existsSync(INDEX_FILE)) return res.status(500).send('index file missing');
  res.sendFile(INDEX_FILE);
});
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/api/version', (_req, res) => res.json({ version: WAYZO_VERSION }));

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

// ---------- Currency helpers ----------
const CURRENCIES = {
  USD: { sym: '$', name: 'US Dollar' },
  EUR: { sym: '€', name: 'Euro' },
  GBP: { sym: '£', name: 'British Pound' },
  CAD: { sym: '$', name: 'Canadian Dollar' },
  AUD: { sym: '$', name: 'Australian Dollar' },
  JPY: { sym: '¥', name: 'Japanese Yen' },
  CHF: { sym: 'CHF', name: 'Swiss Franc' },
  CNY: { sym: '¥', name: 'Chinese Yuan' },
  INR: { sym: '₹', name: 'Indian Rupee' },
  SEK: { sym: 'kr', name: 'Swedish Krona' },
};
function fmtMoney(amount, code = 'USD') {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(amount);
  } catch {
    const sym = CURRENCIES[code]?.sym || '$';
    return `${sym}${Math.round(amount).toLocaleString()}`;
  }
}

// ---------- Affiliates ----------
function affiliatesFor(dest = '') {
  const q = encodeURIComponent(dest || '');
  return {
    maps: (t) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t || dest)}`,
    flights: () => `https://www.kayak.com/flights?search=${q}`,
    hotels: (t) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(t || dest)}`,
    activities: (t) => `https://www.getyourguide.com/s/?q=${encodeURIComponent(t || dest)}`,
    cars: () => `https://www.rentalcars.com/SearchResults.do?destination=${q}`,
    insurance: () => `https://www.worldnomads.com/`,
    reviews: (t) => `https://www.tripadvisor.com/Search?q=${encodeURIComponent(t || dest)}`,
    image: (t) => `https://source.unsplash.com/featured/?${encodeURIComponent(t || dest)}`,
  };
}

// ---------- Token linkifier (map:/book:/tickets:/reviews:/image:/cal:) ----------
function linkifyTokens(markdown, dest = '') {
  const aff = affiliatesFor(dest);
  const up = (s) => (s || '').trim();

  // [Text](map: Eiffel Tower)
  markdown = markdown.replace(/\]\((map|book|tickets|reviews|cal):\s*([^)]+)\)/gi, (_m, type, term) => {
    const t = up(term); const k = type.toLowerCase();
    switch (k) {
      case 'map': return `](${aff.maps(t)})`;
      case 'book': return `](${aff.hotels(t)})`;
      case 'tickets': return `](${aff.activities(t)})`;
      case 'reviews': return `](${aff.reviews(t)})`;
      case 'cal': return `](https://calendar.google.com/)`;
      default: return `](#)`;
    }
  });

  // ![Alt](image: Berlin skyline)
  markdown = markdown.replace(/\!\[([^\]]*?)\]\(\s*image:\s*([^)]+)\)/gi, (_m, alt, term) => {
    const url = aff.image(up(term));
    return `![${alt}](${url})`;
  });

  // bare (map:City Center) -> direct map link
  markdown = markdown.replace(/\(map:([^)]+)\)/gi, (_m, t) =>
    `(https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(up(t))})`
  );

  return markdown;
}

// ---------- Helpers ----------
function parseDate(s) {
  // Accept yyyy-mm-dd or mm/dd/yyyy
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function daysBetween(start, end) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((end - start) / ms) + 1);
}
function enumerateDays(start, end) {
  const out = [];
  const ms = 24 * 60 * 60 * 1000;
  let t = start.getTime();
  while (t <= end.getTime()) {
    out.push(new Date(t));
    t += ms;
  }
  return out;
}

// ---------- Local fallback content (rich) ----------
function localPlanMarkdown(input) {
  const {
    destination = 'Your destination',
    start = 'start',
    end = 'end',
    budget = 1500,
    currency = 'USD',
    adults = 2,
    kids = 0,
    kids_ages = [],
    style = 'mid',
    prefs = '',
    diet = '',
    special = '',
    todo = '',
  } = input || {};

  const startD = parseDate(start) || new Date();
  const endD = parseDate(end) || new Date(startD.getTime() + 2 * 86400000);
  const nDays = daysBetween(startD, endD);
  const allDays = enumerateDays(startD, endD);

  // Budget model
  const weights = { Stay: 0.45, Food: 0.28, Activities: 0.17, Transit: 0.10 };
  const perDay = budget / nDays;
  const totals = Object.fromEntries(Object.entries(weights).map(([k, w]) => [k, Math.round(budget * w)]));

  const pax = `${adults} adult${adults === 1 ? '' : 's'}${kids ? ` + ${kids} kid${kids === 1 ? '' : 's'}${kids_ages.length ? ` (${kids_ages.join(', ')})` : ''}` : ''}`;
  const sym = CURRENCIES[currency]?.sym || '$';

  const dayThemes = [
    'Historic Core',
    'Parks & Views',
    'Waterfront & Markets',
    'Museums & Culture',
    'Neighborhood Gems',
    'Architecture Walk',
    'Family Day',
  ];
  const mealTriplet = [
    'Breakfast “Café One”',
    'Lunch “Bistro Two”',
    'Dinner “Brasserie Three”',
  ].join('; ');

  let daysMd = '';
  allDays.forEach((d, i) => {
    const theme = dayThemes[i % dayThemes.length];
    const label = d.toLocaleDateString('en', { month: 'short', day: 'numeric', weekday: 'short' });
    daysMd += `
### Day ${i + 1} — ${theme} (${label})
- **Morning:** Top landmark or museum. [Map](map:${destination} landmark) | [Tickets](tickets:${destination} landmark) | [Reviews](reviews:${destination} landmark)
- **Afternoon:** Neighborhood walk / market. [Map](map:${destination} market)
- **Evening:** Signature viewpoint / riverfront. [Map](map:${destination} viewpoint) | [Reviews](reviews:${destination} viewpoint)
- **Meals:** ${mealTriplet}. [Reviews](reviews:${destination} restaurants) | [Map](map:${destination} restaurants)
- **Transit total today:** ~25–45 min walking, ~15–25 min metro/taxi.
`;
  });

  const toDos = (todo || '')
    .split(/\n+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => `- [ ] ${t}`)
    .join('\n');

  const md = `
# ${destination} Itinerary (${start} – ${end})

![${destination} skyline](image: ${destination} skyline)
![Family Attractions in ${destination}](image: ${destination} family attractions)

**Travelers:** ${pax} | **Style:** ${style} | **Budget:** ${fmtMoney(budget, currency)} ${currency}

${prefs ? `**Preferences:** ${prefs}\n` : ''}${diet ? `**Dietary needs:** ${diet}\n` : ''}${special ? `**Special requests:** ${special}\n` : ''}

Actions: Download PDF | Edit Inputs

## Quick Facts
- Language: local + English availability.
- Currency: ${currency} (${sym}).
- Power: bring adapter if needed.
- Tipping: common ranges by venue.

**[View Full Trip Map](map:${destination} center)**

## Trip Summary
- Cluster by neighborhoods to reduce transit time.
- Mix icons with hidden gems and timed entries where needed.
- Don’t Miss: signature viewpoint at sunset.

## Where to Stay
- **Budget:** Friendly Inn — great value near transit. [Book](book:${destination} Friendly Inn) | [Map](map:${destination} Friendly Inn) | [Reviews](reviews:${destination} Friendly Inn)
- **Mid:** Midtown Boutique — walkable & quiet. [Book](book:${destination} Midtown Boutique) | [Map](map:${destination} Midtown Boutique) | [Reviews](reviews:${destination} Midtown Boutique)
- **High:** Grand Palace — views + pool. [Book](book:${destination} Grand Palace) | [Map](map:${destination} Grand Palace) | [Reviews](reviews:${destination} Grand Palace)

## Highlights
- Main Museum — prebook to skip lines. [Map](map:${destination} Main Museum) | [Tickets](tickets:${destination} Main Museum) | [Reviews](reviews:${destination} Main Museum)
- Old Town — cafés & architecture. [Map](map:${destination} Old Town) | [Reviews](reviews:${destination} Old Town)
- River Cruise — best at dusk. [Map](map:${destination} River Cruise) | [Tickets](tickets:${destination} River Cruise)

## Day-by-Day Plan
${daysMd}

## Getting Around
- Airport → center options with times & costs.
- Day passes save money for 3+ rides/day.
- Taxi/rideshare for late nights.

## Budget Summary (rough)
| Category  | Per Day | Total | Notes           |
|-----------|-------:|------:|-----------------|
| Stay      | ${fmtMoney(perDay * weights.Stay, currency)} | ${fmtMoney(totals.Stay, currency)} | by style         |
| Food      | ${fmtMoney(perDay * weights.Food, currency)} | ${fmtMoney(totals.Food, currency)} | per person/day   |
| Activities| ${fmtMoney(perDay * weights.Activities, currency)} | ${fmtMoney(totals.Activities, currency)} | key paid items  |
| Transit   | ${fmtMoney(perDay * weights.Transit, currency)} | ${fmtMoney(totals.Transit, currency)} | passes/transfers |

## Dining Short-List
- Café One — iconic breakfast. [Reviews](reviews:${destination} breakfast) | [Map](map:${destination} breakfast)
- Le Soufflé — classic mains + dessert. [Reviews](reviews:${destination} dinner) | [Map](map:${destination} dinner)

## Bookings Checklist
- [ ] Main Museum ${start} — timed entry. [Tickets](tickets:${destination} Main Museum) | [Add to Calendar](cal:${destination} Main Museum)
- [ ] River Cruise ${end} — sunset slot. [Tickets](tickets:${destination} River Cruise) | [Add to Calendar](cal:${destination} River Cruise)
${toDos ? `${toDos}\n` : ''}

## Footer
Generated by Wayzo — ${WAYZO_VERSION}
`;
  return linkifyTokens(md, destination);
}

// ---------- OpenAI (optional) ----------
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function generateWithOpenAI(payload) {
  const {
    destination,
    start,
    end,
    adults,
    kids,
    kids_ages = [],
    style,
    budget,
    currency = 'USD',
    prefs = '',
    diet = '',
    special = '',
    todo = '',
  } = payload || {};

  const sys = `You are a senior travel planner. Return polished MARKDOWN only. 
- Use token links ONLY: [Map](map:PLACE) [Tickets](tickets:PLACE) [Book](book:PLACE) [Reviews](reviews:PLACE) [Add to Calendar](cal:TITLE).
- Include 1–3 images via tokens: ![Alt](image: QUERY).
- Required sections and order: Title; Travelers/Style/Budget line; Actions; Quick Facts; Trip Summary; Where to Stay; Highlights; Day-by-Day Plan; Getting Around; Budget Summary (rough, filled numbers); Dining Short-List; Bookings Checklist (checkbox style - [ ] items including user's To-Dos); Footer.
- Day-by-Day MUST cover **every day** from start to end (Morning/Afternoon/Evening/Meals/Transit).`;

  const user = `Destination: ${destination}
Dates: ${start} → ${end}
Travelers: ${adults} adults${kids ? ` + ${kids} kids (${kids_ages.join(', ')})` : ''}
Style: ${style}
Budget: ${budget} ${currency}
Preferences: ${prefs}
Dietary needs: ${diet}
Special requests: ${special}
Extra To-Dos (append as checkbox items in Bookings Checklist):
${todo || '-'}

Currency code to use for numbers: ${currency}.
Keep tone helpful and specific.`;

  if (!openaiEnabled) return localPlanMarkdown(payload);

  try {
    const resp = await openai.chat.completions.create({
      model: process.env.WAYZO_MODEL || 'gpt-4o-mini',
      temperature: 0.5,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
    });
    const md = resp.choices?.[0]?.message?.content?.trim() || '';
    const linked = linkifyTokens(md, destination);
    return linked;
  } catch (e) {
    console.error('OpenAI error → local fallback', e);
    return localPlanMarkdown(payload);
  }
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
  savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'preview', data: payload, teaser_html: teaser }));
  res.json({ id, teaser_html: teaser, affiliates: aff, version: WAYZO_VERSION });
});

app.post('/api/plan', async (req, res) => {
  const payload = req.body || {};
  const id = uid();
  try {
    const markdown = await generateWithOpenAI(payload);
    const html = marked.parse(markdown);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown }));
    res.json({ id, markdown, html, affiliates: affiliatesFor(payload.destination), version: WAYZO_VERSION });
  } catch (e) {
    console.error('Plan error', e);
    const markdown = localPlanMarkdown(payload);
    const html = marked.parse(markdown);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown }));
    res.json({ id, markdown, html, affiliates: affiliatesFor(payload.destination), version: WAYZO_VERSION });
  }
});

// ---------- PDF (branded HTML) ----------
app.get('/api/plan/:id/pdf', (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const saved = JSON.parse(row.payload || '{}');
  const body = marked.parse(saved.markdown || '');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>Wayzo Trip Report</title>
<style>
  :root{--ink:#0f172a;--muted:#475569;--brand:#6366f1;}
  *{box-sizing:border-box} body{font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;color:var(--ink)}
  header{display:flex;justify-content:space-between;align-items:center;padding:18px 24px;border-bottom:2px solid #e2e8f0;background:#fafafa}
  header .logo{display:flex;align-items:center;gap:10px}
  header .badge{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:var(--brand);color:#fff;font-weight:700}
  header .tagline{color:var(--muted);font-size:13px}
  main{padding:24px}
  h1,h2,h3{margin:.8rem 0 .4rem}
  img{max-width:100%;height:auto;border-radius:10px}
  table{border-collapse:collapse;width:100%;margin:.6rem 0}
  th,td{border:1px solid #cbd5e1;padding:.5rem .6rem;text-align:left}
  thead th, th{background:#f1f5f9}
  .muted{color:var(--muted)}
  @media print { a{ color:inherit; text-decoration:none } }
</style></head>
<body>
<header>
  <div class="logo"><span class="badge">WZ</span><strong>Wayzo</strong><span class="tagline">Trips that plan themselves.</span></div>
  <div class="muted">${WAYZO_VERSION}</div>
</header>
<main>
${body}
<p class="muted">Generated by Wayzo — ${WAYZO_VERSION}</p>
</main>
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
  console.log('Index file:', INDEX_FILE);
});
