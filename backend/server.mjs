/* eslint-disable no-console */
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { marked } from 'marked';
import OpenAI from 'openai';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import { normalizeBudget, computeBudget } from './lib/budget.mjs';
import { ensureDaySections } from './lib/expand-days.mjs';
import { affiliatesFor, linkifyTokens } from './lib/links.mjs';
import { buildIcs } from './lib/ics.mjs';
import { storePlan, getPlan, getAllPlans } from './lib/db.mjs';
import { injectWidgetsIntoSections, sanitizeAffiliateLinks, validateWidgets } from './lib/widget-config.mjs';
const VERSION = 'staging-v75';

// Initialize Pino logger
const logger = pino({ 
  level: 'info', 
  transport: { 
    target: 'pino-pretty', 
    options: { 
      destination: 'wayzo.log',
      colorize: false
    } 
  } 
});
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
const DOCS = path.join(ROOT, 'docs');
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
app.use(cors());
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
// Database is now handled by lib/db.mjs with proper error handling
const nowIso = () => new Date().toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
/* Helpers */
const daysBetween = (a, b) => { if (!a || !b) return 1; const s = new Date(a), e = new Date(b); if (isNaN(s) || isNaN(e)) return 1; return Math.max(1, Math.round((e - s) / 86400000) + 1); };
const seasonFromDate = (iso = "") => ([12, 1, 2].includes(new Date(iso).getMonth() + 1) ? "Winter" : [3, 4, 5].includes(new Date(iso).getMonth() + 1) ? "Spring" : [6, 7, 8].includes(new Date(iso).getMonth() + 1) ? "Summer" : "Autumn");
const travelerLabel = (ad = 2, ch = 0) => ch > 0 ? `Family (${ad} adult${ad === 1 ? "" : "s"} + ${ch} kid${ch === 1 ? "" : "s"})` : (ad === 2 ? "Couple" : ad === 1 ? "Solo" : `${ad} adult${ad === 1 ? "" : "s"}`);
const perPersonPerDay = (t = 0, d = 1, tr = 1) => Math.round((Number(t) || 0) / Math.max(1, d) / Math.max(1, tr));

// AI Content Validation
function validateSpecificContent(html) {
  // Check for generic content
  if (/Local Restaurant|Historic Site|City Center Hotel/i.test(html)) {
    throw new Error('Generic content detected; retrying...');
  }
  
  // Check for price disclaimer
  if (!/Check current prices/i.test(html)) {
    throw new Error('Missing price disclaimer');
  }
  
  // Validate widgets
  const widgetErrors = validateWidgets(html);
  if (widgetErrors.length > 0) {
    throw new Error(`Widget validation failed: ${widgetErrors.join(', ')}`);
  }
  
  return html;
}
/* Local Fallback Plan */
function localPlanMarkdown(input) {
  const { destination = 'Your destination', start = 'start', end = 'end', budget = 1500, adults = 2, children = 0, level = 'mid', prefs = '', diet = '', currency = 'USD $' } = input || {};
  const nDays = daysBetween(start, end);
  const b = computeBudget(budget, nDays, level, Math.max(1, adults + children));
  const style = level === "luxury" ? "Luxury" : level === "budget" ? "Budget" : "Mid-range";
  const pppd = perPersonPerDay(budget, nDays, Math.max(1, adults + children));
  return linkifyTokens(`
# ${destination} — ${start} → ${end}
![City hero](image:${destination} skyline)
**Travelers:** ${travelerLabel(adults, children)}
**Style:** ${style}${prefs ? ` · ${prefs}` : ""}
**Budget:** ${budget} ${currency} (${pppd}/day/person)
**Season:** ${seasonFromDate(start)}
---
## Quick Facts
- **Language:** English (tourism friendly)
- **Currency:** ${currency}
- **Voltage:** 230V, Type C/E plugs (adapter may be required)
- **Tipping:** 5–10% in restaurants (optional)
---
## Budget breakdown (rough)
- Stay: **${b.stay.total}** (~${b.stay.perDay}/day)
- Food: **${b.food.total}** (~${b.food.perDay}/person/day)
- Activities: **${b.act.total}** (~${b.act.perDay}/day)
- Transit: **${b.transit.total}** (~${b.transit.perDay}/day)
---
## Day-by-Day Plan
### Day 1 — Arrival & Relaxation (${start})
- **Morning:** Arrive and check-in. [Map](map:${destination} airport to hotel) — shortest route to the hotel.
- **Afternoon:** Pool or easy walk near hotel. [Reviews](reviews:${destination} family friendly cafe)
- **Evening:** Dinner close-by. [Book](book:${destination} dinner)
### Day 2 — Downtown Exploration
- **Morning:** Top lookout. [Tickets](tickets:${destination} tower) — pre-book to skip lines.
- **Afternoon:** Popular museum. [Tickets](tickets:${destination} museum)
- **Evening:** Waterfront stroll. [Map](map:${destination} waterfront)
### Day 3 — Nature & Parks
- **Morning:** Park or island ferry. [Tickets](tickets:${destination} ferry)
- **Afternoon:** Picnic + playgrounds. [Map](map:${destination} best picnic spots)
- **Evening:** Family dinner. [Reviews](reviews:${destination} gluten free dinner)
`.trim(), destination);
}
/* OpenAI (optional) */
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
async function generatePlanWithAI(payload) {
  const { destination = '', start = '', end = '', budget = 0, currency = 'USD $', adults = 2, children = 0, level = 'mid', prefs = '', diet = '' } = payload || {};
  const nDays = daysBetween(start, end);
  
  // Enhanced system prompt for specific content
  const sys = `You are Wayzo Planner Pro, the world's most meticulous travel planner.

GOALS
- Produce a realistic, day-by-day itinerary that fits dates, party, pace, style, and budget.
- Include clear booking shortcuts (flight/hotel/activity search URLs) and cost ranges.
- Structure outputs so Wayzo can render a web view, PDF, and a shareable map.

QUALITY RULES
- Pacing: ~3 anchor items/day (morning / afternoon / evening) + optional extras.
- Logistics: Group sights by neighborhood; minimize backtracking; prefer transit/walkability.
- Kids/family: Respect nap windows, early dinners, playground stops where relevant.
- Costs: Give ranges in local currency; note spikes (festivals/peak season). If unsure, say "verify on booking."
- Seasonality: Weather-aware; include Plan B indoor options for rain/heat/cold.
- Authenticity: 1–2 local experiences per day (food market, neighborhood stroll, viewpoint).
- Sustainability (when asked): trains/public transit, city cards, local vendors.

LINK RULES
- Use SEARCH URLs only (no made-up affiliate params):
  flights: https://www.kayak.com/flights?query={CITY}
  hotels:  https://www.booking.com/searchresults.html?ss={CITY}
  activities: https://www.getyourguide.com/s/?q={CITY}
- For each place, add a Google Maps search URL:
  https://www.google.com/maps/search/?api=1&query={ENCODED_NAME_AND_CITY}

MANDATORY REQUIREMENTS:
- Use ChatGPT API (gpt-4o-mini-2024-07-18) for accurate, specific places (e.g., Brandenburg Gate, Mustafa's Gemüse Kebap).
- Include addresses, hours, costs, disclaimers ("Check current prices").
- NEVER use generics like "Local Restaurant", "Historic Site", "City Center Hotel".
- Return Markdown ONLY with token links: [Map](map:query) [Tickets](tickets:query) [Book](book:query) [Reviews](reviews:query).`;

  const user = `Destination: ${destination}
Dates: ${start} to ${end} (${nDays} days)
Party: ${adults} adults${children ? `, ${children} children` : ""}
Style: ${level}${prefs ? ` + ${prefs}` : ""}
Budget: ${budget} ${currency}
Diet: ${diet}`;

  if (!client) {
    logger.warn('OpenAI API key not set, using local fallback');
    let md = localPlanMarkdown(payload);
    md = ensureDaySections(md, nDays, start);
    return md;
  }
  
  try {
    logger.info({ payload }, 'Generating AI plan');
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini-2024-07-18",
      temperature: 0.6,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
    });
    
    let md = resp.choices?.[0]?.message?.content?.trim() || "";
    if (!md) {
      logger.warn('OpenAI response empty, using fallback');
      md = localPlanMarkdown(payload);
    }
    
    md = linkifyTokens(md, destination);
    md = ensureDaySections(md, nDays, start);
    
    // Inject widgets into sections
    md = injectWidgetsIntoSections(md, destination);
    
    logger.debug({ markdown: md }, 'AI plan generated');
    return md;
  } catch (e) {
    logger.error({ err: e }, 'OpenAI API error');
    return localPlanMarkdown(payload); // Fallback
  }
}
/* API */
app.post('/api/preview', (req, res) => {
  logger.info({ payload: req.body }, 'Preview request received');
  const payload = req.body || {};
  payload.budget = normalizeBudget(payload.budget, payload.currency);
  const id = uid();
  const aff = affiliatesFor(payload.destination || '');
  const destination = String(payload.destination || 'Your destination');
  const start = String(payload.start || 'start');
  const end = String(payload.end || 'end');
  const level = String(payload.level || 'mid');
  const style = level === "luxury" ? "Luxury" : level === "budget" ? "Budget" : "Mid-range";
  const pppd = perPersonPerDay(payload.budget || 0, daysBetween(start, end), Math.max(1, (payload.adults || 0) + (payload.children || 0)));
  const traveler = travelerLabel(payload.adults || 0, payload.children || 0);
  const teaser_html = `
<div class="summary">
  <span class="chip"><b>Destination:</b> ${escapeHtml(destination)}</span>
  <span class="chip"><b>Dates:</b> ${escapeHtml(start)} → ${escapeHtml(end)}</span>
  <span class="chip"><b>Travelers:</b> ${escapeHtml(traveler)}</span>
  <span class="chip"><b>Style:</b> ${escapeHtml(style)}${payload.prefs ? ` · ${escapeHtml(payload.prefs)}` : ""}</span>
  <span class="chip"><b>Budget:</b> ${payload.budget} ${escapeHtml(payload.currency || '')} (${pppd}/day/person)</span>
</div>`;
  res.json({ id, teaser_html, affiliates: aff, version: VERSION });
});
app.post('/api/plan', async (req, res) => {
  logger.info({ payload: req.body }, 'Plan request received');
  try {
    const payload = req.body || {};
    payload.budget = normalizeBudget(payload.budget, payload.currency);
    
    const markdown = await generatePlanWithAI(payload);
    let html = marked.parse(markdown);
    
    // Sanitize affiliate links
    html = sanitizeAffiliateLinks(html);
    
    // Validate content
    html = validateSpecificContent(html);
    
    // Store plan in database
    const planId = storePlan(payload, html);
    
    const aff = affiliatesFor(payload.destination);
    logger.info({ planId, destination: payload.destination }, 'Plan generated and stored');
    
    res.json({ id: planId, markdown, html, affiliates: aff, version: VERSION });
  } catch (e) {
    logger.error({ err: e }, 'Plan generation error');
    res.status(500).json({ error: 'Failed to generate plan. Check server logs.', version: VERSION });
  }
});
app.get('/api/plan/:id/pdf', (req, res) => {
  const { id } = req.params;
  const plan = getPlan(id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  
  const payload = JSON.parse(plan.input || '{}');
  const html = plan.output || '';
  
  const d = payload;
  const style = d.level === "luxury" ? "Luxury" : d.level === "budget" ? "Budget" : "Mid-range";
  const season = seasonFromDate(d.start);
  const days = daysBetween(d.start, d.end);
  const pppd = perPersonPerDay(normalizeBudget(d.budget, d.currency), days, Math.max(1, (d.adults || 0) + (d.children || 0)));
  const traveler = travelerLabel(d.adults || 0, d.children || 0);
  const base = `${req.protocol}://${req.get('host')}`;
  const pdfUrl = `${base}/api/plan/${id}/pdf`;
  const icsUrl = `${base}/api/plan/${id}/ics`;
  const shareX = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`My ${d.destination} plan by Wayzo`)}&url=${encodeURIComponent(pdfUrl)}`;
  const htmlBody = html;
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Wayzo Trip Report</title>
<style>
  :root{--ink:#0f172a; --muted:#475569; --brand:#6366f1; --bg:#ffffff; --accent:#eef2ff; --border:#e2e8f0;}
  body{font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,Arial;color:var(--ink);margin:24px;background:var(--bg)}
  header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid var(--border);flex-wrap:wrap}
  .logo{display:flex;gap:10px;align-items:center}
  .badge{width:28px;height:28px;border-radius:8px;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:700}
  .pill{border:1px solid var(--border);background:var(--accent);padding:.25rem .6rem;border-radius:999px;font-size:12px}
  .summary{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px 0}
  .summary .chip{border:1px solid var(--border);background:#fff;border-radius:999px;padding:.25rem .6rem;font-size:12px}
  .actions{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 14px}
  .actions a{color:#0f172a;text-decoration:none;border-bottom:1px dotted rgba(2,6,23,.25)}
  .facts{background:#fff;border:1px solid var(--border);border-radius:12px;padding:10px;margin:8px 0}
  img{max-width:100%;height:auto;border-radius:10px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid var(--border);padding:.45rem .55rem;text-align:left}
  thead th{background:var(--accent)}
  footer{margin-top:24px;color:var(--muted);font-size:12px}
</style>
</head><body>
<header>
  <div class="logo">
    <div class="badge">WZ</div>
    <div><strong>Wayzo</strong> Trip Report</div>
  </div>
  <div class="pill">${VERSION}</div>
</header>
<div class="summary">
  <span class="chip"><b>Travelers:</b> ${traveler}</span>
  <span class="chip"><b>Style:</b> ${style}${d.prefs ? ` · ${escapeHtml(d.prefs)}` : ""}</span>
  <span class="chip"><b>Budget:</b> ${normalizeBudget(d.budget, d.currency)} ${d.currency} (${pppd}/day/person)</span>
  <span class="chip"><b>Season:</b> ${season}</span>
</div>
<div class="actions">
  <a href="${icsUrl}">📅 Download Calendar</a>
  <a href="${shareX}">🐦 Share on Twitter</a>
</div>
${htmlBody}
<footer>
  <p>Generated by <strong>Wayzo</strong> • <a href="https://wayzo-staging.onrender.com">wayzo-staging.onrender.com</a></p>
</footer>
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(fullHtml);
});
app.get('/api/plan/:id/ics', (req, res) => {
  const { id } = req.params;
  const plan = getPlan(id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  
  const payload = JSON.parse(plan.input || '{}');
  const html = plan.output || '';
  const dest = payload?.destination || 'Trip';
  const events = [];
  const rx = /^### Day (\d+)\s*(?:[—-]\s*(.+))?/gm;
  const startIso = payload?.start || null;
  const startDate = startIso ? new Date(startIso) : null;
  let m;
  while ((m = rx.exec(html))) {
    const dayNumber = Number(m[1] || 1);
    const title = (m[2] || `Day ${dayNumber}`).trim();
    let date = null;
    if (startDate && !isNaN(startDate)) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + Math.max(0, dayNumber - 1));
      date = d.toISOString().slice(0, 10);
    } else if (startIso) {
      date = String(startIso).slice(0, 10);
    }
    if (date) events.push({ title, date, start: '09:00', end: '11:00' });
  }
  const ics = buildIcs(id, events, { destination: dest });
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="wayzo-${id}.ics"`);
  res.send(ics);
});

/* Debug Routes - Must be before SPA catch-all */
app.use('/debug', (req, res, next) => next());

app.get('/debug/plan/:id', (req, res) => {
  const { id } = req.params;
  logger.info({ planId: id }, 'Debug plan request');
  const plan = getPlan(id);
  if (plan) {
    res.json({
      id: plan.id,
      input: JSON.parse(plan.input || '{}'),
      output: plan.output,
      timestamp: plan.timestamp
    });
  } else {
    res.status(404).json({ error: 'Plan not found' });
  }
});

app.get('/debug/plans', (req, res) => {
  logger.info('Debug plans list request');
  const plans = getAllPlans();
  res.json(plans.map(plan => ({
    id: plan.id,
    input: JSON.parse(plan.input || '{}'),
    timestamp: plan.timestamp
  })));
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
  logger.info({ port: PORT, version: VERSION }, 'Wayzo backend started');
  console.log(`Wayzo backend running on :${PORT}`);
  console.log('Version:', VERSION);
  console.log('Index file:', INDEX);
  console.log('Frontend path:', FRONTEND);
  console.log('Log file: wayzo.log');
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