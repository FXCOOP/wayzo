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
import cheerio from 'cheerio';

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

// ---------- openai (optional) ----------
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const MODEL = process.env.WAYZO_MODEL || 'gpt-4o-mini';

// ---------- preview ----------
app.post('/api/preview', async (req, res) => {
  const { destination = '', start = '', end = '' } = req.body || {};
  const teaser_html = `
<section id="preview">
  <h3>${destination || 'Your trip'} — preview</h3>
  <ul>
    <li>Morning / Afternoon / Evening blocks for each day.</li>
    <li>Neighborhood clustering to reduce transit.</li>
    <li>Ticket + timing tips for the top sights.</li>
  </ul>
  <p class="cta">Generate full plan →</p>
</section>`.trim();
  res.json({ teaser_html });
});

// ---------- helpers ----------
function mapsLink(place, city) {
  const q = encodeURIComponent(`${place} ${city}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
function affiliateLink(place, kind, city) {
  const q = encodeURIComponent(`${place} ${city}`.trim());
  if (kind === 'stay')        return `https://www.booking.com/searchresults.html?ss=${q}`;
  if (kind === 'food')        return `https://www.tripadvisor.com/Search?q=${q}`;
  /* activity/default */       return `https://www.getyourguide.com/s/?q=${q}`;
}
const HOTEL_RX = /(hotel|hostel|inn|suites?|aparthotel|guesthouse|bnb|lodg)/i;
const FOOD_RX  = /(restaurant|bistro|cafe|café|bar|pizzeria|brasserie|trattoria|tapas|eatery)/i;

// make every link open in a new tab
function forceNewTabTargets($) {
  $('a').each((_, a) => {
    const el = $(a);
    el.attr('target', '_blank');
    el.attr('rel', 'noopener');
  });
}

// add “Book/Tickets/Reviews” affiliate link + ensure Open in Maps exists
function enrichHtmlWithAffiliates(html, destination) {
  const $ = cheerio.load(html);

  $('li').each((_, li) => {
    const item = $(li);
    const text = item.text().toLowerCase();

    // detect kind (section + keywords)
    let kind = 'activity';
    const prevHdr = item.prevAll('h2,h3').first().text().toLowerCase();
    if (prevHdr.includes('stay') || prevHdr.includes('accom')) kind = 'stay';
    if (prevHdr.includes('eat') || prevHdr.includes('food') || prevHdr.includes('restaurant')) kind = 'food';
    if (HOTEL_RX.test(text)) kind = 'stay';
    else if (FOOD_RX.test(text)) kind = 'food';

    // place name heuristic
    let place = item.find('strong').first().text().trim();
    if (!place) {
      // fallback: text before dash/—/:
      const raw = item.text();
      const m = raw.match(/^([^—\-:]{3,})[—\-:]/);
      if (m) place = m[1].trim();
    }
    if (!place) return; // nothing to enrich

    // ensure Maps link exists
    const hasMaps = item.find('a').filter((_, a) => $(a).text().toLowerCase().includes('open in maps')).length > 0;
    if (!hasMaps) {
      const a = $('<a/>', { href: mapsLink(place, destination), text: 'Open in Maps', target: '_blank', rel: 'noopener' });
      item.append(' ').append(a);
    }

    // add affiliate link (label based on kind)
    const hasBook = item.find('a').filter((_, a) => {
      const t = $(a).text().toLowerCase();
      return t.includes('book') || t.includes('tickets') || t.includes('reviews');
    }).length > 0;

    if (!hasBook) {
      const url = affiliateLink(place, kind, destination);
      const label = kind === 'stay' ? 'Book' : (kind === 'food' ? 'Reviews' : 'Tickets');
      const a = $('<a/>', { href: url, text: label, target: '_blank', rel: 'noopener' });
      item.append(' · ').append(a);
    }
  });

  // enforce target="_blank" on all links
  forceNewTabTargets($);
  return $.html();
}

// local fallback markdown (already includes sample Maps links)
function localPlanMarkdown(p) {
  const {
    destination = 'Your destination',
    start = 'start',
    end = 'end',
    budget = 1500,
    travelers = 2,
    level = 'budget',
    prefs = '',
  } = p || {};
  return `# ${destination} itinerary (${start} → ${end})

**Party:** ${travelers} • **Style:** ${level} • **Budget:** $${budget}

**Preferences:** ${prefs || '—'}

---

## Trip Summary
- Balanced mix of must-sees and local gems in ${destination}.
- Group sights by neighborhoods to minimize transit.

## Day 1
- **Historic Center** — classic landmarks and plazas. Tip: arrive before 9:30 to beat lines. [Open in Maps](${mapsLink('Historic Center', destination)})
- **Central Market** — street food and produce; great lunch stop. [Open in Maps](${mapsLink('Central Market', destination)})
- **Old Town** — evening stroll and dinner. [Open in Maps](${mapsLink('Old Town', destination)})

## Day 2
- **City Museum** — the headline collection; buy timed tickets. [Open in Maps](${mapsLink('City Museum', destination)})
- **River Walk** — 2km promenade; sunset views. [Open in Maps](${mapsLink('River Walk', destination)})
- **Food Hall** — many local vendors under one roof. [Open in Maps](${mapsLink('Food Hall', destination)})

---

## Rough Costs
- **Accommodation:** varies by style
- **Food:** $25–$45 pp/day
- **Activities:** $10–$25 / museum
- **Transit:** day passes best value
`;
}

// ---------- plan (markdown → html + enrichment) ----------
app.post('/api/plan', async (req, res) => {
  const payload = req.body || {};
  const id = uid();

  try {
    let markdown = localPlanMarkdown(payload);

    if (openaiEnabled) {
      const sys = `You produce concise, realistic travel itineraries.
Output strictly in **Markdown** (no HTML). Use headings and bullet lists.
For each recommendation (sight, restaurant, or hotel), write 1–2 sentences:
- Sentence 1: why it’s great (specific).
- Sentence 2: a quick tip (best time, reservation, transit, ticket).
Append a Google Maps link using:
[Open in Maps](https://www.google.com/maps/search/?api=1&query=<PLACE%20NAME%20CITY>)
Keep names accurate and include neighborhood/city when helpful.`;
      const usr = `Destination: ${payload.destination}
Dates: ${payload.start || payload.startDate} → ${payload.end || payload.endDate}
Travelers: ${payload.travelers}
Style: ${payload.level}
Budget(USD): ${payload.budget}
Prefs: ${payload.prefs || payload.interests || '-'}

Return *Markdown only*. Ensure most bullets look like:
- **Place Name** — short reason. Tip: short actionable tip. [Open in Maps](...)`;

      const resp = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.6,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: usr },
        ],
      });
      const out = resp.choices?.[0]?.message?.content?.trim();
      if (out) markdown = out;
    }

    // Convert to HTML and enrich with affiliate links + target="_blank"
    const baseHtml = marked.parse(markdown || '');
    const html = enrichHtmlWithAffiliates(baseHtml, payload.destination || '');

    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown, html }));
    res.json({ id, markdown, html });
  } catch (e) {
    console.error('plan error', e);
    const markdown = localPlanMarkdown(payload);
    const baseHtml = marked.parse(markdown || '');
    const html = enrichHtmlWithAffiliates(baseHtml, payload.destination || '');
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown, html }));
    res.json({ id, markdown, html });
  }
});

// ---------- “PDF” html view (opens links in new tab) ----------
app.get('/api/plan/:id/pdf', (req, res) => {
  const row = getPlan.get(req.params.id);
  if (!row) return res.status(404).send('Not found');

  const saved = JSON.parse(row.payload || '{}');
  // Ensure anchors have target/rel even if saved.html didn't
  const enriched = enrichHtmlWithAffiliates(saved.html || marked.parse(saved.markdown || ''), (saved.data && saved.data.destination) || '');

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Wayzo Plan</title>
  <style>
    body{font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:24px;color:#0f172a}
    h1,h2,h3{margin:.8rem 0 .4rem}
    ul{margin:.3rem 0 .6rem 1.2rem}
    .muted{color:#64748b}
    a{color:#2563eb;text-decoration:none}
    figure{margin:.6rem 0}
    img{max-width:100%;height:auto;border-radius:8px}
    table{border-collapse:collapse;width:100%}
    td,th{border:1px solid #e5e7eb;padding:8px;text-align:left}
  </style>
</head>
<body>
  ${enriched || '<p>No content.</p>'}
  <p class="muted">Generated by Wayzo</p>
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
