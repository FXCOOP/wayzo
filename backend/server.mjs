/* server.mjs — Wayzo backend (Node 20)
 * - Serves frontend at site root (/)
 * - /api/preview  -> quick teaser (no OpenAI)
 * - /api/plan     -> full plan (uses OpenAI if OPENAI_API_KEY; otherwise offline generator)
 * - /api/plan/:id/pdf -> branded PDF
 * - /healthz + /api/health -> Render health checks
 * - Static: /style.css, /app.js, /favicon.svg directly at /
 */

import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import PDFDocument from 'pdfkit';

// Optional OpenAI (fallback generator if key missing)
let openai = null;
try {
  const { OpenAI } = await import('openai');
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch { /* optional */ }

const app  = express();
const PORT = process.env.PORT || 10000;

// ---- security & perf
app.set('trust proxy', 1);
app.use(compression());
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false, // keep simple for CDN images
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(express.json({ limit: '1mb' }));

// ---- basic rate limit
app.use(rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: (v) => v === true || v === 1 } // silence express-rate-limit warning
}));

// ---- tiny utils
const uuid = () => crypto.randomUUID();
const safe = (s) => String(s ?? '').trim();

function affiliateLinks(destination = '') {
  const q = encodeURIComponent(destination);
  return {
    flights    : `https://www.kayak.com/flights?aff=YOUR_AFF_ID&q=${q}`,
    hotels     : `https://www.booking.com/?aid=YOUR_AFF_ID&ss=${q}`,
    activities : `https://www.getyourguide.com/s/?partner_id=YOUR_PARTNER_ID&q=${q}`,
    cars       : `https://www.rentalcars.com/?affiliateCode=YOUR_AFF_ID&city=${q}`,
    insurance  : `https://www.worldnomads.com/?aff=YOUR_AFF_ID`,
    reviews    : `https://www.tripadvisor.com/Search?q=${q}`
  };
}

// ---- SQLite
const root = path.resolve(process.cwd());
const dbPath = path.join(root, 'tripmaster.sqlite');
const db = new Database(dbPath);
db.prepare(`CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  created INTEGER,
  destination TEXT,
  start TEXT,
  end TEXT,
  travelers INTEGER,
  budget INTEGER,
  level TEXT,
  prefs TEXT,
  markdown TEXT
)`).run();

// ---- PREVIEW (no OpenAI; fast teaser)
app.post('/api/preview', (req, res) => {
  try {
    const { destination, start, end, budget, travelers, level, prefs } = req.body || {};
    const id = uuid();

    const trip = {
      id,
      destination: safe(destination),
      start: safe(start),
      end: safe(end),
      budget: Number(budget || 0),
      travelers: Number(travelers || 1),
      level: safe(level || 'budget'),
      prefs: safe(prefs),
    };

    const teaser_html = `
      <div class="teaser">
        <h3>${trip.destination || 'Your destination'}</h3>
        <p><strong>${trip.start || 'Start'} – ${trip.end || 'End'}</strong> · ${trip.travelers} traveler(s) · <em>${trip.level}</em></p>
        <p>Budget: $${trip.budget.toLocaleString()}</p>
        <ul>
          <li>Top neighborhoods to start: Mitte, Kreuzberg, Prenzlauer Berg.</li>
          <li>Suggested focus: ${trip.prefs || 'mix of highlights & hidden gems'}.</li>
          <li>Transport: public transit + walking for central areas.</li>
        </ul>
      </div>
    `;

    const links = affiliateLinks(trip.destination);
    res.json({ id, teaser_html, affiliates: links, mapSearch: encodeURIComponent(trip.destination) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to build preview' });
  }
});

// ---- PLAN (OpenAI if available, else offline generator)
app.post('/api/plan', async (req, res) => {
  try {
    const { destination, start, end, budget, travelers, level, prefs } = req.body || {};
    const id = uuid();
    const trip = {
      id,
      destination: safe(destination),
      start: safe(start),
      end: safe(end),
      budget: Number(budget || 0),
      travelers: Number(travelers || 1),
      level: safe(level || 'budget'),
      prefs: safe(prefs),
    };

    let markdown = '';
    if (openai) {
      const prompt = `
You are a travel planner. Build a concise day-by-day itinerary in Markdown.
Destination: ${trip.destination}
Dates: ${trip.start} to ${trip.end}
Travelers: ${trip.travelers}
Budget total (USD): ${trip.budget}
Style: ${trip.level}
Preferences: ${trip.prefs}

Format:
# <City> Itinerary (<date range>)
Brief intro
---
## Day 1
- Morning: ...
- Afternoon: ...
- Evening: ...
(Repeat for each day)
---
## Costs (rough)
- Stay
- Food
- Transport
- Activities
---
## Tips
Short bullets.
`;
      const rsp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      });
      markdown = rsp.choices?.[0]?.message?.content?.trim() || '';
    }

    if (!markdown) {
      // Offline fallback
      markdown = `# ${trip.destination} Itinerary (${trip.start} – ${trip.end})
Welcome! This plan balances highlights and downtime for ${trip.travelers} traveler(s) on a **${trip.level}** style with a total budget of **$${trip.budget.toLocaleString()}**.

---
## Day 1
- Arrival and orientation. Explore the main square, grab a casual dinner near your hotel.

## Day 2
- Morning: Top museum. Afternoon: Historic quarter walk. Evening: Local street food.

## Day 3
- Day trip to a nearby landmark or park (budget-friendly transit).

## Day 4
- Markets + neighborhood stroll. Coffee stops, photo ops.

## Day 5
- Iconic viewpoints + riverside/green area.

## Day 6
- Free day for personal interests (museums, galleries, biking).

## Day 7
- Wrap up, souvenirs, farewell dinner.

---
## Costs (rough for all travelers)
- Stay: $${Math.round(trip.budget * 0.35)}
- Food: $${Math.round(trip.budget * 0.30)}
- Activities: $${Math.round(trip.budget * 0.20)}
- Transport: $${Math.round(trip.budget * 0.10)}
- Misc: $${Math.round(trip.budget * 0.05)}

---
## Tips
- Use public transport passes for savings.
- Book popular tickets online in advance.
- Pack layers and comfy shoes.
`;
    }

    db.prepare(`INSERT INTO plans (id, created, destination, start, end, travelers, budget, level, prefs, markdown)
      VALUES (@id, @created, @destination, @start, @end, @travelers, @budget, @level, @prefs, @markdown)`)
      .run({ ...trip, created: Date.now(), markdown });

    res.json({
      id,
      markdown,
      affiliates: affiliateLinks(trip.destination),
      mapSearch: encodeURIComponent(trip.destination)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// ---- PDF (simple, branded)
app.get('/api/plan/:id/pdf', (req, res) => {
  const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).send('Not found');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="wayzo-${row.destination.replace(/\s+/g,'-').toLowerCase()}.pdf"`);

  const doc = new PDFDocument({ margin: 40, info: { Title: `Wayzo – ${row.destination} plan` } });
  doc.pipe(res);

  doc.fontSize(20).text(`Wayzo – ${row.destination} Itinerary`, { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#555').text(`${row.start} – ${row.end} · ${row.travelers} traveler(s) · ${row.level} · budget $${row.budget.toLocaleString()}`);
  doc.moveDown(1);
  doc.fillColor('#000');

  const lines = String(row.markdown).split('\n');
  lines.forEach((ln) => {
    if (ln.startsWith('# ')) {
      doc.moveDown(0.6).fontSize(16).text(ln.replace(/^#\s+/, ''));
    } else if (ln.startsWith('## ')) {
      doc.moveDown(0.5).fontSize(13).text(ln.replace(/^##\s+/, ''), { underline: true });
    } else {
      doc.fontSize(10).text(ln);
    }
  });

  doc.moveDown(1.2);
  doc.fontSize(9).fillColor('#666').text('© Wayzo. Crafted for your adventure.', { align: 'center' });

  doc.end();
});

// ---- HEALTH
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.type('text/plain').send('ok'));

// ---- STATIC FRONTEND (serve at site root)
const frontendDir = path.join(root, 'frontend');
console.log('Static root:', frontendDir);
console.log('Index file:', path.join(frontendDir, 'index.backend.html'));

app.use(express.static(frontendDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    if (filePath.endsWith('.js'))  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    if (filePath.endsWith('.svg')) res.setHeader('Content-Type', 'image/svg+xml');
  }
}));

// Back-compat if any old links used:
app.use('/frontend', express.static(frontendDir));

app.get('/', (_req, res) =>
  res.sendFile(path.join(frontendDir, 'index.backend.html'))
);

app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log('Serving frontend from:', frontendDir);
});
