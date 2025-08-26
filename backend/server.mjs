/* eslint-disable no-console */
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
import multer from 'multer';
import { normalizeBudget, computeBudget } from './lib/budget.mjs';
import { ensureDaySections } from './lib/expand-days.mjs';
import { affiliatesFor, linkifyTokens } from './lib/links.mjs';
import { buildIcs } from './lib/ics.mjs';
const VERSION = 'staging-v28'; // Updated version
// Load .env locally only; on Render we rely on real env vars.
if (process.env.NODE_ENV !== 'production') {
  try {
    const { config } = await import('dotenv');
    config();
  } catch (e) {
    console.error('Failed to load .env:', e);
  }
}
/* Paths */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const FRONTEND = path.join(__dirname, '..', 'frontend');
const DOCS = path.join(__dirname, '..', 'docs');
const UPLOADS = path.join(ROOT, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });
let INDEX = path.join(FRONTEND, 'index.backend.html');
/* App */
const app = express();
const PORT = Number(process.env.PORT || 10000);
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
app.use(compression());
app.use(morgan('combined')); // Detailed logging
const ORIGIN = process.env.ORIGIN || '';
if (ORIGIN) {
  app.use(cors({ origin: ORIGIN, credentials: true }));
} else {
  app.use(cors());
}
app.use(rateLimit({ windowMs: 60_000, limit: 200 }));
app.use(express.json({ limit: '5mb' }));
/* Static Serving with Proper Headers */
app.use('/frontend', express.static(FRONTEND, {
  setHeaders: (res, filePath) => {
    console.log('Serving static file:', filePath);
    if (!fs.existsSync(filePath)) console.error('Static file not found:', filePath);
    if (filePath.includes('hero-bg.jpg') || filePath.includes('hero-card.jpg')) {
      console.log('Serving image:', filePath, 'Size:', fs.statSync(filePath).size);
    }
    if (/\.(css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (/\.(svg|png|jpg|jpeg|webp|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    if (/\.css$/i.test(filePath)) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    if (/\.js$/i.test(filePath)) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  }
}));
app.use('/docs', express.static(DOCS, {
  setHeaders: (res, filePath) => {
    if (/\.(svg|png|jpg|jpeg|webp|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));
app.use('/uploads', express.static(UPLOADS, { setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=1209600') }));
/* Root / Health */
app.get('/', (_req, res) => {
  res.setHeader('X-Wayzo-Version', VERSION);
  if (!fs.existsSync(INDEX)) {
    console.error('Index file missing:', INDEX);
    return res.status(500).send('Index file missing. Check server logs.');
  }
  console.log('Serving index:', INDEX);
  res.sendFile(INDEX);
});
/* Serve Pro page explicitly */
app.get('/pro.html', (_req, res) => {
  const proPath = path.join(FRONTEND, 'pro.html');
  if (!fs.existsSync(proPath)) {
    console.error('Pro file missing:', proPath);
    return res.status(404).send('Pro page not found.');
  }
  res.sendFile(proPath);
});
app.get('/healthz', (_req, res) => res.json({ ok: true, version: VERSION }));
app.get('/version', (_req, res) => res.json({ version: VERSION }));
/* Uploads */
const multerUpload = multer({ dest: UPLOADS, limits: { fileSize: 10 * 1024 * 1024, files: 10 } });
app.post('/api/upload', multerUpload.array('files', 10), (req, res) => {
  console.log('Upload request received:', req.files);
  const files = (req.files || []).map(f => ({
    name: f.originalname, size: f.size, url: `/uploads/${path.basename(f.path)}`, mime: f.mimetype
  }));
  res.json({ files });
});
/* DB */
const DB_PATH = process.env.DB_PATH
  ? (path.isAbsolute(process.env.DB_PATH) ? process.env.DB_PATH : path.join(ROOT, process.env.DB_PATH))
  : path.join(ROOT, 'tripmaster.sqlite');
const db = new Database(DB_PATH);
db.exec(`CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, payload TEXT NOT NULL);`);
const savePlan = db.prepare('INSERT OR REPLACE INTO plans (id, created_at, payload) VALUES (?, ?, ?)');
const getPlan = db.prepare('SELECT payload FROM plans WHERE id = ?');
const nowIso = () => new Date().toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
/* Helpers */
const daysBetween = (a, b) => { if (!a || !b) return 5; const s = new Date(a), e = new Date(b); if (isNaN(s) || isNaN(e)) return 5; return Math.max(1, Math.round((e - s) / 86400000) + 1); };
const seasonFromDate = (iso = "") => ([12, 1, 2].includes(new Date(iso).getMonth() + 1) ? "Winter" : [3, 4, 5].includes(new Date(iso).getMonth() + 1) ? "Spring" : [6, 7, 8].includes(new Date(iso).getMonth() + 1) ? "Summer" : "Autumn");
const travelerLabel = (ad = 2, ch = 0) => ch > 0 ? `Family (${ad} adult${ad === 1 ? "" : "s"} + ${ch} kid${ch === 1 ? "" : "s"})` : (ad === 2 ? "Couple" : ad === 1 ? "Solo" : `${ad} adult${ad === 1 ? "" : "s"}`);
const perPersonPerDay = (t = 0, d = 1, tr = 1) => Math.round((Number(t) || 0) / Math.max(1, d) / Math.max(1, tr));
/* Local Fallback Plan */
function localPlanMarkdown(input) {
  const { destination = 'Santorini', start = '2025-09-03', end = '2025-09-06', budget = 2500, adults = 2, children = 0, level = 'mid', prefs = '', diet = 'vegetarian, gluten-free', specialRequests = 'wheelchair-accessible, pet-friendly', currency = 'USD' } = input || {};
  const nDays = daysBetween(start, end);
  const b = computeBudget(budget, nDays, level, Math.max(1, adults + children));
  const style = level === "luxury" ? "Luxury" : level === "budget" ? "Budget" : "Mid-range";
  const pppd = perPersonPerDay(budget, nDays, Math.max(1, adults + children));
  return linkifyTokens(`
# ${destination} Dream Getaway
## Trip Overview
- **Travelers:** ${travelerLabel(adults, children)}
- **Dates:** ${start} to ${end} (${nDays} nights)
- **Destination:** ${destination}, Greece
- **Budget:** ${budget} ${currency} (${pppd}/day/person)
- **Style:** ${style}${prefs ? ` · ${prefs}` : ""}
- **Dietary Needs:** ${diet || 'None'}
- **Special Requests:** ${specialRequests || 'None'}
- **Weather:** Warm (25-30°C) in September 2025, expect crowds, bring sun protection.

## Accommodation Details
- **Hotel:** Katikies Hotel, Oia (4-star, 9.5/10 on Booking.com, wheelchair-accessible, pet-friendly)
- **Cost:** ~$${b.stay.total} for ${nDays} nights
- **Features:** Caldera views, infinity pool, gourmet vegetarian/gluten-free dining

## Day-by-Day Itinerary
### Day 1 — Arrival & Relaxation (${start})
- **Morning:** Arrive at Santorini Airport, transfer via accessible taxi (~$40). [Map](map:Santorini airport to Katikies Hotel)
- **Afternoon:** Check-in, relax by the pool. [Reviews](reviews:Katikies Hotel)
- **Evening:** Dinner at Pelekanos (vegetarian/gluten-free, ~$50). [Book](book:Pelekanos Santorini)

### Day 2 — Explore Fira (${addDays(start, 1)})
- **Morning:** Breakfast at hotel, taxi to Fira (~$20). Visit Archaeological Museum (~$12). [Tickets](tickets:Archaeological Museum Thera)
- **Afternoon:** Lunch at Naoussa Restaurant (vegetarian/gluten-free, ~$50). [Reviews](reviews:Naoussa Restaurant)
- **Evening:** Sunset dinner at Cacio e Pepe (~$100). [Book](book:Cacio e Pepe Santorini)

### Day 3 — Winery & Culture (${addDays(start, 2)})
- **Morning:** Private wine tasting at Santo Wines (~$80). [Tickets](tickets:Santo Wines)
- **Afternoon:** Lunch at The Athenian House (~$60). [Map](map:The Athenian House Santorini)
- **Evening:** Sunset cruise (~$250). [Book](book:Santorini sunset cruise)

### Day 4 — Beach & Departure (${addDays(start, 3)})
- **Morning:** Relax at Perissa Beach (~$30). [Map](map:Perissa Beach)
- **Afternoon:** Lunch at Taverna Katina (~$50). [Reviews](reviews:Taverna Katina)
- **Evening:** Farewell dinner at Sunset Ammoudi (~$100), transfer to airport. [Book](book:Sunset Ammoudi)

## Budget Breakdown
| Category         | Cost (${currency}) | Notes                  |
|------------------|-------------------|-------------------------|
| Accommodation    | ${b.stay.total}   | ${nDays} nights at Katikies |
| Food             | ${b.food.total}   | Vegetarian/gluten-free  |
| Activities       | ${b.act.total}    | Tours, museum, beach    |
| Transportation   | ${b.transit.total}| Accessible taxis       |
| Total            | ${budget}         | Within budget           |

## Safety & Accessibility Notes
- **Access:** All sites wheelchair-accessible with ramps. [Map](map:Santorini accessible routes)
- **Safety:** Travel insurance recommended, emergency: 112
- **Diet:** Restaurants confirmed for vegetarian/gluten-free
- **Packing:** Sunscreen, hats, pet supplies

## Final Recommendations
- **Hidden Gem:** Visit Vlychada Beach for seclusion.
- **Pro Tip:** Book sunset spots early.
- **Upgrade:** Add a private tour for $100! [Upgrade](https://wayzo-affiliate.com)
`.trim(), destination);
}
// Helper to add days to date string
function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
/* OpenAI (optional) */
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
async function generatePlanWithAI(payload) {
  const { destination = 'Santorini', start = '2025-09-03', end = '2025-09-06', budget = 2500, currency = 'USD', adults = 2, children = 0, level = 'mid', prefs = '', diet = '', specialRequests = '' } = payload || {};
  const nDays = daysBetween(start, end) || 5;
  const sys = `You are Clever AI Trip Planner, an advanced AI tool specializing in creating personalized, professional travel itineraries worth $20 for depth, customization, and practicality. Structure as a polished PDF-like report with sections: Title, Trip Overview, Accommodation Details, Day-by-Day Itinerary (with activities, meals, transportation, tips), Budget Breakdown (table), Safety & Accessibility Notes, Final Recommendations. Use markdown, tables, bullet points, bold headers.

Inputs: Destination: ${destination}, Dates: ${start} to ${end} (${nDays} days), Party: ${adults} adults${children ? `, ${children} children` : ""}, Style: ${level}${prefs ? ` + ${prefs}` : ""}, Budget: ${budget} ${currency}, Diet: ${diet}, Special Requests: ${specialRequests}.
Guidelines:
- Tailor to ${level} style: 3-4 star hotels, value-for-money.
- Incorporate prefs: Balance attractions, relax, romance.
- Diet: Only ${diet || 'any'} meals (e.g., vegetarian/gluten-free if specified).
- Special needs: Prioritize ${specialRequests || 'none'} (e.g., wheelchair-accessible, pet-friendly).
- Assume 5-day trip if dates suggest it (adjust typos to 5 nights).
- Use real data: TripAdvisor, Booking.com, cite inline (e.g., ratings).
- Budget: Keep under ${budget} USD, 2025 rates (hotels $200-400/night, meals $50-100/day for two, activities $100-200/day).
- Romance: Include sunsets, private tours for couples.
- Weather: For ${destination} in ${start.split('-')[1]}/${start.split('-')[0]}, note conditions (e.g., 25-30°C for Santorini Aug), suggest sun protection.
- Tips: Accessible transport, packing, emergencies.
- Enhance: Hidden gems, pro tips, upsell.
- Length: 1500-2500 words, never exceed budget.
Return Markdown ONLY.`;
  const user = `Generate the report based on the above inputs and guidelines.`;
  if (!client) {
    console.warn('OpenAI API key not set, using local fallback');
    let md = localPlanMarkdown(payload);
    md = ensureDaySections(md, nDays, start);
    return md;
  }
  try {
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.6,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
    });
    let md = resp.choices?.[0]?.message?.content?.trim() || "";
    if (!md) {
      console.warn('OpenAI response empty, using fallback');
      md = localPlanMarkdown(payload);
    }
    md = linkifyTokens(md, destination);
    md = ensureDaySections(md, nDays, start);
    return md;
  } catch (e) {
    console.error('OpenAI API error:', e);
    return localPlanMarkdown(payload); // Fallback
  }
}
/* API */
app.post('/api/preview', (req, res) => {
  console.log('Preview request received:', req.body);
  const payload = req.body || {};
  payload.budget = normalizeBudget(payload.budget, payload.currency);
  const id = uid();
  const aff = affiliatesFor(payload.destination || '');
  const teaser_html = `
<div>
  <h3 class="h3">${payload.destination || 'Your destination'} — preview</h3>
  <ul>
    <li>Neighborhood clustering to minimize transit</li>
    <li>Tickets/Bookings with direct links</li>
    <li>Click <b>Generate full plan (AI)</b> for complete schedule</li>
  </ul>
  ${aff.length > 0 ? `<div>Affiliate Deals: ${aff.map(a => `<a href="${a.url}">${a.name}</a>`).join(', ')}</div>` : ''}
</div>`;
  res.json({ id, teaser_html, affiliates: aff, version: VERSION });
});
app.post('/api/plan', async (req, res) => {
  console.log('Plan request received:', req.body);
  try {
    const payload = req.body || {};
    payload.budget = normalizeBudget(payload.budget, payload.currency);
    const id = uid();
    const markdown = await generatePlanWithAI(payload);
    let html = marked.parse(markdown);
    const aff = affiliatesFor(payload.destination);
    if (aff.length > 0) {
      html += `<div class="affiliates"><h3>Affiliate Recommendations</h3><ul>${aff.map(a => `<li><a href="${a.url}">${a.name}</a></li>`).join('')}</ul></div>`;
    }
    html += `<div class="promotion">Powered by ChatGPT API - Get personalized plans for just $20 with 24-hour revisions! <a href="https://platform.openai.com/api">Learn More</a></div>`;
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown }));
    res.json({ id, markdown, html, affiliates: aff, version: VERSION });
  } catch (e) {
    console.error('Plan generation error:', e);
    res.status(500).json({ error: 'Failed to generate plan. Check server logs.', version: VERSION });
  }
});
/* Get saved plan JSON */
app.get('/api/plan/:id', (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) return res.status(404).json({ error: 'Plan not found' });
  try {
    const saved = JSON.parse(row.payload || '{}');
    res.json(saved);
  } catch {
    res.status(500).json({ error: 'Corrupted plan data' });
  }
});
app.get('/api/plan/:id/pdf', (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) return res.status(404).json({ error: 'Plan not found' });
  const saved = JSON.parse(row.payload || '{}');
  const d = saved?.data || {};
  const md = saved?.markdown || '';
  let htmlBody = marked.parse(md);
  const aff = affiliatesFor(d.destination || '');
  if (aff.length > 0) {
    htmlBody += `<div class="affiliates"><h3>Affiliate Recommendations</h3><ul>${aff.map(a => `<li><a href="${a.url}">${a.name}</a></li>`).join('')}</ul></div>`;
  }
  htmlBody += `<div class="promotion">Powered by ChatGPT API - Get personalized plans for $20 with 24-hour revisions! <a href="https://platform.openai.com/api">Learn More</a></div>`;
  const style = d.level === "luxury" ? "Luxury" : d.level === "budget" ? "Budget" : "Mid-range";
  const season = seasonFromDate(d.start);
  const days = daysBetween(d.start, d.end);
  const pppd = perPersonPerDay(normalizeBudget(d.budget, d.currency), days, Math.max(1, (d.adults || 0) + (d.children || 0)));
  const traveler = travelerLabel(d.adults || 0, d.children || 0);
  const base = `${req.protocol}://${req.get('host')}`;
  const pdfUrl = `${base}/api/plan/${id}/pdf`;
  const icsUrl = `${base}/api/plan/${id}/ics`;
  const shareX = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`My ${d.destination} plan by Wayzo`)}&url=${encodeURIComponent(pdfUrl)}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Wayzo Trip Report</title>
<style>
  :root{--ink:#0f172a; --muted:#475569; --brand:#6366f1; --bg:#ffffff; --accent:#eef2ff; --border:#e2e8f0; --primary:#10b981; --secondary:#6366f1; --warning:#f59e0b;}
  body{font:16px/1.6 'Roboto', sans-serif;color:var(--ink);margin:30px;background:var(--bg);max-width:800px;margin:auto}
  header{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:20px;background:var(--accent);border-radius:10px;box-shadow:0 4px 15px rgba(0,0,0,0.1)}
  .logo{display:flex;gap:10px;align-items:center}
  .badge{width:30px;height:30px;border-radius:50%;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:700}
  .pill{background:var(--secondary);color:#fff;padding:0.3rem 0.8rem;border-radius:999px;font-size:12px}
  .summary{display:flex;gap:10px;flex-wrap:wrap;margin:15px 0;padding:15px;background:var(--bg);border:1px solid var(--border);border-radius:8px}
  .summary .chip{background:var(--accent);padding:0.3rem 0.6rem;border-radius:999px;font-size:12px}
  .actions{display:flex;gap:15px;margin:15px 0}
  .actions a{color:var(--secondary);text-decoration:none;font-weight:600;padding:0.5rem 1rem;border:1px solid var(--border);border-radius:8px;transition:all 0.3s}
  .actions a:hover{background:var(--accent);color:var(--ink)}
  .facts,.accommodation,.itinerary,.budget,.safety,.recommendations{padding:15px;background:var(--bg);border:1px solid var(--border);border-radius:8px;margin:15px 0}
  .facts h3,.accommodation h3,.itinerary h3,.budget h3,.safety h3,.recommendations h3{color:var(--primary);margin-bottom:10px}
  .facts ul{list-style:none;padding:0}
  .facts li:before{content:"🌍 ";color:var(--primary)}
  .itinerary ul{list-style:none;padding-left:20px}
  .itinerary li{margin:10px 0;padding-left:20px}
  .itinerary li:before{content:"✔ ";color:var(--primary);font-weight:bold}
  .budget table{width:100%;border-collapse:collapse}
  .budget th,.budget td{border:1px solid var(--border);padding:10px;text-align:left}
  .budget th{background:var(--accent);color:var(--ink)}
  a{color:var(--secondary);text-decoration:none}
  a:hover{text-decoration:underline}
  .affiliates{margin:20px 0;padding:15px;background:var(--accent);border-radius:10px;box-shadow:0 4px 10px rgba(0,0,0,0.1)}
  .affiliates h3{color:var(--warning);margin-bottom:10px}
  .affiliates ul{padding:0}
  .affiliates li:before{content:"⭐ ";color:var(--warning)}
  .promotion{margin:20px 0;padding:15px;background:var(--accent);border-radius:10px;color:var(--ink);text-align:center}
  .promotion a{color:var(--secondary);font-weight:600}
  footer{margin-top:30px;color:var(--muted);font-size:12px;text-align:center;border-top:1px solid var(--border);padding-top:10px}
</style>
</head><body>
<header>
  <div class="logo"><div class="badge">WZ</div><div><b>Wayzo</b><div class="tagline">Trips that plan themselves.</div></div></div>
  <span class="pill">${VERSION}</span>
</header>
<div class="summary">
  <span class="chip"><b>Travelers:</b> ${traveler}</span>
  <span class="chip"><b>Style:</b> ${style}${d.prefs ? ` · ${escapeHtml(d.prefs)}` : ""}</span>
  <span class="chip"><b>Budget:</b> ${normalizeBudget(d.budget, d.currency)} ${d.currency} (${pppd}/day/person)</span>
  <span class="chip"><b>Season:</b> ${season}</span>
</div>
<div class="actions">
  <a href="${pdfUrl}" target="_blank" rel="noopener">Download PDF</a>
  <a href="${shareX}" target="_blank" rel="noopener">Share on X</a>
  <a href="${base}/" target="_blank" rel="noopener">Edit Inputs</a>
  <a href="${icsUrl}" target="_blank" rel="noopener">Download Calendar</a>
</div>
<div class="facts"><h3>Quick Facts</h3>
  <ul>
    <li>🌡️ <b>Weather:</b> Typical seasonal conditions around ${season}.</li>
    <li>💱 <b>Currency:</b> ${d.currency}</li>
    <li>🗣️ <b>Language:</b> English (tourism friendly)</li>
    <li>🔌 <b>Voltage:</b> 230V, Type C/E plugs (adapter may be required)</li>
    <li>💁 <b>Tipping:</b> 5–10% in restaurants (optional)</li>
  </ul>
</div>
<div class="accommodation"><h3>Accommodation Details</h3>${d.accommodation || 'TBD based on plan generation'}</div>
<div class="itinerary">${htmlBody}</div>
<div class="budget"><h3>Budget Breakdown</h3><table><thead><tr><th>Category</th><th>Cost (${d.currency})</th><th>Notes</th></tr></thead><tbody><tr><td>Accommodation</td><td>${d.accommodationCost || b.stay.total}</td><td>${d.accommodationNotes || `${nDays} nights at a mid-range hotel`}</td></tr><tr><td>Food</td><td>${d.foodCost || b.food.total}</td><td>${d.foodNotes || 'Vegetarian/gluten-free meals'}</td></tr><tr><td>Activities</td><td>${d.activitiesCost || b.act.total}</td><td>${d.activitiesNotes || 'Tours and attractions'}</td></tr><tr><td>Transportation</td><td>${d.transportCost || b.transit.total}</td><td>${d.transportNotes || 'Accessible taxis'}</td></tr><tr><td>Total</td><td>${normalizeBudget(d.budget, d.currency)}</td><td>Within budget</td></tr></tbody></table></div>
<div class="safety"><h3>Safety & Accessibility Notes</h3><ul><li>Ensure ${specialRequests || 'general'} access (e.g., ramps for wheelchair).</li><li>Travel insurance recommended, emergency: 112</li><li>Diet: ${diet || 'any'} options confirmed.</li><li>Packing: Sunscreen, ${specialRequests.includes('pet-friendly') ? 'pet supplies' : 'comfortable shoes'}</li></ul></div>
${aff.length > 0 ? `<div class="affiliates"><h3>Affiliate Recommendations</h3><ul>${aff.map(a => `<li><a href="${a.url}">${a.name}</a></li>`).join('')}</ul></div>` : ''}
<div class="promotion">Powered by ChatGPT API - Get personalized plans for $20 with 24-hour revisions! <a href="https://platform.openai.com/api">Learn More</a></div>
<footer>Generated by Wayzo — ${VERSION}</footer>
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});
app.get('/api/plan/:id/ics', (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) return res.status(404).json({ error: 'Plan not found' });
  const saved = JSON.parse(row.payload || '{}');
  const md = saved.markdown || '';
  const dest = saved?.data?.destination || 'Trip';
  const events = [];
  const rx = /^\s*###\s*Day\s+(\d+)\s*(?:—\s*([^\n(]+))?\s*(?:\((\d{4}-\d{2}-\d{2})\))?/gmi;
  let m;
  while ((m = rx.exec(md))) {
    const title = (m[2] || `Day ${m[1]}`).trim();
    const date = m[3] || saved?.data?.start || null;
    if (date) events.push({ title, date, start: '09:00', end: '11:00' });
  }
  const ics = buildIcs(id, events, { destination: dest });
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="wayzo-${id}.ics"`);
  res.send(ics);
});
/* SPA Catch-All */
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.setHeader('X-Wayzo-Version', VERSION);
  if (!fs.existsSync(INDEX)) {
    console.error('Index file missing:', INDEX);
    return res.status(500).send('Index file missing. Check server logs.');
  }
  console.log('Serving index:', INDEX);
  res.sendFile(INDEX);
});
app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log('Version:', VERSION);
  console.log('Index file:', INDEX);
  console.log('Frontend path:', FRONTEND);
});
// Escape HTML helper
function escapeHtml(s = "") {
  return String(s).replace(/[&<>"]/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[m]));
}