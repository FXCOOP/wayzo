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
import { load as cheerioLoad } from 'cheerio';
import OpenAI from 'openai';

// ---------- paths ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const DOCS_DIR = path.join(ROOT, 'docs');

let INDEX_FILE = path.join(FRONTEND_DIR, 'index.backend.html');
if (!fs.existsSync(INDEX_FILE)) {
  const alt = path.join(FRONTEND_DIR, 'index.html');
  if (fs.existsSync(alt)) INDEX_FILE = alt;
}

// ---------- app ----------
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

// static
app.use('/docs', express.static(DOCS_DIR));
app.use(express.static(FRONTEND_DIR));

// health
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// ---------- db ----------
const db = new Database(path.join(ROOT, 'wayzo.sqlite'));
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

/* ---------- OpenAI (optional) ---------- */
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const MODEL = process.env.WAYZO_MODEL || 'gpt-4o-mini';

/* ---------- helpers ---------- */
const toISO = (s) => (s ? new Date(s).toISOString().slice(0, 10) : '');
const daysBetween = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000));
const seasonOf = (date, lat = 0) => {
  const m = new Date(date).getUTCMonth();
  const north = lat >= 0;
  const seasons = north
    ? ['Winter','Winter','Spring','Spring','Spring','Summer','Summer','Summer','Fall','Fall','Fall','Winter']
    : ['Summer','Summer','Fall','Fall','Fall','Winter','Winter','Winter','Spring','Spring','Spring','Summer'];
  return seasons[m] || '—';
};

function mapsLink(place, city) {
  const q = encodeURIComponent(`${place} ${city}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
function affiliateLink(place, kind, city) {
  const q = encodeURIComponent(`${place} ${city}`.trim());
  if (kind === 'stay')        return `https://www.booking.com/searchresults.html?ss=${q}`;
  if (kind === 'food')        return `https://www.tripadvisor.com/Search?q=${q}`;
  /* default/activity */       return `https://www.getyourguide.com/s/?q=${q}`;
}

const HOTEL_RX = /(hotel|hostel|inn|suites?|aparthotel|guesthouse|bnb|lodg)/i;
const FOOD_RX  = /(restaurant|bistro|cafe|café|bar|pizzeria|brasserie|trattoria|tapas|eatery)/i;

function ensureNewTabTargets($) {
  $('a').each((_, a) => {
    const el = $(a);
    el.attr('target', '_blank');
    el.attr('rel', 'noopener');
  });
}

function enrichHtml(html, destination) {
  const $ = cheerioLoad(html || '');

  $('li').each((_, li) => {
    const item = $(li);
    const text = item.text().toLowerCase();

    let kind = 'activity';
    const prevHdr = item.prevAll('h2,h3').first().text().toLowerCase();
    if (prevHdr.includes('stay') || prevHdr.includes('lodging') || prevHdr.includes('accom')) kind = 'stay';
    if (prevHdr.includes('dining') || prevHdr.includes('food')) kind = 'food';
    if (HOTEL_RX.test(text)) kind = 'stay';
    else if (FOOD_RX.test(text)) kind = 'food';

    let place = item.find('strong').first().text().trim();
    if (!place) {
      const raw = item.text();
      const m = raw.match(/^([^—\-:]{3,})[—\-:]/);
      if (m) place = m[1].trim();
    }
    if (!place) return;

    const hasMaps = item.find('a').filter((_, a) => $(a).text().toLowerCase().includes('open in maps')).length > 0;
    if (!hasMaps) {
      const a = $('<a/>', { href: mapsLink(place, destination), text: 'Open in Maps', target: '_blank', rel: 'noopener' });
      item.append(' ').append(a);
    }
    const hasAff = item.find('a').filter((_, a) => {
      const t = $(a).text().toLowerCase();
      return t.includes('book') || t.includes('tickets') || t.includes('reviews');
    }).length > 0;
    if (!hasAff) {
      const url = affiliateLink(place, kind, destination);
      const label = kind === 'stay' ? 'Book' : (kind === 'food' ? 'Reviews' : 'Tickets');
      const a = $('<a/>', { href: url, text: label, target: '_blank', rel: 'noopener' });
      item.append(' · ').append(a);
    }
  });

  ensureNewTabTargets($);
  return $.root().html();
}

/* ---------- offline full HTML (no API key needed) ---------- */
function fallbackHTML(p) {
  const {
    destination = 'Your destination',
    start = '',
    end = '',
    travelers = 2,
    level = 'mid-range',
    budget = 1500,
  } = p || {};
  const days = daysBetween(start, end);
  const season = seasonOf(start);
  const hero = `https://source.unsplash.com/1280x720/?${encodeURIComponent(destination)},skyline`;

  return `
<section id="cover">
  <h1>${destination} itinerary (${toISO(start)} – ${toISO(end)})</h1>
  <div class="chips">
    <span class="chip">${travelers} traveler${travelers>1?'s':''}</span>
    <span class="chip">${level}</span>
    <span class="chip">Budget: $${budget}</span>
    <span class="chip">${season}</span>
  </div>
  <figure><img loading="lazy" src="${hero}" alt="${destination} hero"></figure>
  <ul class="facts">
    <li>Weather: mild</li><li>Currency: local</li><li>Language: local</li>
    <li>Voltage: check</li><li>Tipping: varies</li>
  </ul>
</section>

<section id="summary">
  <p>Balanced ${days}-day plan in ${destination}: iconic highlights, neighborhood strolls, and easy transit. Base near the historic center for short walks; families often prefer quieter areas just outside the core.</p>
  <ul><li><strong>Don’t miss:</strong> Headliner museum at opening.</li><li><strong>Don’t miss:</strong> Sunset viewpoint on day one.</li></ul>
</section>

<section id="lodging">
  <h2>Where to stay</h2>
  <ul class="cards">
    <li><strong>Budget:</strong> City Hostel — central & social. <a href="${affiliateLink('City Hostel', 'stay', destination)}">Book</a> · <a href="${mapsLink('City Hostel', destination)}">Open in Maps</a></li>
    <li><strong>Mid:</strong> Riverside Hotel — walkable, good transit. <a href="${affiliateLink('Riverside Hotel', 'stay', destination)}">Book</a> · <a href="${mapsLink('Riverside Hotel', destination)}">Open in Maps</a></li>
    <li><strong>High:</strong> Grand Palace — spa & views. <a href="${affiliateLink('Grand Palace', 'stay', destination)}">Book</a> · <a href="${mapsLink('Grand Palace', destination)}">Open in Maps</a></li>
  </ul>
  <p class="muted">Tip: nightlife = central core; families = quieter ring neighborhoods.</p>
</section>

<section id="highlights">
  <h2>Highlights</h2>
  <ul>
    <li><strong>Main Cathedral</strong> — landmark architecture. Tip: arrive by 9:00. <a href="${mapsLink('Cathedral', destination)}">Open in Maps</a> · <a href="${affiliateLink('Cathedral', 'activity', destination)}">Tickets</a></li>
    <li><strong>Old Market</strong> — local snacks and crafts. Tip: best on weekday mornings. <a href="${mapsLink('Market', destination)}">Open in Maps</a> · <a href="${affiliateLink('Market', 'food', destination)}">Reviews</a></li>
    <li><strong>Riverside Walk</strong> — sunset views. Tip: pack light jacket. <a href="${mapsLink('Riverside', destination)}">Open in Maps</a> · <a href="${affiliateLink('Riverside', 'activity', destination)}">Tickets</a></li>
  </ul>
</section>

<section id="daily-plan">
  <h2>Day-by-day</h2>
  <article class="day">
    <h3>Day 1 — Historic core</h3>
    <p class="meta">Walk 30m · Transit 10m</p>
    <p><strong>Morning:</strong> Old Square — orientation stroll. <a href="${mapsLink('Old Square', destination)}">Open in Maps</a></p>
    <p><strong>Afternoon:</strong> Main Museum — timed entry. <a href="${affiliateLink('Main Museum', 'activity', destination)}">Tickets</a> · <a href="${mapsLink('Main Museum', destination)}">Open in Maps</a></p>
    <p><strong>Evening:</strong> City Viewpoint — golden hour. <a href="${mapsLink('City Viewpoint', destination)}">Open in Maps</a></p>
    <p><em>Meals:</em> Local Bistro (casual). <a href="${affiliateLink('Local Bistro', 'food', destination)}">Reviews</a> · <a href="${mapsLink('Local Bistro', destination)}">Open in Maps</a></p>
    <details class="alt"><summary>Rainy / with kids</summary><ul><li>Science Center — hands-on exhibits. <a href="${mapsLink('Science Center', destination)}">Open in Maps</a> · <a href="${affiliateLink('Science Center', 'activity', destination)}">Tickets</a></li></ul></details>
  </article>
</section>

<section id="transport">
  <h2>Getting around</h2>
  <ul>
    <li>Airport train ~25m · ~$12</li>
    <li>Day pass ~$8; tap to pay on buses/metro</li>
    <li>Rideshare at night for convenience</li>
  </ul>
</section>

<section id="budget">
  <h2>Budget</h2>
  <table>
    <tr><th>Item</th><th>Per day</th><th>Total (${travelers} ppl)</th></tr>
    <tr><td>Stay</td><td>$250</td><td>$${250*days}</td></tr>
    <tr><td>Food</td><td>$120</td><td>$${120*days}</td></tr>
    <tr><td>Activities</td><td>$60</td><td>$${60*days}</td></tr>
    <tr><td>Transit</td><td>$20</td><td>$${20*days}</td></tr>
  </table>
  <p class="muted">Assumes mid-range dining and 1–2 paid sights/day.</p>
  <p class="cta"><a href="https://www.booking.com/">Book hotels</a> · <a href="https://www.getyourguide.com/">Top activities</a></p>
</section>

<section id="food">
  <h2>Dining short-list</h2>
  <ul>
    <li><strong>Market Kitchen</strong> — local plates. <a href="${affiliateLink('Market Kitchen', 'food', destination)}">Reviews</a> · <a href="${mapsLink('Market Kitchen', destination)}">Open in Maps</a></li>
    <li><strong>Old Town Pizzeria</strong> — classic pies. <a href="${affiliateLink('Old Town Pizzeria', 'food', destination)}">Reviews</a> · <a href="${mapsLink('Old Town Pizzeria', destination)}">Open in Maps</a></li>
  </ul>
</section>

<section id="packing">
  <h2>Packing & etiquette</h2>
  <ul><li>Layers, comfy shoes; bring reusable bottle; basic tipping for table service.</li></ul>
</section>

<section id="checklist">
  <h2>Bookings checklist</h2>
  <ul>
    <li>Main Museum timed tickets — <a href="${affiliateLink('Main Museum', 'activity', destination)}">Tickets</a></li>
    <li>Airport train — <a href="https://www.getyourguide.com/">Book</a></li>
  </ul>
</section>

<footer id="footer"><p class="muted">Generated by Wayzo • ${nowIso()}</p></footer>
  `.trim();
}

function systemPrompt() {
  return `
You are a travel planner. Return **valid HTML only** (no <html> or <body>) using these section ids in this exact order:
cover, summary, lodging, highlights, daily-plan, transport, budget, food, packing, checklist, footer.

Rules:
- Concise, specific writing; realistic times. Each place: 1–2 sentences (reason + tip).
- End each place with two compact links: Open in Maps + an affiliate link:
  - Stays → "Book"
  - Activities → "Tickets"
  - Restaurants → "Reviews"
- All anchors must include target="_blank" and rel="noopener".
- Keep day pages short (~12 lines/day). Use chips, tables, and lists for clarity.
- Images optional: <img loading="lazy" src="https://source.unsplash.com/640x400/?{{destination}},{{place}}"> .
  `;
}

// ---------- preview ----------
app.post('/api/preview', async (req, res) => {
  const { destination = '' } = req.body || {};
  const teaser_html = `
<section id="preview">
  <h3>${destination || 'Your trip'} — preview</h3>
  <ul>
    <li>Neighborhood clustering to reduce transit</li>
    <li>Must-see highlights with timed tickets</li>
    <li>Meals & alternates per day</li>
  </ul>
  <p class="cta">Generate full plan →</p>
</section>`.trim();
  res.json({ teaser_html });
});

// ---------- plan (HTML-first) ----------
app.post('/api/plan', async (req, res) => {
  const payload = req.body || {};
  const id = uid();

  try {
    const meta = {
      destination: String(payload.destination || '').trim(),
      start: toISO(payload.start || payload.startDate),
      end: toISO(payload.end || payload.endDate),
      travelers: Number(payload.travelers || 2),
      level: String(payload.level || 'mid-range'),
      budget: Number(payload.budget || 1500),
      prefs: String(payload.prefs || payload.interests || ''),
    };

    let html;

    if (openaiEnabled) {
      const user = `
Destination: ${meta.destination}
Dates: ${meta.start} → ${meta.end}
Travelers: ${meta.travelers}
Style: ${meta.level}
Budget per trip (USD): ${meta.budget}
Preferences: ${meta.prefs || '-'}

Produce the full report in the strict order and format specified.`;
      const resp = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.6,
        messages: [
          { role: 'system', content: systemPrompt() },
          { role: 'user', content: user },
        ],
      });
      html = resp.choices?.[0]?.message?.content?.trim();
    }

    if (!html) html = fallbackHTML(meta);

    const enriched = enrichHtml(html, meta.destination);

    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: meta, html: enriched }));
    res.json({ id, html: enriched, meta });
  } catch (e) {
    console.error('plan error', e);
    const html = fallbackHTML(req.body || {});
    const enriched = enrichHtml(html, (req.body && req.body.destination) || '');
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: req.body || {}, html: enriched }));
    res.json({ id, html: enriched, meta: req.body || {} });
  }
});

// ---------- “PDF” html view ----------
app.get('/api/plan/:id/pdf', (req, res) => {
  const row = getPlan.get(req.params.id);
  if (!row) return res.status(404).send('Not found');
  const saved = JSON.parse(row.payload || '{}');
  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Wayzo Plan</title>
  <link rel="stylesheet" href="/style.css" />
  <style>
    @media print {
      .card, .cards li, article.day { break-inside: avoid; }
      a { text-decoration: none; }
    }
  </style>
</head>
<body>
  ${saved.html || ''}
  <p class="muted" style="margin-top:24px">Generated by Wayzo</p>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ---------- catch-all ----------
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(INDEX_FILE);
});

app.listen(PORT, () => console.log(`Wayzo backend running on :${PORT}`));
