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
import { generateBookingRecommendations, WEATHER_IMPACT, CROWD_PATTERNS } from './lib/smart-booking.mjs';
const VERSION = 'staging-v64';
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

// Debug endpoint with memory tracking and API status
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
    api: {
      openai_configured: !!process.env.OPENAI_API_KEY,
      openai_key_length: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
      wayzo_model: process.env.WAYZO_MODEL || 'gpt-5-nano-2025-08-07',
      client_initialized: !!getOpenAIClient()
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
/* Smart Booking Context Generator */
function generateSmartBookingContext(destination, startDate, groupSize) {
  const date = new Date(startDate);
  const recommendations = generateBookingRecommendations(destination, 'general', startDate, '10:00-12:00', groupSize);

  let context = '';

  // Add major holiday/event warnings
  if (recommendations.warnings.length > 0) {
    context += `\n**🚨 IMPORTANT BOOKING ALERTS:**\n`;
    recommendations.warnings.forEach(warning => {
      context += `- ${warning}\n`;
    });
  }

  // Add special opportunities
  if (recommendations.opportunities.length > 0) {
    context += `\n**🎉 SPECIAL EVENTS DURING YOUR VISIT:**\n`;
    recommendations.opportunities.forEach(opportunity => {
      context += `- ${opportunity}\n`;
    });
  }

  // Add general recommendations
  if (recommendations.recommendations.length > 0) {
    context += `\n**💡 SMART BOOKING TIPS:**\n`;
    recommendations.recommendations.forEach(rec => {
      context += `- ${rec}\n`;
    });
  }

  return context;
}

/* Local Fallback Plan */
function localPlanMarkdown(input) {
  const { destination = 'Your destination', start = 'start', end = 'end', budget = 1500, adults = 2, children = 0, level = 'mid', prefs = '', diet = '', currency = 'USD $', tripPurpose = 'leisure' } = input || {};
  const nDays = daysBetween(start, end);
  const b = computeBudget(budget, nDays, level, Math.max(1, adults + children), destination, tripPurpose);
  const style = level === "luxury" ? "Luxury" : level === "budget" ? "Budget" : "Mid-range";
  const pppd = perPersonPerDay(budget, nDays, Math.max(1, adults + children));

  // Generate smart booking context for this trip
  let smartBookingContext = '';
  try {
    smartBookingContext = generateSmartBookingContext(destination, start, adults + children);
  } catch (error) {
    console.warn('Smart Booking Intelligence error in fallback:', error);
    smartBookingContext = 'No specific booking intelligence available for this destination.';
  }

  return linkifyTokens(`
# ${destination} — ${start} → ${end}
**Travelers:** ${travelerLabel(adults, children)}
**Style:** ${style}${prefs ? ` · ${prefs}` : ""}
**Budget:** ${budget} ${currency} (${pppd}/day/person)
**Season:** ${seasonFromDate(start)}${smartBookingContext}
---
## 🎯 Your Journey at a Glance
Experience the magic of ${destination} over ${nDays} unforgettable ${nDays === 1 ? 'day' : 'days'}. This carefully curated ${level} adventure is designed for ${adults + children} traveler${adults + children === 1 ? '' : 's'}, blending must-see highlights with authentic local experiences. From ${seasonFromDate(start)} weather to hidden gems, every detail has been thoughtfully planned for your perfect getaway.
---
## 💰 Budget Overview
**Total: ${budget} ${currency}** (${pppd}/person/day)

- 🏨 Stay: **${b.stay.total}** (${b.stay.perDay}/day)
- 🍽️ Food: **${b.food.total}** (${b.food.perDay}/day)
- 🎫 Activities: **${b.act.total}** (${b.act.perDay}/day)
- 🚌 Transport: **${b.transit.total}** (${b.transit.perDay}/day)${b.equipment && b.equipment.total > 0 ? `\n- 🎿 Equipment: **${b.equipment.total}** (${b.equipment.perDay}/day)` : ''}
---
## 🎭 Daily Itineraries
### Day 1 — Arrival & Relaxation (${start})
- 09:00 — Arrive and check-in. [Map](map:${destination} airport to hotel)
- 12:00 — Lunch near hotel.
- 14:00 — Gentle neighborhood walk.
- 16:00 — Short rest.
- 18:00 — Local dinner. [Map](map:${destination} dinner)
- 20:00 — Early night.
### Day 2 — Downtown Exploration
- 08:30 — Breakfast cafe.
- 09:30 — City tower lookout. [Tickets](https://www.getyourguide.com/s/?q=${destination}+tower&partner_id=PUHVJ53)
- 12:00 — Lunch spot.
- 13:30 — Notable museum. [Tickets](https://www.getyourguide.com/s/?q=${destination}+museum&partner_id=PUHVJ53)
- 17:00 — Riverfront stroll. [Map](map:${destination} waterfront)
- 19:00 — Dinner.
### Day 3 — Nature & Parks
- 08:30 — Breakfast.
- 09:30 — Big park walk.
- 12:00 — Picnic. [Map](map:${destination} picnic spots)
- 14:00 — Playground time.
- 16:00 — Cafe break.
- 18:30 — Family dinner.
`.trim(), destination);
}
function containsDaySections(md = "") {
  try { return /(^|\n)\s*#{0,6}\s*Day\s+\d+/i.test(md); } catch { return false; }
}
/* OpenAI (dynamic initialization) */
function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  try {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (error) {
    console.error('Failed to initialize OpenAI client:', error);
    return null;
  }
}
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
    mode = 'full',
    arrivalTime = '',
    departureTime = '',
    tripPurpose = 'leisure'
  } = payload || {};

  // Normalize dietary to always be an array
  const normalizedDietary = Array.isArray(dietary) ? dietary : (dietary && dietary.trim() ? [dietary.trim()] : []);

  const nDays = dateMode === 'flexible' && flexibleDates ? flexibleDates.duration : daysBetween(start, end);
  const totalTravelers = adults + children;
  
  const sys = `Create a complete ${nDays}-day itinerary for ${destination} from ${start} to ${end}, 2 adults, ${budget} USD budget.

${uploadedFiles && uploadedFiles.some(f => f.type && f.type.startsWith('image/')) ?
`**IMPORTANT**: The user has provided images that may show their travel style preferences, destination inspiration, or specific interests. Analyze these images carefully and incorporate insights into the itinerary recommendations. Consider:
- Visual preferences and travel style shown in images
- Types of experiences, accommodations, or activities depicted
- Photography interests or scenic preferences
- Adventure level or comfort preferences shown

Use these visual insights to personalize recommendations throughout the itinerary.

` : ''}Start immediately with the content in this format:

# ${destination} — ${start} → ${end}

## 🎯 Your Journey at a Glance
Write a warm, personal welcome that makes the traveler excited about their upcoming adventure. Start with something like "Experience the magic of..." or "Your ${nDays}-day journey to..." Focus on what makes this destination special and what awaits them. Avoid AI-sounding language and make it feel like a knowledgeable friend is describing their trip.

## 💰 Budget Overview
Provide a realistic cost breakdown for ${nDays} days in ${destination} for ${adults + children} travelers, ${level} style travel. Include accommodation (${nDays} nights), meals, activities, and transportation. Give ranges rather than exact figures and explain what's included in each category.${destination.toLowerCase().includes('ski') || destination.toLowerCase().includes('bansko') || destination.toLowerCase().includes('alps') || professional_brief?.toLowerCase().includes('ski') ? ' Include equipment rental costs for ski gear, lessons, and lift passes.' : ''}

## 🗺️ Getting Around
[transportation options, tips, getting from/to airport]

## 🏨 Where to Stay
Recommend 3-4 excellent hotels in ${destination} suitable for ${level} travelers. Include specific property names, addresses, estimated rates per night for ${nDays} nights, and what makes each special. Add [Book Now] links and brief descriptions of location advantages.

## 🎫 Must-See Attractions
**Context-Aware Attraction Booking:** 8-12 main attractions with smart booking integration:
- **Paid attractions:** [Book Entry Tickets](https://www.getyourguide.com/s/?q=${destination}+ATTRACTION_NAME&partner_id=PUHVJ53) for museums, tours, experiences
- **Free attractions:** [Get Directions] [Find Nearby Tours] links instead of booking
- **Group activities:** [Book for ${adults + children} People] for tours and experiences
- **Time-sensitive:** [Check Availability] for popular attractions that book up
- **Section context:** Only show relevant booking options per attraction type

**Attraction Booking**: Use booking links for activities where relevant.

## 🍽️ Dining Guide
[6-10 restaurants by area with price ranges and specialties]

## 🎭 Daily Itineraries
**Time-Blocked Daily Structure for Mobile-Friendly Format:**
- **Day Format:** **Day X - Date (YYYY-MM-DD)**
- **Time Blocks:** Organize each day into clear time sections:
  - **🌅 MORNING (9:00-12:00):** Early activities, museums, sightseeing
  - **🌞 AFTERNOON (12:00-17:00):** Main activities, lunch, major attractions
  - **🌆 EVENING (17:00-21:00):** Dinner, leisure, entertainment
- **Activity Format:** For each time block, list:
  - **Activity Name** with duration estimate
  - **Location/Address** for navigation
  - **Activity-Specific Booking Buttons** (choose based on activity type):
    - **Museums/Attractions:** [Buy Tickets] + [Check Hours]
    - **Restaurants:** [Reserve Table] + [View Menu]
    - **Tours/Activities:** [Book Experience] + [Details]
    - **Transport:** [Book Ride] + [Directions]
    - **Hotels:** [Check Availability] + [Photos]
    - **General:** [Book Now] + [More Info]
  - **[Map](map:VENUE_NAME+${destination})** for each location
  - **Booking Options:** Include relevant booking links for each activity type
  - **Smart Booking Intelligence:** Add contextual booking advice where relevant:
    - **Peak Hours:** "⏰ Visit before 10 AM to avoid crowds"
    - **Holiday Warnings:** "🚨 Bastille Day (July 14): Expect huge crowds, book early"
    - **Local Events:** "🎉 Fashion Week happening - unique atmosphere but higher prices"
    - **Weather Tips:** "☔ Rainy day perfect for indoor museums"
    - **Group Optimization:** "👥 Groups 6+: Call ahead for reservations"
    - **Seasonal Notes:** "🌸 Cherry blossom season: Peak tourism, book months ahead"
    - **Time Optimization:** "🍽️ Lunch 12-2 PM: Book ahead, prix fixe menus available"
- **Mobile Optimization:** Clear visual separation between time blocks, easy scanning


## 🧳 Don't Forget List
Essential items to pack for your ${destination} adventure.

## 🛡️ Travel Tips
Essential travel advice for ${destination}: local customs, currency, safety tips, and practical guidance.

## 📱 Useful Apps
Must-have mobile apps for navigating ${destination} and enhancing your travel experience.

## 🚨 Emergency Info
**Essential Emergency Information for ${destination}:**
- **General Emergency**: Local emergency services number
- **Police & Fire**: Emergency contact numbers
- **Medical Emergency**: Ambulance and hospital emergency numbers
- **Tourist Police**: Tourist assistance services (if available)
- **Embassy Contact**: Embassy/consulate contact information
- **Local Healthcare**: Nearest hospitals and medical facilities
- **Important Local Numbers**: Destination-specific emergency services

## ⚠️ Disclaimer
*Prices and availability subject to change. Verify details before booking.*

Generate the complete travel itinerary now using all the sections listed above.`;

  // Trip context appended to system prompt (single prompt approach)
  const user = `Create an AMAZING trip plan for:

**Destination:** ${destination}
${from ? `**Traveling From:** ${from}` : ''}
**Dates:** ${dateMode === 'flexible' ? `Flexible dates in ${flexibleDates?.month || 'selected month'} for ${nDays} days` : `${start} to ${end} (${nDays} days)`}
**Travelers:** ${adults} adults${children ? `, ${children} children${childrenAges.length > 0 ? ` (ages: ${childrenAges.join(', ')})` : ''}` : ''}
**Style:** ${level}${prefs ? ` + ${prefs}` : ""}
**Trip Purpose:** ${tripPurpose || 'leisure'} - Adjust itinerary pacing and activities accordingly (business = efficient timing, leisure = relaxed pace, day-trips = local focus)

**Flight Schedule:**
${arrivalTime ? `- Arrival Time: ${arrivalTime} on Day 1 - adjust first day activities accordingly` : '- Arrival Time: Not specified'}
${departureTime ? `- Departure Time: ${departureTime} on Day ${nDays} - ensure checkout/departure logistics are included` : '- Departure Time: Not specified'}
**Budget:** ${budget} ${currency} (${Math.round(budget / nDays / totalTravelers)} per person per day)
${normalizedDietary && normalizedDietary.length > 0 ? `**Dietary Needs:** ${normalizedDietary.join(', ')}` : ''}

${professional_brief ? `**PROFESSIONAL BRIEF:** ${professional_brief}

Use this detailed brief to create a highly personalized plan that addresses every specific requirement mentioned.` : ''}

${uploadedFiles && uploadedFiles.length > 0 ? `**UPLOADED DOCUMENTS:** User has uploaded ${uploadedFiles.length} document(s) including: ${uploadedFiles.map(f => f.name).join(', ')}. Consider any existing plans or preferences mentioned in these documents when creating the itinerary.` : ''}

**SMART BOOKING INTELLIGENCE:**
${(() => {
  try {
    return generateSmartBookingContext(destination, start, adults + children);
  } catch (error) {
    console.warn('Smart Booking Intelligence error:', error);
    return 'No specific booking intelligence available for this destination.';
  }
})()}

**SPECIAL CONSIDERATIONS:**
${children > 0 ? `- **Family-Friendly Focus**: Include activities suitable for children, family-friendly accommodations, and consider child safety and entertainment
- **Age-Appropriate Activities**: Tailor activities to the children's ages (${childrenAges.join(', ')})
- **Flexible Timing**: Include breaks and downtime suitable for families` : ''}

${normalizedDietary && normalizedDietary.length > 0 ? `- **Dietary Accommodations**: Ensure all restaurant recommendations accommodate ${normalizedDietary.join(', ')} dietary needs
- **Local Cuisine**: Highlight local dishes that fit dietary restrictions` : ''}

${dateMode === 'flexible' ? `- **Flexible Date Optimization**: Suggest the best times within the month for optimal weather, prices, and fewer crowds
- **Price Optimization**: Focus on getting the best value during the flexible period` : ''}

**CONTENT REQUIREMENTS:**
- Create comprehensive, detailed itinerary with specific venue names and activities
- Include realistic pricing estimates based on destination and travel style
- Always complete the full itinerary - never stop mid-generation or ask for user input
- Present definitive recommendations without verification notes

**SKI DESTINATION SPECIFIC REQUIREMENTS:**
${destination.toLowerCase().includes('ski') || destination.toLowerCase().includes('bansko') || destination.toLowerCase().includes('alps') || professional_brief?.toLowerCase().includes('ski') ? `
- **SKI FOCUS**: This is a SKI VACATION - center everything around skiing activities
- **Daily Ski Schedule**: Each day should include morning/afternoon ski sessions with specific lift recommendations
- **Equipment Rental**: Include specific ski rental shops with estimated costs
- **Ski Passes**: Detail lift pass prices and multi-day options
- **Ski Schools**: Recommend lessons for different skill levels if applicable
- **Après-ski**: Include traditional après-ski dining and entertainment
- **Weather Considerations**: Account for skiing weather conditions and backup indoor activities
- **Ski-Specific Dining**: Recommend mountain restaurants and ski lodge dining
- **Equipment Lists**: Include ski-specific packing recommendations
- **Slope Recommendations**: Detail beginner, intermediate, and advanced slopes available
` : ''}



Create a comprehensive and professional travel guide that provides actionable recommendations for an amazing ${destination} experience.

Create the most amazing, detailed, and useful trip plan possible!`;

  const client = getOpenAIClient();
  console.log('🔍 OpenAI Client Debug:');
  console.log('- API Key exists:', !!process.env.OPENAI_API_KEY);
  console.log('- API Key length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
  console.log('- Client initialized:', !!client);
  console.log('- Preferred model:', process.env.WAYZO_MODEL || 'gpt-5-nano-2025-08-07');

  if (!client) {
    console.warn('❌ OpenAI client is null - using local fallback');
    console.warn('❌ This means API calls will NOT be made');
    let md = localPlanMarkdown(payload);
    md = ensureDaySections(md, nDays, start);
    return md;
  }

  console.log('✅ OpenAI client ready - proceeding with API call');

  // Model selection and retry logic with image support
  const preferredModel = process.env.WAYZO_MODEL || 'gpt-5-nano-2025-08-07';
  const fallbackModel = 'gpt-4o-mini-2024-07-18';
  const visionModel = 'gpt-4o-2024-08-06'; // Vision-capable model for images
  const isNano = preferredModel.includes('gpt-5-nano');
  const hasImages = uploadedFiles && uploadedFiles.some(file => file.type && file.type.startsWith('image/'));
  const maxTokens = mode === 'full' ? (isNano ? 128000 : 16384) : 500;

  let respText = '';

  // Prepare messages with image support
  const prepareMessages = () => {
    if (hasImages) {
      // Use vision model for images
      const content = [
        { type: 'text', text: `${sys}\n\n${user}` }
      ];

      // Add images to content
      uploadedFiles.forEach(file => {
        if (file.type && file.type.startsWith('image/')) {
          if (file.url) {
            // URL format
            content.push({
              type: 'image_url',
              image_url: { url: file.url }
            });
          } else if (file.data) {
            // Base64 format - ensure proper data URL format
            const mimeType = file.type || 'image/jpeg';
            const dataUrl = file.data.startsWith('data:') ? file.data : `data:${mimeType};base64,${file.data}`;
            content.push({
              type: 'image_url',
              image_url: { url: dataUrl }
            });
          }
        }
      });

      return [{ role: 'user', content }];
    } else {
      // Text-only messages
      return [{ role: 'user', content: `${sys}\n\n${user}` }];
    }
  };

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      console.log(`🔄 API Attempt ${attempt + 1}/8 starting...`);

      if (hasImages) {
        console.log(`📸 Using vision model: ${visionModel}`);
        const messages = prepareMessages();
        const resp = await client.chat.completions.create({
          model: visionModel,
          max_tokens: maxTokens,
          messages,
          stream: false,
        });
        respText = resp.choices?.[0]?.message?.content || '';
        console.log(`✅ API call success: model=${visionModel}, max_tokens=${maxTokens}, images=${uploadedFiles.filter(f => f.type?.startsWith('image/')).length}`);
      } else if (isNano) {
        console.log(`🔬 Using nano model: ${preferredModel}`);
        const resp = await client.responses.create({
          model: preferredModel,
          input: `${sys}\n\n${user}`,
          max_output_tokens: maxTokens,
        });
        console.log('🔍 RAW NANO RESPONSE:', JSON.stringify(resp, null, 2));
        respText = resp.output_text || resp?.output?.[0]?.content?.[0]?.text || resp?.content || '';
        console.log('🔍 EXTRACTED TEXT:', respText ? respText.substring(0, 100) + '...' : 'EMPTY');
        console.log(`✅ API call success: model=${preferredModel}, max_tokens=${maxTokens}`);
      } else {
        console.log(`🤖 Using fallback model: ${fallbackModel}`);
        const resp = await client.chat.completions.create({
          model: fallbackModel,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: `${sys}\n\n${user}` }],
          stream: false,
        });
        respText = resp.choices?.[0]?.message?.content || '';
        console.log(`✅ API call success: model=${fallbackModel}, max_tokens=${maxTokens}`);
      }
      if (respText) break;
      throw new Error('Empty response text');
    } catch (retryError) {
      console.error(`❌ API Attempt ${attempt + 1} failed:`, retryError.message);
      const delayMs = attempt === 0 ? 0 : Math.pow(2, attempt - 1) * 1000;
      console.warn(`AI attempt ${attempt + 1} failed: ${retryError.message}. Retrying in ${delayMs}ms`);
      if (attempt === 3 && isNano) {
        // Switch to fallback model after a few Nano failures
        console.warn('Switching to fallback chat completions model');
      }
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      if (attempt >= 3 && isNano) {
        // Switch to fallback model for remaining attempts
        // eslint-disable-next-line no-var
        var switched = true; // hint for logs
        // eslint-disable-next-line no-undef
        isNano = false; // note: only affects branch usage below; safe as we re-evaluate each loop
      }
    }
  }
  
  try {
    
    let md = (respText || '').trim();
    if (!md) {
      console.warn('OpenAI response empty, using fallback');
      md = localPlanMarkdown(payload);
    }
    
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
      finalHTML = await injectWidgetsIntoSections(html, widgets, payload.destination, payload.start, payload.end, payload);
    } catch (widgetError) {
      console.error('Widget injection failed:', widgetError);
      finalHTML = html; // Fallback to HTML without widgets
    }
    
    // Remove any duplicate content and widget duplications that might have been generated
    const cleanedHTML = finalHTML
      // Remove the specific "Activities Evening: Sunset viewpoint & dinner" duplications
      .replace(
        /(Activities\s*Evening:\s*Sunset viewpoint & dinner\.\s*Map\s*·\s*Book Hotel\s*)+/gs,
        ''
      )
      // Remove GetYourGuide widget duplications
      .replace(
        /(<div[^>]*data-gyg-[^>]*>.*?<\/div>\s*)+/gs,
        '$1'
      )
      // Original cleanup patterns
      .replace(
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
    
    // Add public transport map at the end of the report
    const markdownWithMap = markdown + `\n\n---\n\n[Open ${payload.destination} Public Transport Map](map:${payload.destination}+public+transport+map)`;
    
    // Save plan to database with error handling
    try {
      const planData = { id, type: 'plan', data: payload, markdown: markdownWithMap };
      console.log('Saving plan:', { id, destination: payload.destination, length: markdownWithMap.length });
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
    
    res.status(200).json({ id, markdown: markdownWithMap, html: cleanedHTML, affiliates: aff, version: VERSION });
  } catch (e) {
    console.error('Plan generation error:', e);
    try {
      const payload = req.body || {};
      payload.currency = payload.currency || 'USD';
      payload.budget = normalizeBudget(payload.budget, payload.currency);
      const id = uid();
      const markdown = localPlanMarkdown(payload);
      const processedMarkdown = linkifyTokens(markdown, payload.destination);
      const cleanedMarkdown = removeImagesFromForbiddenSections(processedMarkdown, payload.destination);
      const html = marked.parse(cleanedMarkdown);
      const widgets = getWidgetsForDestination(payload.destination, payload.level, []);
      let finalHTML;
      try {
        finalHTML = await injectWidgetsIntoSections(html, widgets, payload.destination, payload.start, payload.end, payload);
      } catch (widgetError) {
        console.error('Widget injection failed:', widgetError);
        finalHTML = html;
      }
      const aff = affiliatesFor(payload.destination);
      const markdownWithMap = markdown + `\n\n---\n\n[Open ${payload.destination} Public Transport Map](map:${payload.destination}+public+transport+map)`;
      res.status(200).json({ id, markdown: markdownWithMap, html: finalHTML, affiliates: aff, version: VERSION, fallback: true });
    } catch (fallbackError) {
      console.error('Fallback plan failed:', fallbackError);
      res.status(200).json({ id: uid(), markdown: '# Temporary plan unavailable', html: '<p>Temporary plan unavailable</p>', version: VERSION, fallback: true });
    }
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
      finalHTML = await injectWidgetsIntoSections(html, widgets, payload.destination, payload.start, payload.end, payload);
    } catch (widgetError) {
      console.error('Widget injection failed in PDF generation:', widgetError);
      finalHTML = html; // Fallback to HTML without widgets
    }

    const fullHtml = `<!doctype html><html><head>
      <meta charset="utf-8">
      <title>Wayzo Trip Plan - ${escapeHtml(payload.destination || '')}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          line-height: 1.6;
          color: #333;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        h1 {
          color: #2c5aa0;
          font-size: 28px;
          margin-bottom: 20px;
          text-align: center;
          border-bottom: 3px solid #2c5aa0;
          padding-bottom: 15px;
        }

        h2 {
          color: #34495e;
          font-size: 20px;
          margin-top: 30px;
          margin-bottom: 15px;
          padding-left: 10px;
          border-left: 4px solid #3498db;
          page-break-after: avoid;
        }

        h3 {
          color: #2c3e50;
          font-size: 16px;
          margin-top: 20px;
          margin-bottom: 10px;
          page-break-after: avoid;
        }

        .trip-overview {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 25px;
          border-radius: 12px;
          margin: 20px 0;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }

        .trip-overview h1 {
          color: white;
          border-bottom: 2px solid rgba(255,255,255,0.3);
          margin-bottom: 20px;
        }

        .overview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 15px;
          margin-top: 20px;
        }

        .overview-item {
          background: rgba(255,255,255,0.1);
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #f39c12;
        }

        .overview-item strong {
          display: block;
          margin-bottom: 5px;
          color: #f39c12;
        }

        p {
          margin-bottom: 12px;
          text-align: justify;
        }

        ul, ol {
          margin-bottom: 15px;
          padding-left: 25px;
        }

        li {
          margin-bottom: 8px;
        }

        img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        th, td {
          border: 1px solid #e0e0e0;
          padding: 12px 15px;
          text-align: left;
        }

        th {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.5px;
        }

        tr:nth-child(even) {
          background-color: #f8f9fa;
        }

        tr:hover {
          background-color: #e3f2fd;
        }

        .budget-table th {
          background: linear-gradient(135deg, #2c5aa0 0%, #1e3a8a 100%);
        }

        .budget-table td:nth-child(2) {
          text-align: right;
          font-weight: 600;
          color: #27ae60;
        }

        .budget-table td:nth-child(3) {
          text-align: center;
          color: #f39c12;
          font-weight: 500;
        }

        .section-widget {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }

        .widget-header h4 {
          color: #2c5aa0;
          margin-top: 0;
          font-size: 18px;
        }

        .page-break {
          page-break-before: always;
        }

        .highlight {
          background: linear-gradient(120deg, #a8edea 0%, #fed6e3 100%);
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
          border-left: 4px solid #3498db;
        }

        .tip {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 15px;
          margin: 15px 0;
          border-left: 4px solid #f39c12;
        }

        .tip:before {
          content: "💡 ";
          font-weight: bold;
        }

        blockquote {
          border-left: 4px solid #3498db;
          margin: 20px 0;
          padding: 15px 20px;
          background: #f8f9fa;
          font-style: italic;
          border-radius: 0 8px 8px 0;
        }

        a {
          color: #3498db;
          text-decoration: none;
          font-weight: 500;
        }

        a:hover {
          text-decoration: underline;
        }

        .day-section {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          border-left: 4px solid #3498db;
        }

        .weather-info {
          background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
          color: white;
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
          text-align: center;
        }

        @media print {
          body { font-size: 12px; }
          h1 { font-size: 24px; }
          h2 { font-size: 18px; }
          h3 { font-size: 14px; }
          .trip-overview { background: #2c5aa0 !important; }
          .no-print { display: none; }
        }
      </style>
    </head><body>
      <div class="trip-overview">
        <h1>🚀 ${escapeHtml(payload.destination || '')} Trip Plan</h1>
        <div class="overview-grid">
          <div class="overview-item">
            <strong>📅 Travel Dates</strong>
            ${escapeHtml(payload.start || '')} → ${escapeHtml(payload.end || '')}
          </div>
          <div class="overview-item">
            <strong>💰 Budget</strong>
            ${payload.budget || 0} ${escapeHtml(payload.currency || 'EUR')}
          </div>
          <div class="overview-item">
            <strong>👥 Travelers</strong>
            ${escapeHtml(payload.adults || 1)} adults${payload.children ? `, ${payload.children} children` : ''}
          </div>
          <div class="overview-item">
            <strong>🎯 Travel Style</strong>
            ${escapeHtml(payload.level || 'Mid-range')}
          </div>
        </div>
      </div>
      <main class="content">
        ${finalHTML}
      </main>
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
// Test endpoint for image integration
app.post('/api/test-image', async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');

    // Get one of the example images
    const imagesDir = path.join(ROOT, 'frontend', 'images example');
    const imageFiles = fs.readdirSync(imagesDir).filter(f => f.endsWith('.jpeg') || f.endsWith('.jpg'));

    if (imageFiles.length === 0) {
      return res.status(404).json({ error: 'No example images found' });
    }

    // Use the first image for testing
    const imageFile = imageFiles[0];
    const imagePath = path.join(imagesDir, imageFile);
    const imageData = fs.readFileSync(imagePath, 'base64');

    // Create test payload with image
    const testPayload = {
      destination: 'Santorini, Greece',
      start: '2025-10-01',
      end: '2025-10-05',
      budget: 2000,
      currency: 'USD',
      adults: 2,
      children: 0,
      level: 'mid',
      prefs: 'romantic, photography',
      uploadedFiles: [{
        name: imageFile,
        type: 'image/jpeg',
        data: imageData
      }],
      mode: 'preview'
    };

    console.log(`Testing image integration with: ${imageFile}`);
    const result = await generatePlanWithAI(testPayload);

    res.json({
      success: true,
      imageUsed: imageFile,
      result: result.substring(0, 500) + '...' // First 500 chars for testing
    });

  } catch (error) {
    console.error('Image test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check OpenAI configuration
app.get('/api/debug', (req, res) => {
  const client = getOpenAIClient();
  res.json({
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    keyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
    clientInitialized: !!client,
    preferredModel: process.env.WAYZO_MODEL || 'gpt-5-nano-2025-08-07',
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
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
