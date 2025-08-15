/* Wayzo – backend (CSP off for simplicity; Google Maps + Points API + Checklist) */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import Database from 'better-sqlite3';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';

const PORT = process.env.PORT || 8080;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const app = express();
app.set('trust proxy', 1);

/* Health first */
app.get('/api/health', (_req, res) => res.status(200).json({ ok: true }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.head('/api/health', (_req, res) => res.sendStatus(200));
app.head('/healthz', (_req, res) => res.sendStatus(200));

/* Security headers (CSP OFF so inline <style>/<script> work) */
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: true, credentials: true }));

/* Rate limit (skip health) */
const limiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
});
app.use((req, res, next) => {
  if (req.path === '/api/health' || req.path === '/healthz') return next();
  return limiter(req, res, next);
});

app.use(express.json({ limit: '1mb' }));

/* Paths */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../frontend');
const indexFile = path.join(frontendDir, 'index.backend.html');

/* Root BEFORE static (no cache) */
app.get('/', (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(indexFile);
});
/* Static (no index) */
app.use(express.static(frontendDir, {
  index: false, etag: false, lastModified: false, cacheControl: false, maxAge: 0
}));

/* Debug */
app.get('/__debug', (_req, res) => {
  res.json({
    frontendDir,
    indexFile,
    exists: fs.existsSync(indexFile),
    files: fs.readdirSync(frontendDir),
  });
});

/* --- DB (SQLite) --- */
const defaultDb = path.resolve(__dirname, './wayzo.sqlite');
let dbPath = process.env.DB_PATH || defaultDb;
try { fs.mkdirSync(path.dirname(dbPath), { recursive: true }); }
catch (e) {
  console.warn('DB dir create failed for', path.dirname(dbPath), '-', e.message);
  dbPath = defaultDb;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}
console.log('Using SQLite DB at:', dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  budget INTEGER NOT NULL,
  travelers INTEGER NOT NULL,
  level TEXT NOT NULL,
  prefs TEXT,
  teaser_html TEXT,
  full_markdown TEXT,
  affiliate_json TEXT
);
`);

/* Helpers */
const daysBetween = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86_400_000) + 1);
const affiliatesFor = (city) => {
  const q = encodeURIComponent(city);
  return {
    flights:   `https://www.kayak.com/flights/${q}?aff=${process.env.AFF_KAYAK_AFF || 'AFF'}`,
    hotels:    `https://www.booking.com/searchresults.html?ss=${q}&aid=${process.env.AFF_BOOKING_AID || 'AID'}`,
    activities:`https://www.getyourguide.com/s/?q=${q}&partner_id=${process.env.AFF_GYG_PARTNER || 'PID'}`,
    cars:      `https://www.rentalcars.com/SearchResults.do?destination=${q}&affiliateCode=${process.env.AFF_RENTALCARS_CODE || 'CODE'}`,
    insurance: `https://www.worldnomads.com/?aff=${process.env.AFF_WORLDNOMADS_AFF || 'AFF'}`,
    reviews:   `https://www.tripadvisor.com/Search?q=${q}`,
  };
};
const teaserHTML = ({ destination, start, end, budget, travelers, level, prefs }) => {
  const days = daysBetween(start, end);
  const perPerson = Number(budget) / Math.max(1, Number(travelers));
  const daily = Number(budget) / days;
  const vibe = level === 'luxury'
    ? '5★ comfort, private transfers, and signature dining'
    : level === 'mid'
      ? '3–4★ hotels, major highlights, and local eats'
      : 'hostels/guesthouses, free sights, and budget-friendly eats';
  return `
    <div class="card-soft">
      <div class="badges">
        <span class="badge">🗺️ ${destination}</span>
        <span class="badge">📆 ${days} days</span>
        <span class="badge">💸 ${level}</span>
      </div>
      <p><strong>${days}-day plan for ${destination}</strong> for <strong>${travelers}</strong> traveler(s).</p>
      <p>Estimated total: $${Math.round(budget)} (~$${Math.round(perPerson)} per person), ≈ $${Math.round(daily)}/day${prefs ? ` · Focus: ${prefs}` : ''}.</p>
      <p>Expect ${vibe}. Generate the full schedule when ready.</p>
    </div>
  `;
};

/* ---------- CONFIG for front-end (GMAPS key) ---------- */
app.get('/api/config', (_req, res) => {
  res.json({
    googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || null
  });
});

/* ---------- Preview ---------- */
const validateBody = (req, res, next) => {
  const { destination, start, end, budget, travelers, level } = req.body || {};
  if (!destination || !start || !end || !budget || !travelers || !level) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  next();
};

app.post('/api/preview', validateBody, (req, res) => {
  const { destination, start, end, budget, travelers, level, prefs } = req.body;
  const id = uuidv4();
  const teaser = teaserHTML({ destination, start, end, budget, travelers, level, prefs });
  const aff = affiliatesFor(destination);

  db.prepare(`INSERT INTO plans
    (id, created_at, destination, start_date, end_date, budget, travelers, level, prefs, teaser_html, affiliate_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      id, new Date().toISOString(), destination, start, end,
      Number(budget), Number(travelers), level, prefs || null, teaser, JSON.stringify(aff)
    );

  res.json({ id, teaser_html: teaser, affiliates: aff });
});

/* ---------- Full Plan (OpenAI) ---------- */
app.post('/api/plan', validateBody, async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ error: 'OPENAI_API_KEY missing on server' });

    const {
      destination, start, end, budget, travelers, level, prefs,
      adults, children, childrenAges, pace, startTime, diet, access, stayStyle, transport
    } = req.body;

    const id = uuidv4();
    const aff = affiliatesFor(destination);

    const systemPrompt = `You are Wayzo, an expert travel designer.
Write a unique, highly-usable **markdown** trip report with clear sections.

STRUCTURE (use these headings exactly):
# Trip Summary
- One-paragraph overview.
- Badges: party, kids' ages, pace, style, accessibility, dietary.
- Cost quick glance (total, per person, per day).

## Neighborhood Guide
- 4–6 areas with vibe, when to go, food clusters, quick tips (bullets).

## Day-by-Day Timeline
For each day:
- **Day X – Title**
- Timeline blocks with times (e.g., 09:00 … 11:30 … 14:00 …)
- For each place include: short why-it’s-great + a Google Maps deep link:
  \`[Open in Maps](https://www.google.com/maps/search/?api=1&query=NAME+CITY)\`
- If rainy: give one “Rainy-day swap”.
- Dining: 2–3 options (match dietary needs), rough price per person.
- Accessibility or kid tips if relevant (stroller/wheelchair/quiet).

## Cost Breakdown
A table with buckets (accommodation, food, transport, activities, misc) + totals.

## Essentials
- Transit passes/airport transfers
- Local SIM/eSIM options
- Tipping norms & emergency numbers
- Safety notes (brief, practical)

## Travel Checklist
- Passports/ID + validity check, visas/eTA if needed
- Flights (etickets), hotel confirmations
- Travel insurance policy info
- Driver’s license + International Driving Permit (if renting), credit card for deposit
- Money: primary card + backup, small cash
- Phone: roaming/eSIM, charger, power adapter (plug types), offline maps
- Health: meds, prescriptions, basic first-aid
- For kids: snacks, entertainment, stroller if needed

## Packing List
- 10–15 bullets tuned to month/season (generic if weather unknown).

At the bottom add: **Booking Shortcuts** with these labeled links: [Flights] [Hotels] [Activities] [Cars] [Insurance].
Replace the brackets with actual URLs provided by the user context.`;

    const userPrompt = `
Destination: ${destination}
Dates: ${start} to ${end} (${daysBetween(start,end)} days)
Party: ${adults ? adults : Math.max(0, Number(travelers||0) - Number(children||0))} adults, ${children||0} children ${Array.isArray(childrenAges)&&childrenAges.length ? `(ages ${childrenAges.join(', ')})` : ''}
Budget: $${budget} total (flights included)
Style: ${level} · Stay preference: ${stayStyle||'hotel'}
Pace: ${pace||'balanced'} · Day starts around ${startTime||'09:30'}
Interests: ${prefs || 'not specified'}
Dietary: ${diet || 'none'} · Accessibility: ${access || 'none'}
Transport comfort: ${transport || 'transit mostly'}

Constraints: Keep totals under budget and provide sensible daily pacing for a family with kids if specified.`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.6,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    let md = completion.choices?.[0]?.message?.content || '# Trip Plan';

    // Append Booking Shortcuts
    md += `

---

**Booking Shortcuts**  
[Flights](${aff.flights}) · [Hotels](${aff.hotels}) · [Activities](${aff.activities}) · [Cars](${aff.cars}) · [Insurance](${aff.insurance})
`;

    db.prepare(`INSERT INTO plans
      (id, created_at, destination, start_date, end_date, budget, travelers, level, prefs, full_markdown, affiliate_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        id, new Date().toISOString(), destination, start, end,
        Number(budget), Number(travelers), level, prefs || null, md, JSON.stringify(aff)
      );

    res.json({ id, markdown: md, affiliates: aff });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

/* ---------- Get plan ---------- */
app.get('/api/plan/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: row.id,
    destination: row.destination,
    start: row.start_date,
    end: row.end_date,
    budget: row.budget,
    travelers: row.travelers,
    level: row.level,
    prefs: row.prefs,
    teaser_html: row.teaser_html,
    markdown: row.full_markdown,
    affiliates: JSON.parse(row.affiliate_json || '{}')
  });
});

/* ---------- Extract map points from markdown ---------- */
app.get('/api/plan/:id/points', (req, res) => {
  const row = db.prepare('SELECT destination, full_markdown FROM plans WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const md = row.full_markdown || '';
  const regex = /https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=([^)\s]+)/g;
  const seen = new Set();
  const points = [];
  let m;
  while ((m = regex.exec(md)) && points.length < 40) {
    const q = decodeURIComponent(m[1]).replace(/\+/g, ' ');
    const key = q.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    points.push({ name: q, query: q });
  }
  res.json({ destination: row.destination, points });
});

/* ---------- PDF ---------- */
app.get('/api/plan/:id/pdf', (req, res) => {
  const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="trip_${row.id}.pdf"`);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);
  doc.fontSize(20).text(`Wayzo – ${row.destination}`);
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#666')
    .text(`Dates: ${row.start_date} to ${row.end_date} · Travelers: ${row.travelers} · Style: ${row.level}`);
  doc.moveDown();
  doc.fillColor('#000').fontSize(12).text('Plan (Markdown):');
  doc.moveDown(0.5);
  doc.fontSize(10).text(row.full_markdown || 'No full plan available yet.');
  doc.end();
});

/* Start */
app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log('Serving frontend from:', frontendDir);
  console.log('Root file:', indexFile);
});
