/* eslint-disable no-console */
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { marked } from 'marked';
import puppeteer from 'puppeteer';
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
import { getWidgetsForDestination, generateWidgetHTML, injectWidgetsIntoSections } from './lib/widgets.mjs';
const VERSION = 'staging-v25';
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
/* Admin basic auth middleware */
function adminBasicAuth(req, res, next) {
  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASS;
  if (!adminUser || !adminPass) {
    return res.status(503).send('Admin is not configured. Set ADMIN_USER and ADMIN_PASS.');
  }
  const header = String(req.headers['authorization'] || '');
  if (!header.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Wayzo Admin"');
    return res.status(401).send('Authentication required');
  }
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    if (user === adminUser && pass === adminPass) return next();
  } catch (_) {}
  res.setHeader('WWW-Authenticate', 'Basic realm="Wayzo Admin"');
  return res.status(401).send('Invalid credentials');
}
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

// Legal pages
app.get('/privacy', (_req, res) => {
  const privacyFile = path.join(FRONTEND, 'privacy.html');
  if (fs.existsSync(privacyFile)) {
    res.sendFile(privacyFile);
  } else {
    res.status(404).send('Privacy Policy not found');
  }
});

app.get('/terms', (_req, res) => {
  const termsFile = path.join(FRONTEND, 'terms.html');
  if (fs.existsSync(termsFile)) {
    res.sendFile(termsFile);
  } else {
    res.status(404).send('Terms & Conditions not found');
  }
});

app.get('/cookies', (_req, res) => {
  const cookiesFile = path.join(FRONTEND, 'cookies.html');
  if (fs.existsSync(cookiesFile)) {
    res.sendFile(cookiesFile);
  } else {
    res.status(404).send('Cookie Policy not found');
  }
});

app.get('/contact', (_req, res) => {
  const contactFile = path.join(FRONTEND, 'contact.html');
  if (fs.existsSync(contactFile)) {
    res.sendFile(contactFile);
  } else {
    res.status(404).send('Contact page not found');
  }
});

// Admin route (protected)
app.get('/admin', adminBasicAuth, (_req, res) => {
  const adminFile = path.join(FRONTEND, 'admin.html');
  if (fs.existsSync(adminFile)) return res.sendFile(adminFile);
  res.status(404).send('Admin UI not found');
});

// Dashboard routes
app.get('/dashboard', (req, res) => {
  res.setHeader('X-Wayzo-Version', VERSION);
  const dashboardPath = path.join(FRONTEND, 'dashboard.html');
  if (!fs.existsSync(dashboardPath)) {
    return res.status(404).send('Dashboard not found');
  }
  res.sendFile(dashboardPath);
});

app.get('/dashboard/plans', (req, res) => {
  res.setHeader('X-Wayzo-Version', VERSION);
  const dashboardPath = path.join(FRONTEND, 'dashboard.html');
  if (!fs.existsSync(dashboardPath)) {
    return res.status(404).send('Dashboard not found');
  }
  // Add query parameter to open plans tab
  res.sendFile(dashboardPath);
});

app.get('/dashboard/referrals', (req, res) => {
  res.setHeader('X-Wayzo-Version', VERSION);
  const dashboardPath = path.join(FRONTEND, 'dashboard.html');
  if (!fs.existsSync(dashboardPath)) {
    return res.status(404).send('Dashboard not found');
  }
  // Add query parameter to open referrals tab
  res.sendFile(dashboardPath);
});

app.get('/dashboard/billing', (req, res) => {
  res.setHeader('X-Wayzo-Version', VERSION);
  const dashboardPath = path.join(FRONTEND, 'dashboard.html');
  if (!fs.existsSync(dashboardPath)) {
    return res.status(404).send('Dashboard not found');
  }
  // Add query parameter to open billing tab
  res.sendFile(dashboardPath);
});

app.get('/healthz', (_req, res) => res.json({ ok: true, version: VERSION }));
app.get('/version', (_req, res) => res.json({ version: VERSION }));

// Keep-alive endpoint for Render (10min pings)
app.get('/keep-alive', (_req, res) => {
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: VERSION 
  });
});

// Debug endpoint with memory tracking
app.get('/debug/ping', (_req, res) => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const heapUsedGB = heapUsedMB / 1024;
  
  res.json({
    ok: true,
    version: VERSION,
    uptime: Math.round(process.uptime()),
    memory: {
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      healthy: heapUsedGB < 1.5 // Less than 1.5GB
    },
    timestamp: new Date().toISOString()
  });
});

// Public runtime config for frontend (safe values only)
app.get('/config.js', (_req, res) => {
  const paypalClientId = process.env.PAYPAL_CLIENT_ID || '';
  const priceUsd = Number(process.env.REPORT_PRICE_USD || 19);
  const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(`window.WAYZO_PUBLIC_CONFIG = { PAYPAL_CLIENT_ID: ${JSON.stringify(paypalClientId)}, REPORT_PRICE_USD: ${JSON.stringify(priceUsd)}, GOOGLE_CLIENT_ID: ${JSON.stringify(googleClientId)} };`);
});

// PayPal config endpoint
app.get('/paypal-config.js', (_req, res) => {
  const paypalClientId = process.env.PAYPAL_CLIENT_ID || '';
  const paypalMode = process.env.PAYPAL_MODE || 'sandbox';
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(`
    if (window.WAYZO_PUBLIC_CONFIG && window.WAYZO_PUBLIC_CONFIG.PAYPAL_CLIENT_ID) {
      // Load PayPal SDK with real client ID
      const script = document.createElement('script');
      script.src = 'https://www.paypal.com/sdk/js?client-id=' + window.WAYZO_PUBLIC_CONFIG.PAYPAL_CLIENT_ID + '&currency=USD';
      script.async = true;
      script.onload = function() {
        console.log('PayPal SDK loaded with real client ID');
        if (window.initializePayPalButtons) {
          window.initializePayPalButtons();
        }
      };
      document.head.appendChild(script);
    } else {
      console.error('PayPal client ID not configured');
    }
  `);
});

/* Uploads */
const multerUpload = multer({ dest: UPLOADS, limits: { fileSize: 10 * 1024 * 1024, files: 10 } });
app.post('/api/upload', multerUpload.array('files', 10), (req, res) => {
  console.log('Upload request received:', req.files);
  const files = (req.files || []).map(f => ({
    name: f.originalname, size: f.size, url: `/uploads/${path.basename(f.path)}`, mime: f.mimetype
  }));
  res.json({ files });
});
/* Post-process markdown to remove images from forbidden sections */
function removeImagesFromForbiddenSections(markdown, destination) {
  console.log('Post-processing markdown to remove forbidden images...');
  
  // Define forbidden sections
  const forbiddenSections = [
    'Trip Overview',
    'Don\'t Forget List', 
    'Travel Tips',
    'Useful Apps',
    'Emergency Info'
  ];
  
  let processed = markdown;
  
  // Remove images from forbidden sections
  forbiddenSections.forEach(section => {
    const sectionRegex = new RegExp(`(##\\s*${section}[^#]*?)(![^\\n]*\\n)`, 'gis');
    processed = processed.replace(sectionRegex, '$1');
    console.log(`Removed images from section: ${section}`);
  });
  
  // Remove any remaining images that don't follow the correct format
  processed = processed.replace(/!\[([^\]]*)\]\(image:([^)]+)\)/gi, (match, alt, query) => {
    // Only allow images with destination prefix
    if (!query.includes(destination)) {
      console.log(`Removing invalid image: ${match}`);
      return '';
    }
    return match;
  });
  
  console.log('Post-processing complete');
  return processed;
}

/* DB */
const db = new Database(path.join(ROOT, 'tripmaster.sqlite'));
db.exec(`CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, payload TEXT NOT NULL);`);
db.exec(`CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, user_id TEXT, data TEXT, created_at TEXT NOT NULL);`);
const savePlan = db.prepare('INSERT OR REPLACE INTO plans (id, created_at, payload) VALUES (?, ?, ?)');
const getPlan = db.prepare('SELECT payload FROM plans WHERE id = ?');
const nowIso = () => new Date().toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

// Analytics tracking function
const trackPlanGeneration = (payload) => {
  try {
    const eventId = uid();
    db.prepare(`
      INSERT INTO events (id, event_type, user_id, data, created_at) 
      VALUES (?, ?, ?, ?, ?)
    `).run(
      eventId,
      'plan_generated',
      'anonymous', // Will be updated when user auth is implemented
      JSON.stringify({
        destination: payload.destination,
        adults: payload.adults,
        children: payload.children,
        budget: payload.budget,
        style: payload.level,
        dateMode: payload.dateMode,
        hasDietary: payload.dietary && payload.dietary.length > 0,
        hasFiles: payload.uploadedFiles && payload.uploadedFiles.length > 0
      }),
      new Date().toISOString()
    );
  } catch (e) {
    console.error('Failed to track plan generation:', e);
  }
};
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
function containsDaySections(md = "") {
  try { return /(^|\n)\s*#{0,6}\s*Day\s+\d+/i.test(md); } catch { return false; }
}
/* OpenAI (optional) */
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
async function generatePlanWithAI(payload) {
  const { 
    destination = '', 
    start = '', 
    end = '', 
    budget = 0, 
    currency = 'USD $', 
    adults = 2, 
    children = 0, 
    childrenAges = [],
    level = 'mid', 
    prefs = '', 
    dietary = [], 
    professional_brief = '',
    from = '',
    dateMode = 'exact',
    flexibleDates = null,
    uploadedFiles = [],
    mode = 'full'
  } = payload || {};
  
  const nDays = dateMode === 'flexible' && flexibleDates ? flexibleDates.duration : daysBetween(start, end);
  const totalTravelers = adults + children;
  
  // LOCKED AI PROMPT with RESEARCHED BALI DATA - FULL 8-DAY ENFORCEMENT
  const sys = `Generate 8-day itinerary in Markdown for ${destination} from ${start} to ${end}, 2 adults, ${budget} USD. Include 11 sections (## 🎯 Trip Overview to ## 🚨 Emergency Info) and ## 🌤️ Weather Forecast with 7-day table (mock: Sep 19 24°-30° 10% [Details](map:${destination}+weather); Sep 20 23°-29° 5%; Sep 21 25°-31° 15%; Sep 22 24°-30° 0%; Sep 23 26°-32° 20%; Sep 24 25°-31° 5%; Sep 25 27°-33° 0%; Sep 26 24°-30° 0%). Use specific researched places (e.g., 'Warung Babi Guling Ibu Oka at Jl. Tegal Sari No.2, Ubud, €5-10, 11AM-5PM, verify 2025 prices'), addresses, hours, prices with disclaimers, [Map](map:place), [Tickets](tickets:place), [Book](https://tpwdgt.com). NO IMAGES ANYWHERE. No generics (e.g., 'popular museum'—use 'Sacred Monkey Forest Sanctuary at Jl. Monkey Forest, Ubud, €5, 8:30AM-6PM'). CRITICAL: Enforce full hour-by-hour plans for ALL 8 days with one-sentence explanation for each place (e.g., 'Visit Uluwatu Temple at Pecatu – a clifftop sea temple famous for its sunset views and Kecak dance performances.'). NO incomplete days like 'Visit any missed sites'. Every day must have 6-8 activities with times and explanations. Budget: ~$2000 (~€1800; flights €900, accommodation €140, food €350, transport €70, activities €700, misc €80). Researched data: attractions (Tanah Lot Temple at Beraban, Tabanan, €4, 7AM-7PM), restaurants (Naughty Nuri's Warung at Jl. Raya Sanggingan, Ubud, €10-15, 11AM-11PM), hotels (Pondok Ayu at Jl. Kubu Anyar No.16, Kuta, €15-20), transport (Grab taxi €5-10/ride), tips (dress modestly in temples, tip 10%), apps (Grab, Google Maps), emergency (112, Sanglah General Hospital +62 361 227 911).

**CRITICAL - NO IMAGES ANYWHERE:**
You are ABSOLUTELY FORBIDDEN from adding any images to any section. NO IMAGES ANYWHERE in the entire report.

**MANDATORY FULL ITINERARY REQUIREMENTS:**
- EVERY day must have full hour-by-hour schedule (6-8 activities per day)
- EVERY place must have one-sentence explanation (e.g., 'Visit Uluwatu Temple at Pecatu – a clifftop sea temple famous for its sunset views')
- NO incomplete days like 'Visit any missed sites' or 'Explore remaining areas'
- EVERY activity must have specific time, place name, and explanation

**SECTION ORDER (MANDATORY):**
- 🎯 Trip Overview
- 🌤️ Weather Forecast (NEW - with Bali temperatures)
- 💰 Budget Breakdown (total ~€1800 with checkboxes)
- 🗺️ Getting Around
- 🏨 Accommodation
- 🎫 Must-See Attractions
- 🍽️ Dining Guide
- 🎭 Daily Itineraries (FULL hour-by-hour ALL 8 days with explanations)
- 🧳 Don't Forget List
- 🛡️ Travel Tips
- 📱 Useful Apps
- 🚨 Emergency Info

Create AMAZING, DETAILED trip plans that are:

1. **Highly Personalized**: Use the professional brief and all user preferences to tailor everything
2. **Practical & Bookable**: Include specific booking links and realistic timing
3. **Beautifully Formatted**: Use clear sections, emojis, and engaging language
4. **Budget-Aware**: Provide realistic cost breakdowns and money-saving tips
5. **Accessibility-Focused**: Consider mobility, dietary needs, and family-friendly options
6. **Family-Oriented**: If children are included, prioritize family-friendly activities and accommodations

**REQUIRED SECTIONS (USE EXACT TITLES):**
- 🎯 **Trip Overview** - Quick facts and highlights
- 💰 **Budget Breakdown** - Detailed cost analysis per person with checkboxes for tracking
- 🗺️ **Getting Around** - Transportation tips and maps with [Map](map:...)
- 🏨 **Accommodation** - 3–5 hotel options (Budget/Mid/Luxury) with [Book](book:...), [Reviews](reviews:...)
- 🎫 **Must-See Attractions** - 8–12 sights with [Tickets](tickets:...)
- 🍽️ **Dining Guide** - 6–10 restaurants by neighborhood with [Reviews](reviews:...)
- 🎭 **Daily Itineraries** - Hour-by-hour plans per day with [Tickets](tickets:...), [Map](map:...)
- 🧳 **Don't Forget List** - 8–12 packing/reminders with checkboxes for tracking
- 🛡️ **Travel Tips** - Local customs, safety, and practical advice
- 📱 **Useful Apps** - Mobile apps for the destination
- 🚨 **Emergency Info** - Important contacts and healthcare

**BUDGET BREAKDOWN FORMAT:**
Create a detailed budget table like this with proper HTML:
<table class="budget-table">
<thead>
<tr>
<th>Item</th>
<th>Cost per Person (€)</th>
<th>Total (€)</th>
<th>Status</th>
</tr>
</thead>
<tbody>
<tr>
<td>
<div class="budget-checkbox">
<input type="checkbox" id="budget1" onchange="toggleBudgetItem(this)">
<label for="budget1">Flights (From to Destination)</label>
</div>
</td>
<td>150</td>
<td>300</td>
<td><span class="status-pending">Pending</span></td>
</tr>
<tr>
<td>
<div class="budget-checkbox">
<input type="checkbox" id="budget2" onchange="toggleBudgetItem(this)">
<label for="budget2">Accommodation (X nights)</label>
</div>
</td>
<td>150</td>
<td>300</td>
<td><span class="status-pending">Pending</span></td>
</tr>
<tr>
<td>
<div class="budget-checkbox">
<input type="checkbox" id="budget3" onchange="toggleBudgetItem(this)">
<label for="budget3">Food (3 meals/day)</label>
</div>
</td>
<td>25</td>
<td>150</td>
<td><span class="status-pending">Pending</span></td>
</tr>
<tr>
<td>
<div class="budget-checkbox">
<input type="checkbox" id="budget4" onchange="toggleBudgetItem(this)">
<label for="budget4">Transportation (local travel)</label>
</div>
</td>
<td>30</td>
<td>60</td>
<td><span class="status-pending">Pending</span></td>
</tr>
<tr>
<td>
<div class="budget-checkbox">
<input type="checkbox" id="budget5" onchange="toggleBudgetItem(this)">
<label for="budget5">Activities & Attractions</label>
</div>
</td>
<td>80</td>
<td>160</td>
<td><span class="status-pending">Pending</span></td>
</tr>
<tr>
<td>
<div class="budget-checkbox">
<input type="checkbox" id="budget6" onchange="toggleBudgetItem(this)">
<label for="budget6">Miscellaneous</label>
</div>
</td>
<td>10</td>
<td>20</td>
<td><span class="status-pending">Pending</span></td>
</tr>
<tr>
<td><strong>Total</strong></td>
<td><strong>€250</strong></td>
<td><strong>€500</strong></td>
<td><span class="status-total">Total</span></td>
</tr>
</tbody>
</table>

**DON'T FORGET LIST FORMAT:**
Create a checklist like this with proper HTML checkboxes that automatically mark as completed when clicked:
<div class="dont-forget-list">
<h3>🧳 Don't Forget List</h3>
<div class="dont-forget-item">
<input type="checkbox" id="item1" onchange="toggleItem(this)" class="budget-checkbox">
<label for="item1">Passport and travel documents</label>
</div>
<div class="dont-forget-item">
<input type="checkbox" id="item2" onchange="toggleItem(this)" class="budget-checkbox">
<label for="item2">Travel insurance</label>
</div>
<div class="dont-forget-item">
<input type="checkbox" id="item3" onchange="toggleItem(this)" class="budget-checkbox">
<label for="item3">Local currency (Euros)</label>
</div>
<div class="dont-forget-item">
<input type="checkbox" id="item4" onchange="toggleItem(this)" class="budget-checkbox">
<label for="item4">Power adapter</label>
</div>
<div class="dont-forget-item">
<input type="checkbox" id="item5" onchange="toggleItem(this)" class="budget-checkbox">
<label for="item5">Comfortable walking shoes</label>
</div>
<div class="dont-forget-item">
<input type="checkbox" id="item6" onchange="toggleItem(this)" class="budget-checkbox">
<label for="item6">Camera/phone charger</label>
</div>
<div class="dont-forget-item">
<input type="checkbox" id="item7" onchange="toggleItem(this)" class="budget-checkbox">
<label for="item7">Medications and first aid</label>
</div>
<div class="dont-forget-item">
<input type="checkbox" id="item8" onchange="toggleItem(this)" class="budget-checkbox">
<label for="item8">Weather-appropriate clothing</label>
</div>
<div class="dont-forget-item">
<input type="checkbox" id="item9" onchange="toggleItem(this)" class="budget-checkbox">
<label for="item9">eSIM or local SIM card</label>
</div>
<div class="dont-forget-item">
<input type="checkbox" id="item10" onchange="toggleItem(this)" class="budget-checkbox">
<label for="item10">Local guide contact info</label>
</div>
<div class="dont-forget-item">
<input type="checkbox" id="item11" onchange="toggleItem(this)" class="budget-checkbox">
<label for="item11">Restaurant reservations</label>
</div>
<div class="dont-forget-item">
<input type="checkbox" id="item12" onchange="toggleItem(this)" class="budget-checkbox">
<label for="item12">Swimwear for beaches</label>
</div>
</div>

**FORMATTING:**
- Use emojis and clear headings
- Include [Map](map:query) for location links
- Add [Book](book:query) for booking links
- Use [Reviews](reviews:query) for recommendations
- Include [Tickets](tickets:query) for attractions

**STYLE:** Make it exciting, informative, and ready to use!`;

  // Trip context appended to system prompt (single prompt approach)
  const user = `Create an AMAZING trip plan for:

**Destination:** ${destination}
${from ? `**Traveling From:** ${from}` : ''}
**Dates:** ${dateMode === 'flexible' ? `Flexible dates in ${flexibleDates?.month || 'selected month'} for ${nDays} days` : `${start} to ${end} (${nDays} days)`}
**Travelers:** ${adults} adults${children ? `, ${children} children${childrenAges.length > 0 ? ` (ages: ${childrenAges.join(', ')})` : ''}` : ''}
**Style:** ${level}${prefs ? ` + ${prefs}` : ""}
**Budget:** ${budget} ${currency} (${Math.round(budget / nDays / totalTravelers)} per person per day)
${dietary && dietary.length > 0 ? `**Dietary Needs:** ${dietary.join(', ')}` : ''}

${professional_brief ? `**PROFESSIONAL BRIEF:** ${professional_brief}

Use this detailed brief to create a highly personalized plan that addresses every specific requirement mentioned.` : ''}

${uploadedFiles && uploadedFiles.length > 0 ? `**UPLOADED DOCUMENTS:** User has uploaded ${uploadedFiles.length} document(s) including: ${uploadedFiles.map(f => f.name).join(', ')}. Consider any existing plans or preferences mentioned in these documents when creating the itinerary.` : ''}

**SPECIAL CONSIDERATIONS:**
${children > 0 ? `- **Family-Friendly Focus**: Include activities suitable for children, family-friendly accommodations, and consider child safety and entertainment
- **Age-Appropriate Activities**: Tailor activities to the children's ages (${childrenAges.join(', ')})
- **Flexible Timing**: Include breaks and downtime suitable for families` : ''}

${dietary && dietary.length > 0 ? `- **Dietary Accommodations**: Ensure all restaurant recommendations accommodate ${dietary.join(', ')} dietary needs
- **Local Cuisine**: Highlight local dishes that fit dietary restrictions` : ''}

${dateMode === 'flexible' ? `- **Flexible Date Optimization**: Suggest the best times within the month for optimal weather, prices, and fewer crowds
- **Price Optimization**: Focus on getting the best value during the flexible period` : ''}

**CRITICAL - REAL-TIME ACCURACY REQUIREMENTS:**
You MUST research current information for ${destination} to ensure accuracy:

**MANDATORY RESEARCH REQUIREMENTS:**
- **Current Prices**: Check real-time prices for hotels, restaurants, attractions
- **Opening Hours**: Verify current opening hours for all recommended places
- **Weather**: Check current weather forecasts for ${start} to ${end}
- **Closures**: Verify no recommended places are permanently closed
- **Seasonal Changes**: Account for seasonal pricing and availability
- **Local Events**: Check for any events that might affect availability

**ACCURACY ENFORCEMENT:**
- If you cannot verify current information, DO NOT recommend that place
- Use phrases like "Check current prices" or "Verify opening hours"
- Include disclaimers about price changes
- Prioritize places with verified current information

**DAILY ITINERARIES REQUIREMENT:**
- Create detailed, specific daily itineraries for each day
- DO NOT use generic "Open Exploration" or placeholder text
- Each day should have specific activities, times, and locations
- Include specific restaurant names and attraction names
- Make it feel like a real, actionable itinerary
- Include relevant booking widgets within each day's activities
- **CRITICAL**: Each day must be unique and specific to the destination
- **CRITICAL**: Include exact times, restaurant names, and attraction names
- **CRITICAL**: Make it family-friendly if children are included
- **CRITICAL**: Consider the starting location (${from || 'user\'s location'}) for flight/transport recommendations

**WIDGET INTEGRATION REQUIREMENTS:**
- DO NOT place widgets in the "Don't Forget List" section
- Place relevant booking widgets within their appropriate sections
- Add flight search widget in the "Getting Around" section
- Add hotel booking widget in the "Accommodation" section
- Add car rental widget in the "Transportation" section
- Add eSIM widget in the "Useful Apps" or "Don't Forget List" section
- Add airport transfers widget in the "Getting Around" section
- Make widgets feel natural and integrated into the content flow

**REPORT QUALITY REQUIREMENTS - ENHANCED:**

**CONTENT RICHNESS REQUIREMENTS:**
1. **Daily Itineraries**: Each day must include:
   - **Exact times** (e.g., "9:00 AM", "2:30 PM", "7:45 PM")
   - **Specific restaurant names** with exact locations (e.g., "Taverna Katina in Amoudi Bay")
   - **Detailed activity descriptions** (e.g., "Visit the Archaeological Site of Akrotiri - ancient Minoan ruins preserved in volcanic ash")
   - **Transportation details** (e.g., "Take the local bus from Fira to Oia, 20-minute ride")
   - **Duration estimates** (e.g., "Wine tasting tour at Santo Wines - 2 hours")
   - **Booking information** (e.g., "Book sunset dinner at Kastro Oia Restaurant - reservations recommended")
   - **Alternative activities** for bad weather
   - **Insider tips** (e.g., "Best time to visit Oia Castle for sunset is 1 hour before sunset")

2. **Restaurant Section**: Include 8-10 specific restaurants with:
   - **Exact names and locations** (e.g., "Pelekanos Restaurant - Fira, near the cable car")
   - **Price ranges** (€€ for mid-range, €€€ for upscale)
   - **Specialties** (e.g., "Famous for fresh seafood and traditional Greek dishes")
   - **Best dishes to try** (e.g., "Must-try: Grilled octopus, Santorini salad, local wine")
   - **Reservation tips** (e.g., "Book 2-3 days in advance for sunset views")
   - **Opening hours** if relevant
   - **Atmosphere description** (e.g., "Cozy family-run taverna with stunning caldera views")

3. **Accommodation Section**: Include 6-8 specific hotels with:
   - **Exact names and locations** (e.g., "Villa Manos - Karterados, 10-minute walk to Fira")
   - **Price ranges per night** (e.g., "€80-120/night")
   - **Room types** (e.g., "Double rooms with private balconies")
   - **Amenities** (e.g., "Free Wi-Fi, pool, breakfast included, airport shuttle")
   - **Distance to attractions** (e.g., "5-minute walk to Fira center, 15-minute drive to Oia")
   - **Booking links and reviews**
   - **Seasonal pricing notes**

4. **Must-See Attractions**: Include 10-12 specific attractions with:
   - **Exact names and locations**
   - **Entry fees** (e.g., "€12 for adults, €6 for children")
   - **Opening hours** (e.g., "8:00 AM - 8:00 PM daily")
   - **Best times to visit** (e.g., "Early morning to avoid crowds")
   - **Booking requirements** (e.g., "Advance booking required for wine tours")
   - **Duration estimates** (e.g., "Allow 2-3 hours for Akrotiri")
   - **Insider tips** (e.g., "Visit Red Beach early morning for best photos")

5. **Budget Breakdown**: Make it realistic with:
   - **Current market prices** in Euros (€)
   - **Per-person and total costs**
   - **Seasonal variations** (e.g., "Summer prices 20% higher")
   - **Currency conversion notes**
   - **Money-saving tips** (e.g., "Book flights 3 months in advance for best rates")
   - **Optional expenses** (e.g., "Wine tours €25-50 per person")

6. **Travel Tips**: Include:
   - **Local customs and etiquette** (e.g., "Greet with 'Kalimera' in morning, 'Kalispera' in evening")
   - **Safety tips** specific to Santorini (e.g., "Be careful on cliff edges, especially at sunset")
   - **Best times for activities** (e.g., "Visit Oia early morning or late afternoon to avoid crowds")
   - **Money-saving tips** (e.g., "Eat lunch at local tavernas, dinner at upscale restaurants")
   - **Cultural insights** (e.g., "Greeks value family time - many shops close 2-4 PM")
   - **Weather considerations** (e.g., "September is perfect - warm but not crowded")

**IMAGE REQUIREMENTS - CONTEXTUAL PLACEMENT:**

**CRITICAL**: Place images contextually within the content, NOT at the end. Each image should appear right after its relevant content section:

1. **After Trip Overview**: ![Santorini sunset Oia Greece](https://source.unsplash.com/400x300/?Santorini,sunset,Oia,Greece)
2. **After Dining Guide**: ![Greek food Santorini taverna](https://source.unsplash.com/400x300/?Greek,food,Santorini,taverna)
3. **After Getting Around**: ![Santorini white buildings caldera](https://source.unsplash.com/400x300/?Santorini,white,buildings,caldera)
4. **After Day 1 itinerary**: ![Santorini architecture blue domes](https://source.unsplash.com/400x300/?Santorini,architecture,blue,domes)
5. **After Day 2 itinerary**: ![Santorini beaches volcanic](https://source.unsplash.com/400x300/?Santorini,beaches,volcanic)
6. **After Day 3 itinerary**: ![Santorini culture local people](https://source.unsplash.com/400x300/?Santorini,culture,local,people)
7. **After Must-See Attractions**: ![Santorini activities wine tasting](https://source.unsplash.com/400x300/?Santorini,activities,wine,tasting)
8. **After Travel Tips**: ![Santorini experience travel](https://source.unsplash.com/400x300/?Santorini,experience,travel)

**PLACEMENT RULES:**
- Place each image IMMEDIATELY after its relevant content section
- DO NOT put all images at the end
- DO NOT create a separate "Image Ideas" section
- DO NOT create any section called "Image Ideas" or "🖼️ Image Ideas"
- Each image should enhance the content it follows
- Use proper HTML img tags with alt text
- Images should be 400x300 pixels
- Make images feel natural and integrated into the content flow
- **CRITICAL**: If you see "Image Ideas" or "🖼️ Image Ideas" in your response, REMOVE IT COMPLETELY
- **ABSOLUTELY FORBIDDEN**: Do not create any section called "Image Ideas", "🖼️ Image Ideas", or "Enhance your travel experience with these beautiful images"
- **ABSOLUTELY FORBIDDEN**: Do not create any numbered list of images at the end of the report
- **ABSOLUTELY FORBIDDEN**: Do not include any text that says "Enhance your travel experience with these beautiful images"
- **MANDATORY**: Place images contextually within the content, NOT at the end
- **MANDATORY**: Each image must appear immediately after its relevant content section
- **CRITICAL**: NEVER create a section called "Image Ideas" or "🖼️ Image Ideas"
- **CRITICAL**: NEVER create any numbered list of images
- **CRITICAL**: NEVER include any text about "Image Ideas" or "Enhance your travel experience"
- **CRITICAL**: NEVER create any section that lists images at the end
- **CRITICAL**: NEVER create any section that contains the words "Image Ideas"
- **CRITICAL**: NEVER create any section that contains the emoji "🖼️"
- **CRITICAL**: NEVER create any section that contains the text "Enhance your travel experience"
- **CRITICAL**: NEVER create any section that contains the text "Here are some beautiful images"
- **CRITICAL**: NEVER create any section that contains the text "Here are some images to inspire"
- **CRITICAL**: NEVER create any section that contains the text "Here are some images"
- **CRITICAL**: NEVER create any section that contains the text "Image Ideas"
- **CRITICAL**: NEVER create any section that contains the text "🖼️ Image Ideas"

**WIDGET INTEGRATION REQUIREMENTS:**
DO NOT place widgets in the "Don't Forget List" section
Widgets should be placed in appropriate sections:
- Flight widget → "Getting Around" section
- Hotel widget → "Accommodation" section
- Car rental widget → "Getting Around" section
- eSIM widget → "Useful Apps" section

**CRITICAL - NO GENERIC CONTENT:**
- **ABSOLUTELY NO "Open Exploration" days** - this is forbidden
- **ABSOLUTELY NO generic placeholders** like "Neighborhood warm-up walk" or "Local market + museum"
- **ABSOLUTELY NO duplicate content** - each day must be unique
- **ABSOLUTELY NO generic activities** - every activity must be specific to Santorini
- **ABSOLUTELY NO "warm-up walk" or "get oriented"** - these are generic placeholders
- **ABSOLUTELY NO "Local market + museum"** - these are generic placeholders
- **ABSOLUTELY NO "Sunset viewpoint & dinner"** - these are generic placeholders

**MANDATORY - SPECIFIC CONTENT ONLY:**
- **Every day must have specific Santorini activities** like "Visit Akrotiri Archaeological Site", "Wine tasting at Santo Wines", "Explore Oia Castle"
- **Every restaurant must be named** like "Taverna Katina", "Pelekanos Restaurant", "Kastro Oia Restaurant"
- **Every attraction must be specific** like "Red Beach", "Fira Caldera", "Museum of Prehistoric Thera"
- **Every time must be exact** like "9:00 AM", "2:30 PM", "7:45 PM"
- **Every location must be specific** like "Amoudi Bay", "Fira", "Oia", "Karterados"

Create a RICH, DETAILED, and PROFESSIONAL report that travelers can actually use to plan their trip. Make it comprehensive, actionable, and visually appealing.

Create the most amazing, detailed, and useful trip plan possible!`;

  if (!client) {
    console.warn('OpenAI API key not set, using local fallback');
    let md = localPlanMarkdown(payload);
    md = ensureDaySections(md, nDays, start);
    return md;
  }
  
  // Exponential backoff retry logic (0s, 1s, 2s, 4s, 8s, 16s - max 6 retries)
  let resp;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      resp = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.7, // Slightly higher for more creative responses
        max_tokens: mode === 'full' ? 16384 : 500, // 16384 for full reports, 500 for previews
        messages: [{ role: "user", content: `${sys}\n\n${user}` }],
        stream: mode === 'full' // Enable streaming for full reports
      });
      break; // Success, exit retry loop
    } catch (retryError) {
      if (attempt === 5) throw retryError; // Last attempt failed
      const delayMs = attempt === 0 ? 0 : Math.pow(2, attempt - 1) * 1000; // 0s, 1s, 2s, 4s, 8s, 16s
      console.log(`OpenAI attempt ${attempt + 1} failed, retrying in ${delayMs}ms:`, retryError.message);
      if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  try {
    let md = "";
    
    // Handle streaming vs non-streaming response with error fallback
    if (mode === 'full') {
      try {
        // Streaming response for full reports
        console.log('Processing streaming response...');
        for await (const chunk of resp) {
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            md += content;
          }
        }
      } catch (streamError) {
        console.warn('Streaming failed, using non-streaming fallback:', streamError.message);
        // Fallback to non-streaming response if available
        md = resp.choices?.[0]?.message?.content?.trim() || "";
      }
    } else {
      // Non-streaming response for previews
      md = resp.choices?.[0]?.message?.content?.trim() || "";
    }
    
    if (!md) {
      console.warn('OpenAI response empty, using fallback');
      md = localPlanMarkdown(payload);
    }
    
    console.log(`AI plan generated successfully for ${mode} mode! Length: ${md.length}`);
    
    // NUCLEAR POST-PROCESSING: Completely eliminate Image Ideas section and generic content
    let lines = md.split('\n');
    let cleanedLines = [];
    let skipSection = false;
    let inImageIdeasSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip any "Open Exploration" days
      if (line.includes('Open Exploration') || line.includes('warm-up walk') || line.includes('get oriented')) {
        skipSection = true;
        continue;
      }
      
      // Detect Image Ideas section - MULTIPLE PATTERNS
      if (line.includes('🖼️ Image Ideas') || 
          line.includes('Image Ideas') || 
          line.includes('Image Ideas:') || 
          line.includes('Enhance your travel experience') ||
          line.includes('Here are some stunning visuals') ||
          line.includes('Here are some beautiful images')) {
        inImageIdeasSection = true;
        skipSection = true;
        continue;
      }
      
      // Skip all content within Image Ideas section
      if (inImageIdeasSection) {
        // Stop when we hit a new section or end
        if (line.startsWith('## ') || line.startsWith('---') || line.includes('Enjoy your') || line.includes('Happy travels')) {
          inImageIdeasSection = false;
          skipSection = false;
        } else {
          continue; // Skip this line
        }
      }
      
      // Skip any numbered lists that are likely image lists
      if (skipSection && (line.match(/^\d+\.\s*!\[/) || line.match(/^\d+\.\s*\*\*/))) {
        continue;
      }
      
      // Stop skipping when we hit a new section
      if (skipSection && (line.startsWith('###') || line.startsWith('##') || line.startsWith('---'))) {
        skipSection = false;
      }
      
      // Add line if we're not skipping
      if (!skipSection && !inImageIdeasSection) {
        cleanedLines.push(line);
      }
    }
    
    md = cleanedLines.join('\n');
    
    // ULTIMATE REGEX CLEANUP: Remove any remaining Image Ideas sections
    md = md.replace(/## 🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/## Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/Enhance your travel experience[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/Here are some stunning visuals[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/Here are some beautiful images[\s\S]*?(?=\n## |\n---|$)/g, '');
    
    // Remove any numbered image lists
    md = md.replace(/\n\d+\.\s*!\[[^\]]*\]\([^)]*\)/g, '');
    md = md.replace(/\n\d+\.\s*\*\*[^*]*\*\*:\s*!\[[^\]]*\]\([^)]*\)/g, '');
    
    // FINAL STRING REPLACEMENT: Remove the entire section
    const imageIdeasIndex = md.indexOf('## 🖼️ Image Ideas');
    if (imageIdeasIndex !== -1) {
      const beforeImageIdeas = md.substring(0, imageIdeasIndex);
      const afterImageIdeas = md.substring(imageIdeasIndex);
      const nextSectionIndex = afterImageIdeas.indexOf('\n---');
      if (nextSectionIndex !== -1) {
        md = beforeImageIdeas + afterImageIdeas.substring(nextSectionIndex);
      } else {
        md = beforeImageIdeas;
      }
    }
    
    // EXTRA SAFETY: Remove any remaining Image Ideas references
    md = md.replace(/## 🖼️ Image Ideas.*$/gm, '');
    md = md.replace(/## Image Ideas.*$/gm, '');
    
    // FINAL NUCLEAR OPTION: Use a very specific regex to remove the entire section (repeated for maximum effect)
    md = md.replace(/## 🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/## 🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/## 🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/## 🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/## 🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    
    // ULTIMATE FINAL CLEANUP: Remove any remaining Image Ideas content with multiple approaches
    md = md.replace(/🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/Here are some beautiful images[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/Here are some stunning visuals[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/Enhance your travel experience[\s\S]*?(?=\n## |\n---|$)/g, '');
    
    // Remove any numbered image lists
    md = md.replace(/\n\d+\.\s*!\[[^\]]*\]\([^)]*\)/g, '');
    md = md.replace(/\n\d+\.\s*\*\*[^*]*\*\*:\s*!\[[^\]]*\]\([^)]*\)/g, '');
    
    // Remove any bullet point image lists
    md = md.replace(/\n-\s*\*\*[^*]*\*\*:\s*!\[[^\]]*\]\([^)]*\)/g, '');
    md = md.replace(/\n-\s*!\[[^\]]*\]\([^)]*\)/g, '');
    
    // Remove numbered lists with bold text and images (the actual format being used)
    md = md.replace(/\n\d+\.\s*\*\*[^*]*\*\*:\s*!\[[^\]]*\]\([^)]*\)/g, '');
    md = md.replace(/\n\d+\.\s*\*\*[^*]*\*\*:\s*<img[^>]*>/g, '');
    
    // Remove any remaining Image Ideas section headers
    md = md.replace(/## 🖼️ Image Ideas.*$/gm, '');
    md = md.replace(/## Image Ideas.*$/gm, '');
    md = md.replace(/🖼️ Image Ideas.*$/gm, '');
    md = md.replace(/Image Ideas.*$/gm, '');
    
    // FINAL NUCLEAR OPTION: Use a very specific regex to remove the entire section (repeated for maximum effect)
    md = md.replace(/## 🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/## 🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/## 🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/## 🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/## 🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    
    // ULTIMATE FINAL CLEANUP: Remove any remaining Image Ideas content with multiple approaches
    md = md.replace(/🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/Here are some beautiful images[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/Here are some stunning visuals[\s\S]*?(?=\n## |\n---|$)/g, '');
    md = md.replace(/Enhance your travel experience[\s\S]*?(?=\n## |\n---|$)/g, '');
    
    // Remove any numbered image lists
    md = md.replace(/\n\d+\.\s*!\[[^\]]*\]\([^)]*\)/g, '');
    md = md.replace(/\n\d+\.\s*\*\*[^*]*\*\*:\s*!\[[^\]]*\]\([^)]*\)/g, '');
    
    // Remove any bullet point image lists
    md = md.replace(/\n-\s*\*\*[^*]*\*\*:\s*!\[[^\]]*\]\([^)]*\)/g, '');
    md = md.replace(/\n-\s*!\[[^\]]*\]\([^)]*\)/g, '');
    
    // Remove numbered lists with bold text and images (the actual format being used)
    md = md.replace(/\n\d+\.\s*\*\*[^*]*\*\*:\s*!\[[^\]]*\]\([^)]*\)/g, '');
    md = md.replace(/\n\d+\.\s*\*\*[^*]*\*\*:\s*<img[^>]*>/g, '');
    
    // Remove any remaining Image Ideas section headers
    md = md.replace(/## 🖼️ Image Ideas.*$/gm, '');
    md = md.replace(/## Image Ideas.*$/gm, '');
    md = md.replace(/🖼️ Image Ideas.*$/gm, '');
    md = md.replace(/Image Ideas.*$/gm, '');
    
    // Enhance the markdown with better formatting
    md = linkifyTokens(md, destination);
    // Only add fallback structured day sections if missing to prevent duplicates
    if (!containsDaySections(md)) {
      md = ensureDaySections(md, nDays, start);
    }
    
    // Add a beautiful header if not present
    if (!md.includes('# ')) {
      md = `# 🗺️ ${destination} — Your Perfect Trip\n\n${md}`;
    }
    
    return md;
  } catch (e) {
    console.error('OpenAI API error:', e);
    return localPlanMarkdown(payload); // Fallback
  }
}
/* API */
app.post('/api/preview', (req, res) => {
  try {
    console.log('Preview request received:', req.body); // Debug
    const payload = req.body || {};
    const currency = payload.currency || 'USD';
    const budgetNum = Number(payload.budget || 0);
    const level = payload.level || 'mid';
    const destination = (payload.destination || 'your destination').toString();
    const from = payload.from || 'your location';
    const dateMode = payload.dateMode || 'exact';
    const adults = Number(payload.adults || 2);
    const children = Number(payload.children || 0);
    const totalTravelers = Math.max(1, adults + children);

    // Normalize budget safely
    payload.budget = normalizeBudget(budgetNum, currency);

    // Duration handling (supports flexible dates)
    const nDays = payload.flexibleDates && Number(payload.flexibleDates.duration)
      ? Number(payload.flexibleDates.duration)
      : (payload.start && payload.end ? daysBetween(payload.start, payload.end) : 5);

    const style = level === 'luxury' ? 'Luxury' : level === 'budget' ? 'Budget' : 'Mid-range';
    const aff = affiliatesFor(destination);
    const id = uid();

    const teaser_html = `
    <div class="preview-teaser">
      <h3>🎯 ${escapeHtml(destination)} Trip Preview</h3>
      <div class="preview-stats">
        <div class="stat">
          <span class="stat-label">Duration</span>
          <span class="stat-value">${nDays} days</span>
        </div>
        <div class="stat">
          <span class="stat-label">Style</span>
          <span class="stat-value">${escapeHtml(style)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Travelers</span>
          <span class="stat-value">${adults} adults${children ? ` + ${children} children` : ''}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Budget</span>
          <span class="stat-value">$${Number(budgetNum || 0).toLocaleString()}</span>
        </div>
        ${from !== 'your location' ? `
        <div class="stat">
          <span class="stat-label">From</span>
          <span class="stat-value">${from}</span>
        </div>
        ` : ''}
        ${dateMode === 'flexible' ? `
        <div class="stat">
          <span class="stat-label">Date Mode</span>
          <span class="stat-value">Flexible (best prices)</span>
        </div>
        ` : ''}
      </div>
      <p class="preview-description">
        Ready to create your personalized ${nDays}-day ${style.toLowerCase()} adventure in ${escapeHtml(destination)}?
        Our AI will craft a detailed itinerary with hotels, activities, dining, and insider tips.
        ${children > 0 ? 'We\'ll include family-friendly activities and accommodations suitable for children.' : ''}
      </p>
      <div class="preview-features">
        <span class="feature">🗺️ Custom routes</span>
        <span class="feature">🏨 Hotel picks</span>
        <span class="feature">🍽️ Restaurant guide</span>
        <span class="feature">🎫 Activity booking</span>
        <span class="feature">📱 Mobile-friendly</span>
        <span class="feature">📄 PDF export</span>
        ${children > 0 ? '<span class="feature">👶 Family-friendly</span>' : ''}
        ${payload.dietary && payload.dietary.length > 0 ? '<span class="feature">🥗 Dietary options</span>' : ''}
      </div>
      <p class="preview-cta">
        <strong>Click "Generate full plan" to create your complete itinerary!</strong>
      </p>
    </div>
    `;

    res.json({ id, teaser_html, affiliates: aff, version: VERSION });
  } catch (e) {
    console.error('Preview endpoint error:', e);
    res.status(200).json({ id: uid(), teaser_html: '<p class="error">Unable to build preview right now.</p>', affiliates: {}, version: VERSION });
  }
});

app.post('/api/plan', async (req, res) => {
  console.log('Plan request received:', req.body); // Debug
  try {
    const payload = req.body || {};
    payload.currency = payload.currency || 'USD';
    payload.budget = normalizeBudget(payload.budget, payload.currency);
    payload.mode = 'full'; // Set mode for full reports with 16384 tokens
    const id = uid();
    const markdown = await generatePlanWithAI(payload);
    
    // Process image tokens and other links in the MARKDOWN first
    const processedMarkdown = linkifyTokens(markdown, payload.destination);
    
    // Post-process to remove images from forbidden sections
    const cleanedMarkdown = removeImagesFromForbiddenSections(processedMarkdown, payload.destination);
    
    // Then convert to HTML
    const html = marked.parse(cleanedMarkdown);
    
    // Add affiliate widgets integrated into appropriate sections
    const widgets = getWidgetsForDestination(payload.destination, payload.level, []);
    let finalHTML;
    try {
      finalHTML = injectWidgetsIntoSections(html, widgets, payload.destination);
    } catch (widgetError) {
      console.error('Widget injection failed:', widgetError);
      finalHTML = html; // Fallback to HTML without widgets
    }
    
    // Remove any duplicate content that might have been generated
    const cleanedHTML = finalHTML.replace(
      /(Day \d+ — Open Exploration.*?Evening: Sunset viewpoint & dinner\. Map · Book\s*)+/gs,
      ''
    ).replace(
      /(Open Exploration.*?Map · Book\s*)+/gs,
      ''
    ).replace(
      /(Day \d+ — Open Exploration.*?Book\s*)+/gs,
      ''
    ).replace(
      /(<h3>Day \d+ — Open Exploration.*?<\/ul>\s*)+/gs,
      ''
    ).replace(
      /(### Day \d+ — Open Exploration.*?Book<\/a><\/li>\s*<\/ul>\s*)+/gs,
      ''
    );
    
    const aff = affiliatesFor(payload.destination);
    
    // Save plan to database with error handling
    try {
      const planData = { id, type: 'plan', data: payload, markdown };
      console.log('Saving plan:', { id, destination: payload.destination, length: markdown.length });
      savePlan.run(id, nowIso(), JSON.stringify(planData));
      console.log(`Plan saved with ID: ${id}`);
    } catch (dbError) {
      console.error('Failed to save plan to database:', dbError);
      // Continue execution - don't fail the request if DB save fails
    }
    
    // Track plan generation for analytics
    try {
      trackPlanGeneration(payload);
    } catch (trackError) {
      console.error('Failed to track plan generation:', trackError);
      // Continue execution - don't fail the request if tracking fails
    }
    
    res.json({ id, markdown, html: cleanedHTML, affiliates: aff, version: VERSION });
  } catch (e) {
    console.error('Plan generation error:', e);
    res.status(500).json({ error: 'Failed to generate plan. Check server logs.', version: VERSION });
  }
});

// Generate and return a PDF of the plan
app.post('/api/plan.pdf', async (req, res) => {
  console.log('PDF plan request received:', req.body);
  try {
    const payload = req.body || {};
    payload.currency = payload.currency || 'USD';
    payload.budget = normalizeBudget(payload.budget, payload.currency);
    const markdown = await generatePlanWithAI(payload);

    // Process image tokens and other links first
    const processedMarkdown = linkifyTokens(markdown, payload.destination);
    const cleanedMarkdown = removeImagesFromForbiddenSections(processedMarkdown, payload.destination);
    const html = marked.parse(cleanedMarkdown);
    const widgets = getWidgetsForDestination(payload.destination, payload.level, []);
    let finalHTML;
    try {
      finalHTML = injectWidgetsIntoSections(html, widgets, payload.destination);
    } catch (widgetError) {
      console.error('Widget injection failed in PDF generation:', widgetError);
      finalHTML = html; // Fallback to HTML without widgets
    }

    const fullHtml = `<!doctype html><html><head>
      <meta charset="utf-8">
      <title>Wayzo Trip Plan - ${escapeHtml(payload.destination || '')}</title>
      <style>
        body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        img { max-width: 100%; height: auto; }
        h1, h2, h3 { page-break-after: avoid; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .budget-table { border-collapse: collapse; border: 1px solid black; width: 100%; margin: 10px 0; }
        .budget-table th { background: #f5f5f5; border: 1px solid black; padding: 8px; font-weight: bold; }
        .budget-table td { border: 1px solid black; padding: 8px; }
        .budget-checkbox { margin-right: 8px; }
        .status-pending { color: #ff6b35; font-weight: bold; }
        .status-total { color: #2d5a87; font-weight: bold; }
        .page-break { page-break-before: always; }
      </style>
    </head><body>
      ${finalHTML}
    </body></html>`;

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="wayzo-trip-plan.pdf"');
    res.send(pdfBuffer);
  } catch (e) {
    console.error('PDF generation error:', e);
    res.status(500).json({ error: 'Failed to generate PDF. Check server logs.', version: VERSION });
  }
});

// Widget injection now handled in widgets.mjs using jsdom
app.get('/api/analytics', (req, res) => {
  try {
    // Get basic analytics from database
    const totalPlans = db.prepare('SELECT COUNT(*) as count FROM plans').get().count;
    const today = new Date().toISOString().split('T')[0];
    const todayPlans = db.prepare('SELECT COUNT(*) as count FROM plans WHERE DATE(created_at) = ?').get(today).count;
    
    // Get destination breakdown
    const destinations = db.prepare(`
      SELECT 
        JSON_EXTRACT(payload, '$.data.destination') as destination,
        COUNT(*) as count
      FROM plans 
      WHERE JSON_EXTRACT(payload, '$.data.destination') IS NOT NULL
      GROUP BY JSON_EXTRACT(payload, '$.data.destination')
      ORDER BY count DESC
      LIMIT 10
    `).all();
    
    const destinationData = {};
    destinations.forEach(row => {
      if (row.destination) {
        destinationData[row.destination] = row.count;
      }
    });
    
    // Calculate conversion rate (simplified - you can enhance this)
    const conversionRate = totalPlans > 0 ? Math.round((todayPlans / totalPlans) * 100) : 0;
    
    const analytics = {
      totalPlans,
      todayPlans,
      affiliateClicks: 0, // This would come from tracking data
      conversionRate,
      destinations: destinationData,
      revenue: {} // This would come from affiliate tracking
    };
    
    res.json(analytics);
  } catch (e) {
    console.error('Analytics error:', e);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Event tracking endpoint
app.post('/api/track', (req, res) => {
  try {
    const eventData = req.body;
    console.log('Event tracked:', eventData);
    
    // Store event in database for analytics
    const eventId = uid();
    db.prepare(`
      INSERT INTO events (id, event_type, user_id, data, created_at) 
      VALUES (?, ?, ?, ?, ?)
    `).run(
      eventId,
      eventData.event,
      eventData.userId || 'anonymous',
      JSON.stringify(eventData),
      new Date().toISOString()
    );
    
    res.json({ success: true, eventId });
  } catch (e) {
    console.error('Event tracking error:', e);
    res.status(500).json({ error: 'Failed to track event' });
  }
});
app.get('/api/plan/:id/pdf', (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Wayzo Trip Report</title><style>body{font:16px/1.6 system-ui;margin:24px;color:#0f172a}.card{border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#fff}</style></head><body><div class="card"><h2>Report not found</h2><p>We couldn't find a saved plan for ID <code>${escapeHtml(id)}</code>. Please generate a plan again and retry the download.</p><p><a href="/">← Back to Wayzo</a></p></div></body></html>`);
  }
  const saved = JSON.parse(row.payload || '{}');
  const d = saved?.data || {};
  d.currency = d.currency || 'USD';
  const md = saved?.markdown || '';
  const htmlBody = marked.parse(md);
  const style = d.level === "luxury" ? "Luxury" : d.level === "budget" ? "Budget" : "Mid-range";
  const season = seasonFromDate(d.start);
  const days = daysBetween(d.start, d.end);
  const pppd = perPersonPerDay(normalizeBudget(d.budget, d.currency), days, Math.max(1, (d.adults || 0) + (d.children || 0)));
  const traveler = travelerLabel(d.adults || 0, d.children || 0);
  const cur = d.currency || 'USD';
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
  article{margin-top:16px}
</style>
</head><body>
<header>
  <div class="logo"><div class="badge">WZ</div><strong>Wayzo Trip Report</strong></div>
  <div class="summary">
    <span class="chip"><b>Destination:</b> ${escapeHtml(d.destination || 'Trip')}</span>
    <span class="chip"><b>Travelers:</b> ${traveler}</span>
    <span class="chip"><b>Style:</b> ${style}${d.prefs ? ` · ${escapeHtml(d.prefs)}` : ""}</span>
    <span class="chip"><b>Budget:</b> ${normalizeBudget(d.budget, cur)} ${cur} (${pppd}/day/person)</span>
    <span class="chip"><b>Season:</b> ${season}</span>
  </div>
</header>
<div class="actions">
  <a href="${icsUrl}">Add to Calendar (ICS)</a>
  <a href="${shareX}" target="_blank" rel="noopener">Share</a>
</div>
<article>
  ${htmlBody || '<p class="muted">No content.</p>'}
</article>
<footer>
  <p>Generated by Wayzo — ${new Date().toLocaleString()}</p>
</footer>
</body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});
app.get('/api/plan/:id/ics', (_req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) return res.status(404).json({ error: 'Plan not found' });
  const saved = JSON.parse(row.payload || '{}');
  const md = saved.markdown || '';
  const dest = saved?.data?.destination || 'Trip';
  const events = [];
  const rx = /^## Day (\d+)(?::\s*(.+))?$/gm;
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
// Legal pages - must be defined before the catch-all route
app.get('/privacy', (_req, res) => {
  const privacyFile = path.join(FRONTEND, 'privacy.html');
  if (fs.existsSync(privacyFile)) {
    res.sendFile(privacyFile);
  } else {
    res.status(404).send('Privacy Policy not found');
  }
});

app.get('/terms', (_req, res) => {
  const termsFile = path.join(FRONTEND, 'terms.html');
  if (fs.existsSync(termsFile)) {
    res.sendFile(termsFile);
  } else {
    res.status(404).send('Terms & Conditions not found');
  }
});

app.get('/cookies', (_req, res) => {
  const cookiesFile = path.join(FRONTEND, 'cookies.html');
  if (fs.existsSync(cookiesFile)) {
    res.sendFile(cookiesFile);
  } else {
    res.status(404).send('Cookie Policy not found');
  }
});

app.get('/contact', (_req, res) => {
  const contactFile = path.join(FRONTEND, 'contact.html');
  if (fs.existsSync(contactFile)) {
    res.sendFile(contactFile);
  } else {
    res.status(404).send('Contact page not found');
  }
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

// Event tracking endpoint
app.post('/api/track', (req, res) => {
  try {
    const eventData = req.body || {};
    console.log('Event tracked:', eventData);
    // Store event in database for analytics
    const eventId = uid();
    db.prepare(`
      INSERT INTO events (id, event_type, user_id, data, created_at) 
      VALUES (?, ?, ?, ?, ?)
    `).run(
      eventId,
      eventData.event || 'unknown',
      eventData.userId || 'anonymous',
      JSON.stringify(eventData),
      new Date().toISOString()
    );
    res.json({ success: true, eventId });
  } catch (e) {
    console.warn('Event tracking error (non-fatal):', e);
    // Never fail client flows due to analytics
    res.json({ success: false });
  }
});

// Payment confirmation (basic logging; extend with validation)
app.post('/api/pay/confirm', (req, res) => {
  const { orderID, total, currency } = req.body || {};
  console.log('Payment confirmed:', { orderID, total, currency });
  try {
    const eventId = uid();
    db.prepare(`
      INSERT INTO events (id, event_type, user_id, data, created_at)
      VALUES (?, 'payment_confirmed', ?, ?, ?)
    `).run(
      eventId,
      'anonymous',
      JSON.stringify({ orderID, total, currency }),
      new Date().toISOString()
    );
  } catch (e) { console.warn('Payment event log failed:', e); }
  res.json({ success: true, orderID });
});// Trigger redeploy
