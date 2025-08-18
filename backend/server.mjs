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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const FRONTEND_DIR = path.join(repoRoot, 'frontend');
const DOCS_DIR = path.join(repoRoot, 'docs');
let INDEX_FILE = path.join(FRONTEND_DIR, 'index.backend.html');
if (!fs.existsSync(INDEX_FILE)) {
  const alt = path.join(FRONTEND_DIR, 'index.html');
  if (fs.existsSync(alt)) INDEX_FILE = alt;
}

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

// db
const db = new Database(path.join(repoRoot, 'tripmaster.sqlite'));
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

// openai
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const MODEL = process.env.WAYZO_MODEL || 'gpt-4o-mini';

// helpers
function ensureNewTabTargets($) {
  $('a').each((_, a) => {
    const el = $(a);
    el.attr('target', '_blank');
    el.attr('rel', 'noopener');
  });
}

function mapsLink(place, city) {
  const q = encodeURIComponent(`${place} ${city}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
function affiliateLink(place, kind, city) {
  const q = encodeURIComponent(`${place} ${city}`.trim());
  if (kind === 'stay')        return `https://www.booking.com/searchresults.html?ss=${q}`;
  if (kind === 'food')        return `https://www.tripadvisor.com/Search?q=${q}`;
  return `https://www.getyourguide.com/s/?q=${q}`;
}

const HOTEL_RX = /(hotel|hostel|inn|suites?|aparthotel|guesthouse|bnb|lodg)/i;
const FOOD_RX  = /(restaurant|bistro|cafe|café|bar|pizzeria|brasserie|trattoria|tapas|eatery)/i;

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

function fallbackHTML() {
  return `<section id="preview"><p>Preview created.</p></section>`;
}

// preview
app.post('/api/preview', async (_req, res) => {
  const teaser_html = `<section id="preview"><p>Preview created.</p></section>`;
  res.json({ teaser_html });
});

// plan
app.post('/api/plan', async (req, res) => {
  const payload = req.body || {};
  const id = uid();

  try {
    const meta = {
      destination: String(payload.destination || '').trim(),
      start: String(payload.start || payload.startDate || ''),
      end: String(payload.end || payload.endDate || ''),
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

Return concise HTML sections for a 6–8 day plan.`;
      const resp = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.6,
        messages: [
          { role: 'system', content: 'You are a travel planner. Return HTML fragments only, no <html> wrapper.' },
          { role: 'user', content: user },
        ],
      });
      html = resp.choices?.[0]?.message?.content?.trim();
    }

    if (!html) html = fallbackHTML();

    const enriched = enrichHtml(html, payload.destination || '');

    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, html: enriched }));
    res.json({ id, html: enriched, meta: payload });
  } catch (e) {
    console.error('plan error', e);
    const html = fallbackHTML();
    const enriched = enrichHtml(html, payload.destination || '');
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, html: enriched }));
    res.json({ id, html: enriched, meta: payload });
  }
});

// pdf (HTML view)
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
</head>
<body>
  ${saved.html || ''}
  <p class="muted" style="margin-top:24px">Generated by Wayzo</p>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// catch-all
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(INDEX_FILE);
});

app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
});
