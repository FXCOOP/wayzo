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
const VERSION = 'staging-v24';
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
# 🌟 ${destination} — ${start} → ${end}
![${destination} skyline](image:${destination} cityscape)

**Travelers:** ${travelerLabel(adults, children)}
**Style:** ${style}${prefs ? ` · ${prefs}` : ""}
**Budget:** ${budget} ${currency} (${pppd}/day/person)
**Season:** ${seasonFromDate(start)}

---

## 🎯 Trip Overview
Welcome to your unforgettable journey to ${destination}! This ${nDays}-day trip offers a perfect blend of adventure, culture, and relaxation, tailored specifically for your preferences and budget.

**Highlights:**
- Explore the most iconic attractions and hidden gems
- Experience authentic local cuisine and culture
- Enjoy comfortable accommodations within your budget
- Create lasting memories with your travel companions

![${destination} overview](image:${destination} overview)

---

## 💰 Budget Breakdown
Here's a detailed cost analysis to keep your trip within budget. All prices are in ${currency}.

| Item | Cost per Person (${currency}) | Total (${currency}) | Status |
|------|-------------------------------|---------------------|---------|
| Flights | ${Math.round(b.transit.total / 2)} | ${b.transit.total} | Pending |
| Accommodation (${nDays - 1} nights) | ${Math.round(b.stay.total / Math.max(1, adults + children))} | ${b.stay.total} | Pending |
| Food (3 meals/day) | ${Math.round(b.food.total / Math.max(1, adults + children))} | ${b.food.total} | Pending |
| Transportation (local travel) | ${Math.round(b.transit.total / 2)} | ${b.transit.total} | Pending |
| Activities & Attractions | ${Math.round(b.act.total / Math.max(1, adults + children))} | ${b.act.total} | Pending |
| Miscellaneous | ${Math.round(budget * 0.05)} | ${Math.round(budget * 0.05)} | Pending |
| **Total** | **${Math.round(budget / Math.max(1, adults + children))}** | **${budget}** | **Total** |

---

## 🗺️ Getting Around
**Transportation Tips:**
- **Flights:** Book your flights well in advance for the best deals. [Search Flights](flights:${destination})
- **Local Transport:** Use public transportation for affordable travel around the city
- **Maps:** [${destination} Map](map:${destination} map)

![${destination} transportation](image:${destination} transportation)

---

## 🏨 Accommodation
**${style} Options:**

**Option 1: ${destination} Central Hotel**
- Price: ${Math.round(b.stay.perDay)}/night
- [Book](book:${destination} hotel) | [Reviews](reviews:${destination} hotel)
- Central location with easy access to attractions

**Option 2: ${destination} Comfort Inn**
- Price: ${Math.round(b.stay.perDay * 0.8)}/night  
- [Book](book:${destination} budget hotel) | [Reviews](reviews:${destination} budget hotel)
- Budget-friendly option with good amenities

**Option 3: ${destination} Luxury Resort**
- Price: ${Math.round(b.stay.perDay * 2)}/night
- [Book](book:${destination} luxury hotel) | [Reviews](reviews:${destination} luxury hotel)
- Premium experience with top-notch service

![${destination} accommodation](image:${destination} accommodation)

---

## 🍽️ Dining Guide
Explore local flavors at these recommended restaurants:

**Traditional Local Cuisine:**
- **${destination} Taverna** - Authentic local dishes
  - Location: City Center
  - [Reviews](reviews:${destination} traditional restaurant)

**Modern Dining:**
- **${destination} Bistro** - Contemporary cuisine
  - Location: Downtown
  - [Reviews](reviews:${destination} modern restaurant)

**Budget-Friendly:**
- **${destination} Cafe** - Casual dining
  - Location: Near attractions
  - [Reviews](reviews:${destination} cafe)

![${destination} cuisine](image:${destination} cuisine)

---

## 🎭 Daily Itineraries

### Day 1 — Arrival & Orientation (${start})
- **Morning:** Arrive in ${destination}, check into your hotel
- **Afternoon:** Explore the city center, visit main attractions
- **Evening:** Enjoy dinner at a local restaurant
- **Highlights:** [Map](map:${destination} city center), [Book](book:${destination} dinner)

### Day 2 — Cultural Exploration
- **Morning:** Visit museums and historical sites
- **Afternoon:** Local market exploration
- **Evening:** Cultural performance or show
- **Highlights:** [Tickets](tickets:${destination} museum), [Map](map:${destination} market)

### Day 3 — Nature & Adventure
- **Morning:** Outdoor activities or nature walks
- **Afternoon:** Relaxation and local experiences
- **Evening:** Sunset viewing and photography
- **Highlights:** [Tickets](tickets:${destination} outdoor activities), [Map](map:${destination} nature spots)

![${destination} activities](image:${destination} activities)

---

## 🎫 Must-See Attractions
- **Main Attraction:** The most iconic site in ${destination}
  - [Tickets](tickets:${destination} main attraction)
- **Cultural Site:** Important historical location
  - [Tickets](tickets:${destination} cultural site)
- **Natural Wonder:** Beautiful natural landscape
  - [Tickets](tickets:${destination} natural site)
- **Local Experience:** Authentic local activity
  - [Tickets](tickets:${destination} local experience)

![${destination} landmarks](image:${destination} landmarks)

---

## 🧳 Don't Forget List
- Passport and travel documents
- Travel insurance
- Local currency
- Power adapter
- Comfortable walking shoes
- Camera/phone charger
- Medications and first aid
- Weather-appropriate clothing
- eSIM or local SIM card
- Local guide contact info

---

## 🛡️ Travel Tips
**Local Customs:** Respect local traditions and customs
**Safety:** ${destination} is generally safe, but always be aware of your surroundings
**Best Time to Visit:** ${seasonFromDate(start)} offers ideal weather conditions
**Money-Saving Tips:** Book activities in advance and use public transportation

---

## 📱 Useful Apps
- **Google Maps:** Navigate easily around the city
- **TripAdvisor:** Find restaurant reviews and activities
- **Local Transport App:** Check public transportation schedules

---

## 🚨 Emergency Info
**Emergency Services:** Dial local emergency number
**Local Hospitals:** ${destination} Hospital
**Pharmacy:** Available in city center

---

## 🖼️ Image Ideas
To visualize your ${destination} adventure:

**Cityscape/Overview:** ![${destination} cityscape](image:${destination} cityscape)
**Local Food:** ![${destination} food](image:${destination} food)
**Cultural Site:** ![${destination} culture](image:${destination} culture)
**Nature/Landscape:** ![${destination} nature](image:${destination} nature)
**Local Life:** ![${destination} local life](image:${destination} local life)
**Architecture:** ![${destination} architecture](image:${destination} architecture)
**Activity:** ![${destination} activities](image:${destination} activities)
**Experience:** ![${destination} experience](image:${destination} experience)

---

Prepare for an incredible journey filled with adventure, culture, and breathtaking views in ${destination}! Safe travels! 🌟✨
`.trim(), destination);
}
/* OpenAI (optional) */
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
async function generatePlanWithAI(payload) {
  const { destination = '', start = '', end = '', budget = 0, currency = 'USD $', adults = 2, children = 0, level = 'mid', prefs = '', diet = '' } = payload || {};
  const nDays = daysBetween(start, end);
  
  const sys = `You are an expert travel planner creating detailed, accurate, and personalized trip itineraries. 

CRITICAL REQUIREMENTS:
1. ACCURACY: Provide only factual, up-to-date information about destinations
2. PERSONALIZATION: Tailor recommendations to the specific budget, style, and preferences
3. STRUCTURE: Use the exact markdown format provided below
4. IMAGES: Include relevant destination-specific images using the image:token format
5. LINKS: Use token links for maps, tickets, bookings, and reviews
6. BUDGET: Ensure all recommendations fit within the specified budget
7. ACCESSIBILITY: Consider accessibility needs and provide inclusive recommendations

MARKDOWN TEMPLATE:
# 🌟 [Destination] — [Start Date] → [End Date]
![Destination skyline](image:[destination] cityscape)

**Travelers:** [Number and type]
**Style:** [Budget/Mid-range/Luxury] · [Preferences]
**Budget:** [Amount] [Currency] ([Per day/person])
**Season:** [Season]

---

## 🎯 Trip Overview
[2-3 sentences welcoming travelers and highlighting key aspects of the trip]

**Highlights:**
- [Specific highlight 1]
- [Specific highlight 2] 
- [Specific highlight 3]
- [Specific highlight 4]

![Destination overview](image:[destination] overview)

---

## 💰 Budget Breakdown
Here's a detailed cost analysis to keep your trip within budget. All prices are in [Currency].

| Item | Cost per Person ([Currency]) | Total ([Currency]) | Status |
|------|-------------------------------|---------------------|---------|
| Flights | [Amount] | [Amount] | Pending |
| Accommodation ([X] nights) | [Amount] | [Amount] | Pending |
| Food (3 meals/day) | [Amount] | [Amount] | Pending |
| Transportation (local travel) | [Amount] | [Amount] | Pending |
| Activities & Attractions | [Amount] | [Amount] | Pending |
| Miscellaneous | [Amount] | [Amount] | Pending |
| **Total** | **[Amount]** | **[Budget]** | **Total** |

---

## 🗺️ Getting Around
**Transportation Tips:**
- **Flights:** [Specific flight booking advice]
- **Local Transport:** [Local transportation options]
- **Maps:** [Destination Map](map:[destination] map)

![Destination transportation](image:[destination] transportation)

---

## 🏨 Accommodation
**[Style] Options:**

**[Option 1 Name]**
- Price: [Amount]/night
- [Book](book:[destination] [hotel type]) | [Reviews](reviews:[destination] [hotel type])
- [Brief description]

**[Option 2 Name]**
- Price: [Amount]/night
- [Book](book:[destination] [hotel type]) | [Reviews](reviews:[destination] [hotel type])
- [Brief description]

**[Option 3 Name]**
- Price: [Amount]/night
- [Book](book:[destination] [hotel type]) | [Reviews](reviews:[destination] [hotel type])
- [Brief description]

![Destination accommodation](image:[destination] accommodation)

---

## 🍽️ Dining Guide
Explore local flavors at these recommended restaurants:

**[Category 1]:**
- **[Restaurant Name]** - [Description]
  - Location: [Area]
  - [Reviews](reviews:[destination] [restaurant type])

**[Category 2]:**
- **[Restaurant Name]** - [Description]
  - Location: [Area]
  - [Reviews](reviews:[destination] [restaurant type])

**[Category 3]:**
- **[Restaurant Name]** - [Description]
  - Location: [Area]
  - [Reviews](reviews:[destination] [restaurant type])

![Destination cuisine](image:[destination] cuisine)

---

## 🎭 Daily Itineraries

### Day 1 — [Theme] ([Date])
- **Morning:** [Specific activity]
- **Afternoon:** [Specific activity]
- **Evening:** [Specific activity]
- **Highlights:** [Map](map:[destination] [location]), [Book](book:[destination] [activity])

### Day 2 — [Theme]
- **Morning:** [Specific activity]
- **Afternoon:** [Specific activity]
- **Evening:** [Specific activity]
- **Highlights:** [Tickets](tickets:[destination] [activity]), [Map](map:[destination] [location])

### Day 3 — [Theme]
- **Morning:** [Specific activity]
- **Afternoon:** [Specific activity]
- **Evening:** [Specific activity]
- **Highlights:** [Tickets](tickets:[destination] [activity]), [Map](map:[destination] [location])

![Destination activities](image:[destination] activities)

---

## 🎫 Must-See Attractions
- **[Attraction Name]:** [Brief description]
  - [Tickets](tickets:[destination] [attraction])
- **[Attraction Name]:** [Brief description]
  - [Tickets](tickets:[destination] [attraction])
- **[Attraction Name]:** [Brief description]
  - [Tickets](tickets:[destination] [attraction])
- **[Attraction Name]:** [Brief description]
  - [Tickets](tickets:[destination] [attraction])

![Destination landmarks](image:[destination] landmarks)

---

## 🧳 Don't Forget List
- Passport and travel documents
- Travel insurance
- Local currency
- Power adapter
- Comfortable walking shoes
- Camera/phone charger
- Medications and first aid
- Weather-appropriate clothing
- eSIM or local SIM card
- Local guide contact info

---

## 🛡️ Travel Tips
**Local Customs:** [Specific local customs]
**Safety:** [Safety information]
**Best Time to Visit:** [Seasonal advice]
**Money-Saving Tips:** [Budget tips]

---

## 📱 Useful Apps
- **[App Name]:** [Purpose]
- **[App Name]:** [Purpose]
- **[App Name]:** [Purpose]

---

## 🚨 Emergency Info
**Emergency Services:** [Emergency number]
**Local Hospitals:** [Hospital information]
**Pharmacy:** [Pharmacy information]

---

## 🖼️ Image Ideas
To visualize your [destination] adventure:

**Cityscape/Overview:** ![Destination cityscape](image:[destination] cityscape)
**Local Food:** ![Destination food](image:[destination] food)
**Cultural Site:** ![Destination culture](image:[destination] culture)
**Nature/Landscape:** ![Destination nature](image:[destination] nature)
**Local Life:** ![Destination local life](image:[destination] local life)
**Architecture:** ![Destination architecture](image:[destination] architecture)
**Activity:** ![Destination activities](image:[destination] activities)
**Experience:** ![Destination experience](image:[destination] experience)

---

Prepare for an incredible journey filled with adventure, culture, and breathtaking views in [destination]! Safe travels! 🌟✨

IMPORTANT: Replace all [placeholders] with specific, accurate information. Use only factual data and realistic recommendations.`;

  const user = `Destination: ${destination}
Dates: ${start} to ${end} (${nDays} days)
Party: ${adults} adults${children ? `, ${children} children` : ""}
Style: ${level}${prefs ? ` + ${prefs}` : ""}
Budget: ${budget} ${currency}
Diet: ${diet}

Create a detailed, accurate, and personalized travel plan following the exact template above. Ensure all recommendations are realistic and fit within the budget. Include specific, destination-relevant information.`;

  if (!client) {
    console.warn('OpenAI API key not set, using local fallback');
    let md = localPlanMarkdown(payload);
    md = ensureDaySections(md, nDays, start);
    return md;
  }

  try {
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.3, // Lower temperature for more consistent, accurate output
      max_tokens: 4000,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
    });
    
    let md = resp.choices?.[0]?.message?.content?.trim() || "";
    if (!md) {
      console.warn('OpenAI response empty, using fallback');
      md = localPlanMarkdown(payload);
    }
    
    // Post-process the markdown for consistency
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
    const markdown = await generatePlanWithQualityCheck(payload);
    let html = marked.parse(markdown);
    
    // Insert contextual widgets
    html = await insertContextualWidgets(html, payload.destination);
    
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

// Add contextual widget placement function
async function insertContextualWidgets(html, destination = '') {
  const { generateContextualWidgets } = await import('./lib/links.mjs');
  
  // Define widget insertion points
  const widgetPoints = {
    'accommodation': {
      after: /<h2[^>]*>.*?🏨.*?Accommodation.*?<\/h2>/i,
      section: 'accommodation'
    },
    'transportation': {
      after: /<h2[^>]*>.*?🗺️.*?Getting Around.*?<\/h2>/i,
      section: 'transportation'
    },
    'activities': {
      after: /<h2[^>]*>.*?🎫.*?Must-See Attractions.*?<\/h2>/i,
      section: 'activities'
    },
    'connectivity': {
      after: /<h2[^>]*>.*?📱.*?Useful Apps.*?<\/h2>/i,
      section: 'connectivity'
    }
  };
  
  let modifiedHtml = html;
  
  // Insert widgets at appropriate locations
  for (const [key, config] of Object.entries(widgetPoints)) {
    const widgetData = generateContextualWidgets(config.section, destination);
    if (widgetData) {
      const widgetHtml = generateWidgetHTML(widgetData);
      modifiedHtml = modifiedHtml.replace(
        config.after,
        `$&${widgetHtml}`
      );
    }
  }
  
  return modifiedHtml;
}

function generateWidgetHTML(widgetData) {
  if (!widgetData || !widgetData.widgets) return '';
  
  let html = `
<div class="affiliate-widgets-section">
  <h3>${widgetData.title}</h3>
  <div class="widgets-grid">`;
  
  widgetData.widgets.forEach(widget => {
    html += `
    <div class="affiliate-widget" data-category="${widget.type}" data-placement="contextual">
      <div class="widget-header">
        <h4>${widget.title}</h4>
        <p>${widget.description}</p>
      </div>
      <div class="widget-content">
        <script async src="${widget.script}" charset="utf-8"></script>
      </div>
    </div>`;
  });
  
  html += `
  </div>
</div>`;
  
  return html;
}

// Quality assurance and validation functions
function validatePlanQuality(markdown, payload) {
  const issues = [];
  const warnings = [];
  
  // Check for required sections
  const requiredSections = [
    'Trip Overview',
    'Budget Breakdown', 
    'Getting Around',
    'Accommodation',
    'Dining Guide',
    'Daily Itineraries',
    'Must-See Attractions',
    'Don\'t Forget List',
    'Travel Tips',
    'Useful Apps',
    'Emergency Info'
  ];
  
  requiredSections.forEach(section => {
    if (!markdown.includes(section)) {
      issues.push(`Missing required section: ${section}`);
    }
  });
  
  // Check for images
  const imageCount = (markdown.match(/!\[.*?\]\(image:/g) || []).length;
  if (imageCount < 5) {
    warnings.push(`Low image count: ${imageCount} images found`);
  }
  
  // Check for links
  const linkCount = (markdown.match(/\[.*?\]\(.*?\)/g) || []).length;
  if (linkCount < 10) {
    warnings.push(`Low link count: ${linkCount} links found`);
  }
  
  // Check for budget accuracy
  const budget = payload.budget || 0;
  const nDays = daysBetween(payload.start, payload.end);
  const travelers = Math.max(1, (payload.adults || 0) + (payload.children || 0));
  const perDayPerPerson = budget / nDays / travelers;
  
  if (perDayPerPerson < 50) {
    warnings.push(`Very low budget per day per person: $${perDayPerPerson}`);
  }
  
  // Check for destination specificity
  const destination = payload.destination || '';
  if (!markdown.toLowerCase().includes(destination.toLowerCase())) {
    issues.push(`Destination ${destination} not mentioned in plan`);
  }
  
  return { issues, warnings, score: Math.max(0, 100 - (issues.length * 10) - (warnings.length * 5)) };
}

// Enhanced plan generation with quality checks
async function generatePlanWithQualityCheck(payload) {
  let attempts = 0;
  const maxAttempts = 3;
  let bestPlan = null;
  let bestScore = 0;
  
  while (attempts < maxAttempts) {
    try {
      const markdown = await generatePlanWithAI(payload);
      const validation = validatePlanQuality(markdown, payload);
      
      console.log(`Plan attempt ${attempts + 1} - Score: ${validation.score}`);
      console.log('Issues:', validation.issues);
      console.log('Warnings:', validation.warnings);
      
      if (validation.score > bestScore) {
        bestScore = validation.score;
        bestPlan = markdown;
      }
      
      // If we have a high-quality plan, use it
      if (validation.score >= 80 && validation.issues.length === 0) {
        console.log('High-quality plan generated, using it');
        return markdown;
      }
      
      attempts++;
    } catch (error) {
      console.error(`Plan generation attempt ${attempts + 1} failed:`, error);
      attempts++;
    }
  }
  
  // If all attempts failed, use fallback
  if (!bestPlan) {
    console.log('All attempts failed, using local fallback');
    return localPlanMarkdown(payload);
  }
  
  console.log(`Using best plan with score: ${bestScore}`);
  return bestPlan;
}