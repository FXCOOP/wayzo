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
  const { destination = 'Your destination', start = 'start', end = 'end', budget = 1500, adults = 2, children = 0, level = 'mid', prefs = '', diet = '', currency = 'USD $', interests = [] } = input || {};
  const nDays = daysBetween(start, end);
  const b = computeBudget(budget, nDays, level, Math.max(1, adults + children));
  const style = level === "luxury" ? "Luxury" : level === "budget" ? "Budget" : "Mid-range";
  const pppd = perPersonPerDay(budget, nDays, Math.max(1, adults + children));
  
  return linkifyTokens(`
# 🌴 Amazing ${destination} Trip Plan

![${destination} hero view](image:${destination} sunset skyline panoramic view)

## 🎯 Trip Overview
Welcome to your dream getaway to ${destination}! This ${nDays}-day adventure is perfectly tailored for ${travelerLabel(adults, children)} seeking a ${style.toLowerCase()} experience.

**Travel Dates:** ${start} - ${end}
**Travelers:** ${travelerLabel(adults, children)}
**Style:** ${style}${prefs ? ` · ${prefs}` : ""}${interests.length > 0 ? ` · Interests: ${interests.join(', ')}` : ""}
**Budget:** ${budget} ${currency} (${pppd}/day/person)
**Season:** ${seasonFromDate(start)}

---

## 💰 Budget Breakdown
Here's a detailed cost analysis to keep your budget on track:

| Item | Cost per Person | Total | Status |
|------|----------------|-------|--------|
| 🏨 Accommodation (${nDays-1} nights) | ${b.stay.perDay} | ${b.stay.total} | Pending |
| 🍽️ Food (3 meals/day) | ${b.food.perDay} | ${b.food.total} | Pending |
| 🚌 Transportation (local travel) | ${Math.round(b.transit.total/Math.max(1, adults + children))} | ${b.transit.total} | Pending |
| 🎭 Activities & Attractions | ${Math.round(b.act.total/Math.max(1, adults + children))} | ${b.act.total} | Pending |
| **Total** | **${Math.round((budget)/Math.max(1, adults + children))}** | **${budget}** | **Total** |

---

## 🗺️ Getting Around
**Transportation Tips:**
${destination.toLowerCase().includes('santorini') ? `
- **Flights:** Check Ryanair and Wizz Air for budget-friendly flights from Tel Aviv to Santorini (JTR airport)
- **Local Transport:** Use KTEL buses to get around the island. Buses are cheap and frequent in summer. Pay the conductor in cash.
- **ATV Rental:** Consider renting an ATV for more flexibility and adventure!
- **Walking:** Many attractions are within walking distance in each village
` : `
- Local public transport is your best friend for budget-friendly travel
- Consider day passes for unlimited rides
- Walking between nearby attractions saves money and gives you local insights
`}

[Map](map:${destination} public transportation routes)

---

## 🏨 Accommodation
Here are some great accommodation options in ${destination}:

**${style} Options:**
- Prime location with great reviews [Book](book:${destination} ${style} hotel)
- Local neighborhood gems [Reviews](reviews:${destination} local accommodation)
- Central area for easy access [Map](map:${destination} hotel district)

---

## 🍽️ Dining Guide
Explore the local cuisine at these amazing spots:

![${destination} traditional cuisine](image:${destination} traditional food local dishes)

- **Local specialties** - Try the region's signature dishes [Reviews](reviews:${destination} traditional restaurant)
- **Budget-friendly eats** - Street food and local markets [Map](map:${destination} food market)
- **Fine dining** - Special occasion restaurants [Book](book:${destination} fine dining)
${diet ? `- **${diet} options** - Restaurants accommodating your dietary needs [Reviews](reviews:${destination} ${diet} restaurant)` : ''}

---

## 🎭 Daily Itineraries

### Day 1: Arrival and First Impressions (${start})
- **Morning:** Arrive and check-in. [Map](map:${destination} airport to hotel)
- **Afternoon:** Explore the neighborhood, get oriented
- **Evening:** Welcome dinner with local cuisine [Reviews](reviews:${destination} welcome dinner)

### Day 2: Main Attractions
- **Morning:** Visit the top landmark [Tickets](tickets:${destination} main attraction)
- **Afternoon:** Explore historic district [Map](map:${destination} historic center)
- **Evening:** Sunset viewing and dinner [Reviews](reviews:${destination} sunset spot)

![${destination} famous landmark](image:${destination} famous landmark architecture)

### Day 3: Cultural Immersion
- **Morning:** Museum or cultural site [Tickets](tickets:${destination} museum)
- **Afternoon:** Local market and shopping [Map](map:${destination} local market)
- **Evening:** Traditional entertainment [Reviews](reviews:${destination} cultural show)

${nDays > 3 ? `### Day 4: Nature & Relaxation
- **Morning:** Park, beach, or nature excursion [Map](map:${destination} nature park)
- **Afternoon:** Leisure time and relaxation
- **Evening:** Farewell dinner [Book](book:${destination} farewell dinner)

![${destination} nature views](image:${destination} nature landscape beach)` : ''}

### Day ${nDays}: Departure
- **Morning:** Last-minute shopping or easy sightseeing
- **Afternoon:** Check out and head to departure point

---

## 🎫 Must-See Attractions
${destination.toLowerCase().includes('santorini') ? `
- **Oia Castle** - Stunning sunset views (public viewpoint, no tickets needed)
- **Red Beach** - Famous for its unique color (viewpoint only - officially unsafe for swimming)
- **Perissa/Perivolos Beach** - Black sand beaches perfect for swimming
- **Akrotiri Archaeological Site** - Explore ancient ruins [Tickets](tickets:${destination} akrotiri)
- **Santo Wines** - Experience local winemaking (book sunset slots ahead)
- **Fira's Caldera** - Beautiful views of the sea
- **Ancient Thera** - Explore the ruins on the mountain
- **Museum of Prehistoric Thera** - Learn about Santorini's history [Tickets](tickets:${destination} museum)
` : `
- **Top Landmark** - Iconic must-visit site [Tickets](tickets:${destination} landmark)
- **Cultural Heritage** - Museums and historic sites [Reviews](reviews:${destination} museum)
- **Natural Beauty** - Parks, beaches, or scenic viewpoints [Map](map:${destination} scenic viewpoints)
- **Local Experiences** - Markets, neighborhoods, authentic activities
`}

![${destination} cityscape](image:${destination} cityscape architecture buildings)

---

## 🧳 Don't Forget List
🧳 **Packing Checklist**

☐ Passport and travel documents  
☐ Travel insurance  
☐ Local currency or travel cards  
☐ Power adapter for electronics  
☐ Comfortable walking shoes  
☐ Camera/phone charger  
☐ Medications and first aid  
☐ Weather-appropriate clothing  
☐ eSIM or local SIM card  
☐ Emergency contact information  
${diet ? '☐ Dietary restriction cards/translations  ' : ''}
${children > 0 ? '☐ Kid-friendly entertainment and snacks  ' : ''}

---

## 🛡️ Travel Tips
- **Local Customs:** Research basic etiquette and common phrases
- **Safety:** Keep copies of important documents; know emergency numbers
- **Money:** Notify your bank of travel plans; have backup payment methods
- **Health:** Check if any vaccinations are needed

---

## 🚨 Emergency Info
- **Local Emergency Services:** Research local emergency numbers
- **Healthcare:** Know the nearest hospital and pharmacy locations
- **Embassy:** Keep your country's embassy contact information handy

---

Get ready for an unforgettable experience in ${destination}! Enjoy the culture, cuisine, and countless memories waiting to be made. Safe travels! 🌅✈️
`.trim(), destination);
}
/* OpenAI (optional) */
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
async function generatePlanWithAI(payload) {
  const { destination = '', start = '', end = '', budget = 0, currency = 'USD $', adults = 2, children = 0, level = 'mid', prefs = '', diet = '', interests = [] } = payload || {};
  const nDays = daysBetween(start, end);
  
  const sys = `You are Wayzo AI, a world-class travel planning expert specializing in ${destination}. Create comprehensive, personalized travel itineraries that rival the best travel planners.

CORE REQUIREMENTS:
- Return ONLY Markdown content formatted exactly like a professional travel guide
- Include specific restaurant names, exact attractions, realistic costs, and detailed timing
- Add relevant images using syntax: ![Description](image:specific search term)
- Use booking links: [Map](map:query) [Tickets](tickets:query) [Book](book:query) [Reviews](reviews:query)
- Focus on authentic local experiences that only locals would know
- Include practical tips, real costs in local currency, and insider logistics

IMAGE STRATEGY:
- Add 6-10 stunning, destination-specific images strategically placed
- Use highly specific search terms: "${destination} sunset oia castle", "${destination} blue dome church", "${destination} santorini seafood taverna", "${destination} caldera view terrace"
- Hero image: panoramic destination view
- Food image: local cuisine plated beautifully  
- Landmark images: iconic architecture/views
- Activity images: people enjoying experiences
- Nature images: beaches, landscapes, sunsets

CONTENT STRUCTURE & TONE:
Create a plan that reads like it was written by someone who has lived in ${destination} for years:

1. **Engaging Overview** - Start with "🌴 Amazing [Destination] Trip Plan" and compelling description
2. **Smart Budget Table** - Realistic costs with pending status checkboxes  
3. **Transportation Mastery** - Specific airline names, bus routes, local transport hacks
4. **Accommodation by District** - Real hotel names with price ranges and booking links
5. **Restaurant Guide** - Actual restaurant names, signature dishes, price ranges, reviews
6. **Daily Itineraries** - Hour-by-hour plans with specific venues and realistic timing
7. **Must-See Attractions** - Real attraction names, ticket prices, insider tips
8. **Interactive Packing List** - Use ☐ checkboxes for interactive items
9. **Local Insider Tips** - Cultural nuances, hidden gems, money-saving tricks
10. **Practical Info** - Emergency contacts, useful apps, local customs

QUALITY STANDARDS:
- Every restaurant/hotel/attraction mentioned should be a real place
- Include specific costs in euros (€) for European destinations  
- Add "| Reviews" and "| Book" links after venue mentions
- Use emojis strategically for visual appeal and section breaks
- Write with confidence and local expertise - no generic advice
- Include seasonal considerations and weather-specific tips
- Add estimated travel times between locations

DESTINATION-SPECIFIC ACCURACY (SANTORINI):
- Red Beach: Officially unsafe/inaccessible beyond barriers → list as "viewpoint only", recommend Perissa/Perivolos for swimming
- Oia Castle: Public viewpoint → do NOT add "Tickets" links
- Santo Wines: Mention sunset slots fill fast, suggest booking ahead
- KTEL buses: Pay conductor in cash, frequent summer service
- If hours/tickets may vary, say "check current hours just before visiting"

Make this feel like a premium travel guide worth €200, not a generic AI response.`;

  const interests_text = interests && interests.length > 0 ? ` Interests: ${interests.join(', ')}` : '';
  const user = `Destination: ${destination}
Dates: ${start} to ${end} (${nDays} days)
Party: ${adults} adults${children ? `, ${children} children` : ""}
Style: ${level}${prefs ? ` + ${prefs}` : ""}${interests_text}
Budget: ${budget} ${currency}
Diet: ${diet}

Create a detailed ${nDays}-day travel plan that feels authentic and locally-inspired. Include specific restaurant names, exact attractions, realistic timing, and practical costs. Make it feel like it was written by someone who knows ${destination} intimately.`;
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
  .test-user-notice{background:var(--accent);padding:8px 12px;border-radius:8px;margin-bottom:16px;font-size:14px;color:var(--muted)}
  h1{font-size:28px;font-weight:700;margin:0 0 16px 0;color:var(--ink)}
  h2{font-size:24px;font-weight:600;margin:32px 0 16px 0;color:var(--ink);border-bottom:1px solid var(--border);padding-bottom:8px}
  h3{font-size:20px;font-weight:600;margin:24px 0 12px 0;color:var(--ink)}
  p{margin:0 0 16px 0;line-height:1.6}
  ul,ol{margin:0 0 16px 0;padding-left:24px}
  li{margin:0 0 8px 0;line-height:1.5}
  table{border-collapse:collapse;width:100%;margin:16px 0;font-size:14px}
  th,td{padding:12px;text-align:left;border-bottom:1px solid var(--border)}
  th{background:var(--accent);font-weight:600;color:var(--ink)}
  tr:hover{background:var(--accent)}
  a{color:var(--brand);text-decoration:none}
  a:hover{text-decoration:underline}
  .chip{display:inline-block;background:var(--accent);padding:4px 8px;border-radius:4px;font-size:12px;margin:2px}
  .muted{color:var(--muted);font-size:14px}
  .summary{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}
  .summary .chip{background:var(--accent);padding:6px 12px;font-size:14px}
  
  /* Better placeholder styling */
  .image-placeholder { 
    display:flex; align-items:center; justify-content:center; 
    background:#f5f7fb; border:1px dashed #cbd5e1; border-radius:12px; 
    min-height:220px; margin:8px 0; 
  }
  .image-placeholder .placeholder-content { text-align:center; color:#64748b; }
  .image-loaded + .image-placeholder { display:none !important; }
  .hidden { display:none !important; }

  /* Toggling styles */
  .done { text-decoration: line-through; color:#64748b; }
  .status-pending { color:#b45309; font-weight:600; }
  .status-total { color:#0f766e; font-weight:700; }

  /* Print friendliness */
  @media print {
    body { color: #0f172a; }
    a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 10px; color:#475569; }
    .header, .test-user-notice { break-inside: avoid; }
    img, table, h2, h3 { break-inside: avoid; page-break-inside: avoid; }
  }
</style>
</head>
<body>
<header>
  <div class="logo">
    <div class="badge">W</div>
    <div>
      <strong>Wayzo Trip Plan</strong><br>
      <span class="muted">Generated on ${new Date().toLocaleDateString()}</span>
    </div>
  </div>
  <div class="muted">
    <a href="${pdfUrl}">📄 PDF</a> • 
    <a href="${icsUrl}">📅 Calendar</a> • 
    <a href="${shareX}">📤 Share</a>
  </div>
</header>

<div class="test-user-notice">
  🧪 TEST USER MODE - Full Plan Unlocked!<br>
  You're signed in as a test user. All features are unlocked for testing purposes.
</div>

${htmlBody}

<script>
document.addEventListener('DOMContentLoaded', () => {
  // Unhide images and wire up placeholders
  document.querySelectorAll('.image-placeholder + img').forEach((img) => {
    const placeholder = img.previousElementSibling;
    const reveal = () => {
      img.classList.add('image-loaded');
      if (placeholder) placeholder.classList.add('hidden');
    };
    const fail = () => {
      if (placeholder) {
        const p = placeholder.querySelector('p');
        if (p) p.textContent = 'Image unavailable (check URL or network)';
      }
    };
    if (img.complete) {
      // Image already in cache
      if (img.naturalWidth > 0) reveal(); else fail();
    } else {
      img.addEventListener('load', reveal, { once: true });
      img.addEventListener('error', fail, { once: true });
    }
  });

  // Define toggle helpers to avoid console errors
  window.toggleBudgetItem = (el) => {
    const row = el.closest('tr');
    if (!row) return;
    row.classList.toggle('done', el.checked);
    const status = row.querySelector('.status-pending');
    if (status) status.textContent = el.checked ? 'Done' : 'Pending';
  };
  window.toggleItem = (el) => {
    const label = el.nextElementSibling;
    if (label) label.classList.toggle('done', el.checked);
  };
});
</script>
</body>
</html>`;
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