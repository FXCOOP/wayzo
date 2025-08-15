/* Wayzo – backend (serves index + API, CSP-safe) */
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

/* --- Config --- */
const PORT = process.env.PORT || 8080;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

/* --- App --- */
const app = express();
app.enable('trust proxy'); // good behind Render/NGINX

/* ---------- HEALTH FIRST (no middleware) ---------- */
app.get('/api/health', (_req, res) => res.status(200).json({ ok: true }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.head('/api/health', (_req, res) => res.sendStatus(200));
app.head('/healthz', (_req, res) => res.sendStatus(200));

/* ---------- Security & core middleware ---------- */
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'"],
      "img-src": ["'self'", "data:", "https:"],
      "font-src": ["'self'", "data:"],
      "connect-src": ["'self'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"],
      "frame-ancestors": ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors({ origin: true, credentials: true }));
const limiter = rateLimit({ windowMs: 60_000, max: 300 });
app.use((req, res, next) => {
  // never rate-limit health checks
  if (req.path === '/api/health' || req.path === '/healthz') return next();
  return limiter(req, res, next);
});
app.use(express.json({ limit: '1mb' }));

/* --- Paths --- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../frontend');
const indexFile = path.join(frontendDir, 'index.backend.html');

/* Root BEFORE static (and no-cache) */
app.get('/', (_req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(indexFile);
});

/* Static files (no index + no cache) */
app.use(express.static(frontendDir, {
  index: false, etag: false, lastModified: false, cacheControl: false, maxAge: 0
}));

/* Debug helper */
app.get('/__debug', (_req, res) => {
  res.json({
    frontendDir,
    serving: indexFile,
    exists: fs.existsSync(indexFile),
    files: fs.readdirSync(frontendDir)
  });
});

/* --- DB --- */
// Free tier: keep DB local in app dir unless DB_PATH provided
const defaultDb = path.resolve(__dirname, './wayzo.sqlite');
let dbPath = process.env.DB_PATH || defaultDb;

// Ensure directory exists; fall back to local if needed
try {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
} catch (e) {
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

/* --- Helpers --- */
const daysBetween = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86_400_000) + 1);

const affiliatesFor = (city) => {
  const q = encodeURIComponent(city);
  return {
    flights:   `https://www.kayak.com/flights/${q}?aff=${process.env.AFF_KAYAK_AFF || 'AFF'}`,
    hotels:    `https://www.booking.com/searchresults.html?ss=${q}&aid=${process.env.AFF_BOOKING_AID || 'AID'}`,
    activities:`https://www.getyourguide.com/s/?q=${q}&partner_id=${process.env.AFF_GYG_PARTNER || 'PID'}`,
    cars:      `https://www.rentalcars.com/SearchResults.do?destination=${q}&affiliateCode=${process.env.AFF_RENTALCARS_CODE || 'CODE'}`,
    insurance: `https://www.worldnomads.com/?aff=${process.env.AFF_WORLDNOMADS_AFF || 'AFF'}`,
    reviews:   `https://www.tripadvisor.com/Search?q=${q}`
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
    <div>
      <p><strong>${days}-day plan for ${destination}</strong> for <strong>${travelers}</strong> traveler(s) · <strong>${level}</strong> style.</p>
      <p>Estimated total: $${Math.round(budget)} (~$${Math.round(perPerson)} per person), ≈ $${Math.round(daily)}/day${prefs ? ` · Focus: ${prefs}` : ''}.</p>
      <p>Expect ${vibe}. Generate the full schedule, hotels, restaurants, maps, and a cost table when ready.</p>
    </div>
  `;
};

const validateBody = (req, res, next) => {
  const { destination, start, end, budget, travelers, level } = req.body || {};
  if (!destination || !start || !end || !budget || !travelers || !level) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  next();
};

/* --- API: Preview --- */
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

/* --- API: Full plan (OpenAI) --- */
app.post('/api/plan', validateBody, async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ error: 'OPENAI_API_KEY missing on server' });

    const { destination, start, end, budget, travelers, level, prefs } = req.body;
    const id = uuidv4();
    const aff = affiliatesFor(destination);

    const systemPrompt = `You are Wayzo, an expert travel planner. Create a detailed, realistic itinerary under budget with ${level} style. Include: Introduction; Day-by-Day (times, neighborhoods, must-sees); Dining; Transport tips; Cost breakdown (stay/food/attractions/transport); Safety & visa tips. Insert placeholders [FLIGHTS] [HOTELS] [ACTIVITIES] [CARS] [INSURANCE] where links should go. Use markdown tables when appropriate.`;

    const userPrompt = `Destination: ${destination}
Dates: ${start} to ${end} (${daysBetween(start,end)} days)
Travelers: ${travelers}
Budget total (USD): ${budget}
Style: ${level}
Preferences: ${prefs || 'not specified'}
Constraints: Keep totals under budget and provide sensible daily pacing.`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.6,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    let md = completion.choices?.[0]?.message?.content || '# Trip Plan';
    md = md
      .replaceAll('[FLIGHTS]',    aff.flights)
      .replaceAll('[HOTELS]',     aff.hotels)
      .replaceAll('[ACTIVITIES]', aff.activities)
      .replaceAll('[CARS]',       aff.cars)
      .replaceAll('[INSURANCE]',  aff.insurance);

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

/* --- API: Get plan --- */
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

/* --- API: PDF --- */
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

/* --- Start --- */
app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log('Serving frontend from:', frontendDir);
  console.log('Root file:', indexFile);
});
