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

// ---------- Affiliate templates (edit envs to add your IDs) ----------
const AFF = {
  bookingAid: process.env.BOOKING_AID || "",   // e.g. "1234567"
  gygPid:     process.env.GYG_PID || "",       // e.g. "ABCD123"
  kayakAid:   process.env.KAYAK_AID || "",     // if you use Kayak
};

// ---------- Top-level quick links (kept) ----------
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

// ---------- Link token → real URL ----------
function linkFor(kind, place, destination = '') {
  const q = encodeURIComponent(`${place} ${destination}`.trim());
  const bookingAidParam = AFF.bookingAid ? `&aid=${AFF.bookingAid}` : '';
  const gygPidParam     = AFF.gygPid     ? `&partner_id=${AFF.gygPid}` : '';

  switch (kind) {
    case 'map':     return `https://www.google.com/maps/search/?api=1&query=${q}`;
    case 'book':    return `https://www.booking.com/searchresults.html?ss=${q}${bookingAidParam}`;
    case 'tickets': return `https://www.getyourguide.com/s/?q=${q}${gygPidParam}`;
    case 'reviews': return `https://www.tripadvisor.com/Search?q=${q}`;
    // Optional: cal could become a deep link to a calendar helper
    case 'cal':     return `https://calendar.google.com/`; // placeholder
    default:        return '#';
  }
}

function linkifyTokens(markdown, destination = '') {
  if (!markdown) return markdown;
  // Matches: [Map](map:Place), [Tickets](tickets:Place), [Book](book:Place), [Reviews](reviews:Place), [Add to Calendar](cal:Title ...)
  const re = /\[(Map|Tickets|Book|Reviews|Add to Calendar)\]\((map|tickets|book|reviews|cal):([^)]+)\)/gi;
  return markdown.replace(re, (_m, _label, kind, body) => {
    const place = String(body || '').replace(/\s+/g, ' ').trim();
    const url = linkFor(kind.toLowerCase(), place, destination);
    // Keep the original label so the text shows as "Map | Tickets | Book | Reviews"
    const label = (_label || '').trim();
    return `[${label}](${url})`;
  });
}

// ---------- Local fallback content ----------
function localPlanMarkdown(input) {
  const {
    destination = 'Your destination',
    start = 'start', end = 'end',
    budget = 1500, travelers = 2,
    level = 'budget', prefs = '',
  } = input || {};
  return `# ${destination} Itinerary (${start} → ${end})

**Travelers:** ${travelers} | **Style:** ${level} | **Budget:** $${budget}

**Preferences:** ${prefs || '—'}

---

## Trip Summary
Balanced mix of must-sees and local gems in ${destination}. Use transit passes to reduce costs.

## Day 1
- Morning: Historic center — [Map](map:${destination} center)
- Afternoon: Major museum — [Tickets](tickets:${destination} museum)
- Evening: Local dinner — [Reviews](reviews:${destination} best dinner)

## Getting Around
- Day pass recommended; taxis for late nights.

## Budget (rough)
| Item | Estimate |
| --- | ---: |
| Stay | $100–180/night |
| Food | $25–45 pp/day |
| Activities | $10–25 each |
| Transit | $5–15/day |
`;
}

// ---------- OpenAI ----------
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function generateWithOpenAI(payload) {
  const { destination, start, end, travelers, level, budget, prefs, long_input } = payload || {};

  // ===== Wayzo PRO report prompt (tokenized links) =====
  const sys = [
    "You are Wayzo, a professional travel planner.",
    "Return a polished, publication-quality TRIP REPORT in Markdown.",
    "Include SHORT sentences for each recommendation (what/why/value).",
    "Include explicit link tokens using this exact format:",
    "  [Map](map:PLACE), [Tickets](tickets:PLACE), [Book](book:PLACE), [Reviews](reviews:PLACE), [Add to Calendar](cal:TITLE OR SLOT).",
    "Do NOT use real URLs; only these tokens. No HTML.",
    "Write for PDF readability: clear headers, bullets, tables.",
  ].join(" ");

  const user = [
    `Destination: ${destination || "-"}`,
    `Dates: ${start || "-"} → ${end || "-"}`,
    `Travelers: ${travelers || "-"}`,
    `Style: ${level || "-"}`,
    `Budget(USD): ${budget || "-"}`,
    `Preferences: ${prefs || "-"}`,
    long_input ? `Extra brief:\n${long_input}` : "",
    "",
    "Follow THIS SECTION ORDER exactly:",
    "",
    "# <Destination> Itinerary (<Start> – <End>)",
    "",
    "**Travelers:** <n> | **Style:** <style> | **Budget:** <budget> | **Season:** <auto>",
    "",
    "Actions: Download PDF | Edit Inputs",
    "",
    "## Quick Facts",
    "- Weather (typical for dates, 1 line per day if possible).",
    "- Currency symbol and common payment notes.",
    "- Language.",
    "- Power/plug type; voltage; include note to bring adapter.",
    "- Tipping norms.",
    "",
    `**[View Full Trip Map](map:${destination || "City Center"})**`,
    "",
    "## Trip Summary",
    "- 2–4 bullets: overall approach, neighborhoods, pacing.",
    "- 1 'Don't Miss' line for a signature moment.",
    "",
    "## Where to Stay",
    "- Budget: <Hotel — 1-sentence why>. [Book](book:<Hotel>) | [Map](map:<Hotel>)",
    "- Mid: <Hotel — 1-sentence why>. [Book](book:<Hotel>) | [Map](map:<Hotel>)",
    "- High: <Hotel — 1-sentence why>. [Book](book:<Hotel>) | [Map](map:<Hotel>)",
    "Add a tip on which area fits which traveler.",
    "",
    "## Highlights",
    "- <Attraction — 1-sentence value>. [Map](map:<Attraction>) | [Tickets](tickets:<Attraction>) | [Reviews](reviews:<Attraction>)",
    "- Include 6–10 items mixing icons and hidden gems.",
    "",
    "## Day-by-Day Plan",
    "### Day 1 — <Theme>",
    "- Morning: <Place + short why>. [Map](map:<Place>) | [Tickets](tickets:<Place>) | [Reviews](reviews:<Place>)",
    "- Afternoon: <Place + short why>. [Map](map:<Place>) | [Reviews](reviews:<Place>)",
    "- Evening: <Place + short why>. [Map](map:<Place>) | [Tickets](tickets:<Place>)",
    "- If raining: <Indoor alt>. [Map](map:<Alt>)",
    "- With kids: <Kid-friendly alt>. [Map](map:<Alt>)",
    "- Meals: Breakfast <Place — cue>. [Reviews](reviews:<Place>) | [Map](map:<Place>); Lunch <...>; Dinner <...>.",
    "- Transit total today: ~<mins> walking, ~<mins> metro/taxi.",
    "",
    "### Day 2 — <Theme>",
    "(Repeat same structure.)",
    "",
    "### Day 3 — <Theme>",
    "(Repeat if trip length permits.)",
    "",
    "## Getting Around",
    "- Airport → city options with times/costs.",
    "- Transit passes and typical ride times.",
    "- Taxi/rideshare ranges.",
    "",
    "## Budget Summary (rough)",
    "| Category | Per Day | Total | Notes |",
    "|---|---:|---:|---|",
    "| Stay | $… | $… | by style |",
    "| Food | $… | $… | per person/day |",
    "| Activities | $… | $… | key paid items |",
    "| Transit | $… | $… | passes/transfers |",
    "",
    "## Dining Short-List",
    "- <Restaurant — cuisine; 1-sentence cue>. [Reviews](reviews:<Restaurant>) | [Map](map:<Restaurant>)",
    "- 6–10 items mixing budget tiers.",
    "",
    "## Packing + Etiquette",
    "- Packing: 3–5 bullets tailored to dates.",
    "- Etiquette: 3–5 bullets; scams to avoid.",
    "",
    "## Bookings Checklist",
    "- <Attraction/Experience — timing>. [Tickets](tickets:<Item>) | [Add to Calendar](cal:<Item>)",
    "- Include 5–8 items.",
    "",
    "## Footer",
    "- Generated by Wayzo, <today local time>. Prices/availability can change.",
    "",
    "IMPORTANT:",
    "- Use the token links exactly as shown (map:, tickets:, book:, reviews:, cal:).",
    "- Add a short helpful sentence for each recommendation (what/why/value).",
    "- Keep tone professional and concise."
  ].join("\n");

  const resp = await openai.chat.completions.create({
    model: process.env.WAYZO_MODEL || 'gpt-4o-mini',
    temperature: 0.5,
    messages: [
      { role: 'system', content: sys },
      { role: 'user',   content: user },
    ],
  });

  let md = resp.choices?.[0]?.message?.content?.trim() || '';
  // Convert token links to real affiliate URLs
  md = linkifyTokens(md, destination || '');
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
    table{border-collapse:collapse;margin:.4rem 0;width:100%}
    th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
    th{text-align:left;background:#f8fafc}
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
