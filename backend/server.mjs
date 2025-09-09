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
import Database from 'better-sqlite3';
import { normalizeBudget, computeBudget } from './lib/budget.mjs';
import { ensureDaySections } from './lib/expand-days.mjs';
import { affiliatesFor, linkifyTokens } from './lib/links.mjs';
import { buildIcs } from './lib/ics.mjs';
const VERSION = 'staging-v26';
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
const db = new Database(path.join(ROOT, 'wayzo.sqlite'));
db.exec(`CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, payload TEXT NOT NULL);`);
const savePlan = db.prepare('INSERT OR REPLACE INTO plans (id, created_at, payload) VALUES (?, ?, ?)');
const getPlan = db.prepare('SELECT payload FROM plans WHERE id = ?');
const nowIso = () => new Date().toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
/* Helpers */
const daysBetween = (a, b) => { if (!a || !b) return 1; const s = new Date(a), e = new Date(b); if (isNaN(s) || isNaN(e)) return 1; return Math.max(1, Math.round((e - s) / 86400000) + 1); };
const seasonFromDate = (iso = "") => ([12, 1, 2].includes(new Date(iso).getMonth() + 1) ? "Winter" : [3, 4, 5].includes(new Date(iso).getMonth() + 1) ? "Spring" : [6, 7, 8].includes(new Date(iso).getMonth() + 1) ? "Summer" : "Autumn");
const travelerLabel = (ad = 2, ch = 0) => ch > 0 ? `Family (${ad} adult${ad === 1 ? "" : "s"} + ${ch} kid${ch === 1 ? "" : "s"})` : (ad === 2 ? "Couple" : ad === 1 ? "Solo" : `${ad} adult${ad === 1 ? "" : "s"}`);
const perPersonPerDay = (t = 0, d = 1, tr = 1) => Math.round((Number(t) || 0) / Math.max(1, d) / Math.max(1, tr));
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
  console.log('🚀 NEW AI INTEGRATION - Starting fresh approach');
  console.log('🎯 FUNCTION CALLED - This should appear in logs!');

  const { destination = '', start = '', end = '', budget = 0, adults = 2, children = 0, level = 'mid', prefs = '', dietary = [] } = payload || {};
  const nDays = daysBetween(start, end);

  // STEP 1: Check OpenAI client
  console.log('Step 1: OpenAI client check');
  console.log('- Client exists:', !!client);
  console.log('- API Key exists:', !!process.env.OPENAI_API_KEY);
  console.log('- API Key length:', process.env.OPENAI_API_KEY?.length || 0);

  if (!client) {
    console.log('❌ No OpenAI client - using local fallback');
    return localPlanMarkdown(payload);
  }

  // STEP 2: Simple API test
  console.log('Step 2: Testing API with simple call...');
  try {
    const testCall = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 20,
      messages: [{ role: "user", content: "Say 'TEST OK'" }],
    });

    const testResult = testCall.choices?.[0]?.message?.content?.trim() || "";
    console.log('✅ API test result:', testResult);

    if (!testResult.includes('TEST OK')) {
      throw new Error('API test failed');
    }
  } catch (testError) {
    console.error('❌ API test failed:', testError.message);
    console.log('Using local fallback');
    return localPlanMarkdown(payload);
  }

  // STEP 3: Generate actual plan
  console.log('Step 3: Generating AI plan for', destination);
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 6000,
      messages: [
        {
          role: "system",
          content: `You are Wayzo Planner Pro, the world's most meticulous travel planner. 

WAYZO OUTPUT CONTRACT ====================
CRITICAL IMAGE RULES (SYSTEM BREAKING - VIOLATION = SYSTEM CRASH):
- FORBIDDEN SECTIONS - NO IMAGES ALLOWED:
  * Trip Overview
  * Don't Forget List  
  * Travel Tips
  * Useful Apps
  * Emergency Info
- ALLOWED SECTIONS - EXACTLY 1 IMAGE PER SECTION AT END:
  * Getting Around - 1 image at end
  * Accommodation - 1 image at end
  * Must-See Attractions - 1 image at end
  * Daily Itineraries - 1 image at end (NOT per day)
  * Restaurants - 1 image at end
  * Budget Breakdown - 1 image at end
- IMAGE FORMAT - EXACT COPY ONLY (MUST BE DESTINATION-SCOPED):
  ![Destination — Section](image:Destination specific landmark|activity|food term)

ACCURACY RULES (SYSTEM BREAKING - VIOLATION = SYSTEM CRASH):
- All facts (prices, hours, closures, seasonal notes) must be current
- If you cannot verify current information, DO NOT recommend that place
- Use phrases like "Check current prices" or "Verify opening hours"
- Include disclaimers about price changes
- Prioritize places with verified current information

CONTENT QUALITY REQUIREMENTS (SYSTEM BREAKING - VIOLATION = SYSTEM CRASH):
- Create RICH, DETAILED, and PROFESSIONAL content that travelers can actually use
- Include specific restaurant names, attraction names, and exact times
- Provide detailed activity descriptions with insider tips
- Include realistic cost breakdowns with current market prices
- Make daily itineraries specific and actionable (NO generic "Open Exploration")
- Include transportation details, duration estimates, and booking information
- Add cultural insights, local customs, and practical advice
- Provide money-saving tips and seasonal considerations
- Include ALL required sections: Trip Overview, Budget Breakdown, Getting Around, Accommodation, Must-See Attractions, Dining Guide, Daily Itineraries, Don't Forget List, Travel Tips, Useful Apps, Emergency Info
- Each section must be COMPREHENSIVE with 8-15 detailed items
- Include specific addresses, phone numbers, and current operating hours
- Provide detailed descriptions of what makes each place special
- Include insider tips, local secrets, and hidden gems
- Add cultural context and historical background
- Include practical information like parking, accessibility, and family-friendly features

MANDATORY SECTIONS (ALL MUST BE INCLUDED):
1. 🎯 Trip Overview - Quick facts and highlights
2. 💰 Budget Breakdown - Detailed cost analysis with checkboxes
3. 🗺️ Getting Around - Transportation tips and maps
4. 🏨 Accommodation - 3-5 hotel options with booking links
5. 🎫 Must-See Attractions - 8-12 sights with tickets and maps
6. 🍽️ Dining Guide - 6-10 restaurants with reviews
7. 🎭 Daily Itineraries - Hour-by-hour plans per day
8. 🧳 Don't Forget List - 8-12 packing/reminders with checkboxes
9. 🛡️ Travel Tips - Local customs, safety, and practical advice
10. 📱 Useful Apps - Mobile apps for the destination
11. 🚨 Emergency Info - Important contacts and healthcare

OUTPUT FORMATTING REQUIREMENTS (SYSTEM BREAKING - VIOLATION = SYSTEM CRASH):
- Use EXACT Markdown section headers: ## 🎯 Trip Overview
- Use EXACT Markdown section headers: ## 💰 Budget Breakdown
- Use EXACT Markdown section headers: ## 🗺️ Getting Around
- Use EXACT Markdown section headers: ## 🏨 Accommodation
- Use EXACT Markdown section headers: ## 🎫 Must-See Attractions
- Use EXACT Markdown section headers: ## 🍽️ Dining Guide
- Use EXACT Markdown section headers: ## 🎭 Daily Itineraries
- Use EXACT Markdown section headers: ## 🧳 Don't Forget List
- Use EXACT Markdown section headers: ## 🛡️ Travel Tips
- Use EXACT Markdown section headers: ## 📱 Useful Apps
- Use EXACT Markdown section headers: ## 🚨 Emergency Info
- NEVER use HTML tags like <h2> in the output
- NEVER use basic text headers like "Quick Facts" or "Day-by-Day Plan"
- ALWAYS use proper Markdown ## headers for all section headers
- VIOLATION OF THESE FORMATTING RULES WILL CAUSE SYSTEM FAILURE

DESTINATION-SPECIFIC RESEARCH REQUIREMENTS (CRITICAL):
- You MUST research and provide SPECIFIC, REAL places for the destination
- NO generic placeholders like "Local Restaurant" or "Historic Old Town Walking Tour"
- Include REAL restaurant names, REAL attraction names, REAL hotel names
- Provide SPECIFIC addresses, phone numbers, and current operating hours
- Include REAL cultural insights, local customs, and practical advice specific to the destination
- Research REAL transportation options, costs, and practical tips for the destination
- Include REAL emergency numbers, hospitals, and contacts for the destination
- Provide REAL mobile apps that are actually useful for the destination
- Include REAL packing items relevant to the destination's climate and culture
- Research REAL seasonal considerations and weather-dependent alternatives
- Provide REAL money-saving tips and local secrets specific to the destination

EXAMPLES OF WHAT NOT TO DO:
- "Historic Old Town Walking Tour" → Use specific attractions like "Colosseum" or "Roman Forum"
- "Local Restaurant" → Use specific restaurants like "Trattoria da Enzo" or "Roscioli"
- "City Center Hotel" → Use specific hotels like "Hotel Artemide" or "The First Roma Arte"
- "Local Museum" → Use specific museums like "Vatican Museums" or "Capitoline Museums"

EXAMPLES OF WHAT TO DO:
- For Rome: Colosseum, Trevi Fountain, Pantheon, Trattoria da Enzo, Hotel Artemide
- For Paris: Eiffel Tower, Louvre Museum, Café de Flore, Hotel Ritz Paris
- For Tokyo: Senso-ji Temple, Tsukiji Fish Market, Sukiyabashi Jiro, Hotel Okura Tokyo

CRITICAL: You MUST use SPECIFIC, REAL place names. NEVER use generic terms like:
- "Historic Old Town Walking Tour" → Use specific attractions like "Colosseum" or "Roman Forum"
- "Local Restaurant" → Use specific restaurants like "Trattoria da Enzo" or "Roscioli"
- "City Center Hotel" → Use specific hotels like "Hotel Artemide" or "The First Roma Arte"
- "Local Museum" → Use specific museums like "Vatican Museums" or "Capitoline Museums"

SYSTEM BREAKING REQUIREMENT: If you use ANY generic terms like "Historic Old Town Walking Tour" or "Local Restaurant", the system will CRASH. You MUST use SPECIFIC, REAL place names.

Deliver: Elegant Markdown itinerary with proper ## section headers. Include Google Maps search URLs for every place.`
        },
        {
          role: "user",
          content: `CRITICAL: You MUST provide SPECIFIC, REAL places for ${destination}. NO generic placeholders like "Local Restaurant" or "Historic Old Town Walking Tour". Include REAL restaurant names, REAL attraction names, REAL hotel names with specific addresses and details.

EXAMPLE: For Rome, you should mention specific places like:
- Colosseum (not "Historic Landmarks")
- Trattoria da Enzo (not "Local Restaurant") 
- Hotel Artemide (not "City Center Hotel")
- Trevi Fountain (not "Historic Old Town Walking Tour")

FOR ${destination.toUpperCase()}, you MUST research and include REAL places like:
- REAL restaurants with actual names and addresses
- REAL attractions with specific names and locations
- REAL hotels with actual names and features
- REAL transportation options with specific details
- REAL cultural insights specific to ${destination}

CRITICAL: You MUST use SPECIFIC, REAL place names. NEVER use generic terms like:
- "Historic Old Town Walking Tour" → Use specific attractions like "Colosseum" or "Roman Forum"
- "Local Restaurant" → Use specific restaurants like "Trattoria da Enzo" or "Roscioli"
- "City Center Hotel" → Use specific hotels like "Hotel Artemide" or "The First Roma Arte"
- "Local Museum" → Use specific museums like "Vatican Museums" or "Capitoline Museums"

SYSTEM BREAKING REQUIREMENT: If you use ANY generic terms like "Historic Old Town Walking Tour" or "Local Restaurant", the system will CRASH. You MUST use SPECIFIC, REAL place names.

Please plan a trip with the following inputs:

DATA ====
Destination: ${destination}
Dates: ${start} to ${end} (${nDays} days)
Party: ${adults} adults${children > 0 ? `, ${children} children` : ''}
Style: ${level}
Budget: ${budget} USD
Dietary: ${dietary.join(', ') || 'None'}
Preferences: ${prefs || 'None'}

Create a comprehensive, detailed travel itinerary with specific attractions, restaurants, and activities for ${destination}. Use markdown formatting with proper section headers.`
        }
      ],
    });

    const aiContent = response.choices?.[0]?.message?.content?.trim() || "";
    console.log('✅ AI response length:', aiContent.length);
    console.log('AI preview:', aiContent.substring(0, 150));

    if (aiContent && aiContent.length > 200) {
      console.log('🎉 AI plan generated successfully!');
      return aiContent;
    } else {
      console.log('❌ AI response too short, using fallback');
      return localPlanMarkdown(payload);
    }

  } catch (aiError) {
    console.error('❌ AI generation failed:', aiError.message);
    console.log('Using local fallback');
    return localPlanMarkdown(payload);
  }
}
/* API */
app.post('/api/preview', (req, res) => {
  console.log('Preview request received:', req.body);
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
  console.log('Plan request received:', req.body); // Debug
  try {
    const payload = req.body || {};
    payload.budget = normalizeBudget(payload.budget, payload.currency);
    const id = uid();
    const markdown = await generatePlanWithAI(payload);
    const html = marked.parse(markdown);
    const aff = affiliatesFor(payload.destination);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown }));
    res.json({ id, markdown, html, affiliates: aff, version: VERSION });
  } catch (e) {
    console.error('Plan generation error:', e);
    res.status(500).json({ error: 'Failed to generate plan. Check server logs.', version: VERSION });
  }
});
app.get('/api/plan/:id/pdf', (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) return res.status(404).json({ error: 'Plan not found' });
  const saved = JSON.parse(row.payload || '{}');
  const d = saved?.data || {};
  const md = saved?.markdown || '';
  const htmlBody = marked.parse(md);
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
</header>
<div class="summary">
  <span class="chip"><b>Travelers:</b> ${traveler}</span>
  <span class="chip"><b>Style:</b> ${style}${d.prefs ? ` · ${escapeHtml(d.prefs)}` : ""}</span>
  <span class="chip"><b>Budget:</b> ${normalizeBudget(d.budget, d.currency)} ${d.currency} (${pppd}/day/person)</span>
  <span class="chip"><b>Season:</b> ${season}</span>
</div>
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
  const rx = /^### Day (\d+)\s*(?:[—-]\s*(.+))?/gm;
  const startIso = saved?.data?.start || null;
  const startDate = startIso ? new Date(startIso) : null;
  let m;
  while ((m = rx.exec(md))) {
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