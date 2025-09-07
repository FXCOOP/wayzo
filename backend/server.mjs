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
import { getWidgetsForDestination, generateWidgetHTML } from './lib/widgets.mjs';
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

/* WAYZO CONTRACT ENFORCEMENT */
function enforceWayzoContracts(markdown, destination) {
  console.log('Enforcing WAYZO OUTPUT CONTRACT rules...');
  
  let processed = markdown;
  
  // 1. Remove images from forbidden sections
  const forbiddenSections = [
    'Trip Overview',
    'Don\'t Forget List', 
    'Travel Tips',
    'Useful Apps',
    'Emergency Info'
  ];
  
  forbiddenSections.forEach(section => {
    const sectionRegex = new RegExp(`(##\\s*${section}[^#]*?)(![^\\n]*\\n)`, 'gis');
    processed = processed.replace(sectionRegex, '$1');
    console.log(`Removed images from forbidden section: ${section}`);
  });
  
  // 2. Don't process image tokens here - linkifyTokens handles this
  // After linkifyTokens processes images, they become Unsplash URLs and should be preserved
  
  // 3. Remove any "Image Ideas" sections completely
  processed = processed.replace(/## 🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
  processed = processed.replace(/## Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
  processed = processed.replace(/🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
  processed = processed.replace(/Enhance your travel experience[\s\S]*?(?=\n## |\n---|$)/g, '');
  processed = processed.replace(/Here are some beautiful images[\s\S]*?(?=\n## |\n---|$)/g, '');
  
  // 4. Remove generic "Open Exploration" days
  processed = processed.replace(/### Day \d+ — Open Exploration[\s\S]*?(?=\n### |\n## |$)/g, '');
  processed = processed.replace(/## Day \d+ — Open Exploration[\s\S]*?(?=\n## |$)/g, '');
  
  // 5. Don't remove properly formatted images - they should be preserved after linkifyTokens processing
  
  console.log('WAYZO OUTPUT CONTRACT enforcement complete');
  return processed;
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
    uploadedFiles = []
  } = payload || {};
  
  const nDays = dateMode === 'flexible' && flexibleDates ? flexibleDates.duration : daysBetween(start, end);
  const totalTravelers = adults + children;
  
  // Load system prompt from file
  let sys = '';
  try {
    sys = fs.readFileSync(path.join(__dirname, '..', 'prompts', 'wayzo_system.txt'), 'utf8');
  } catch (e) {
    console.error('Failed to load system prompt:', e);
    sys = 'You are Wayzo, an expert AI travel planner.';
  }

  // Load user prompt template from file
  let userTemplate = '';
  try {
    userTemplate = fs.readFileSync(path.join(__dirname, '..', 'prompts', 'wayzo_user.txt'), 'utf8');
  } catch (e) {
    console.error('Failed to load user prompt:', e);
    userTemplate = 'Please plan a trip with the following inputs:\n\nDestination: {{destination}}';
  }
  
  // Replace template variables in user prompt
  const user = userTemplate
    .replace(/\{\{destination\}\}/g, destination)
    .replace(/\{\{start\}\}/g, start)
    .replace(/\{\{end\}\}/g, end)
    .replace(/\{\{flex_enabled\}\}/g, dateMode === 'flexible' ? 'true' : 'false')
    .replace(/\{\{flex_days\}\}/g, flexibleDates?.flexibility || '3')
    .replace(/\{\{adults\}\}/g, adults)
    .replace(/\{\{children_suffix\}\}/g, children > 0 ? `, ${children} children${childrenAges.length > 0 ? ` (ages: ${childrenAges.join(', ')})` : ''}` : '')
    .replace(/\{\{style\}\}/g, level)
    .replace(/\{\{pace\}\}/g, 'moderate')
    .replace(/\{\{daily_start\}\}/g, '9:00 AM')
    .replace(/\{\{currency\}\}/g, currency)
    .replace(/\{\{budget_total\}\}/g, budget)
    .replace(/\{\{includes_flights\}\}/g, 'true')
    .replace(/\{\{dietary\}\}/g, dietary.join(', ') || 'None')
    .replace(/\{\{lodging_type\}\}/g, 'hotel')
    .replace(/\{\{purpose_list\}\}/g, 'leisure')
    .replace(/\{\{prefs\}\}/g, prefs || 'None')
    .replace(/\{\{max_drive_minutes\}\}/g, '120')
    .replace(/\{\{access_needs\}\}/g, 'None')
    .replace(/\{\{nap_windows\}\}/g, children > 0 ? '2:00 PM - 4:00 PM' : 'None')
    .replace(/\{\{weather_notes\}\}/g, 'Check current forecast');

  // Add additional context if needed
  if (professional_brief) {
    user += `\n\n**PROFESSIONAL BRIEF:** ${professional_brief}\n\nUse this detailed brief to create a highly personalized plan that addresses every specific requirement mentioned.`;
  }
  
  if (uploadedFiles && uploadedFiles.length > 0) {
    user += `\n\n**UPLOADED DOCUMENTS:** User has uploaded ${uploadedFiles.length} document(s) including: ${uploadedFiles.map(f => f.name).join(', ')}. Consider any existing plans or preferences mentioned in these documents when creating the itinerary.`;
  }

  if (!client) {
    console.warn('OpenAI API key not set, using local fallback');
    let md = localPlanMarkdown(payload);
    md = ensureDaySections(md, nDays, start);
    return md;
  }
  
  try {
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7, // Slightly higher for more creative responses
      max_tokens: 4000, // Allow longer, more detailed responses
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ],
    });
    
    let md = resp.choices?.[0]?.message?.content?.trim() || "";
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
    const id = uid();
    const markdown = await generatePlanWithAI(payload);
    
    // Process image tokens and other links in the MARKDOWN first
    const processedMarkdown = linkifyTokens(markdown, payload.destination);
    
    // Enforce WAYZO OUTPUT CONTRACT rules
    const cleanedMarkdown = enforceWayzoContracts(processedMarkdown, payload.destination);
    
    // Then convert to HTML
    const html = marked.parse(cleanedMarkdown);
    
    // Add affiliate widgets integrated into appropriate sections
    const widgets = getWidgetsForDestination(payload.destination, payload.level, []);
    console.log(`Generated ${widgets.length} widgets for destination: ${payload.destination}`);
    widgets.forEach((widget, index) => {
      console.log(`Widget ${index + 1}: ${widget.name} (${widget.category})`);
    });
    const finalHTML = injectWidgetsIntoSections(html, widgets);
    
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
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown }));
    
    // Track plan generation for analytics
    trackPlanGeneration(payload);
    
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
    const cleanedMarkdown = enforceWayzoContracts(processedMarkdown, payload.destination);
    const html = marked.parse(cleanedMarkdown);
    const widgets = getWidgetsForDestination(payload.destination, payload.level, []);
    console.log(`PDF: Generated ${widgets.length} widgets for destination: ${payload.destination}`);
    widgets.forEach((widget, index) => {
      console.log(`PDF Widget ${index + 1}: ${widget.name} (${widget.category})`);
    });
    const finalHTML = injectWidgetsIntoSections(html, widgets);

    const fullHtml = `<!doctype html><html><head>
      <meta charset="utf-8">
      <title>Wayzo Trip Plan - ${escapeHtml(payload.destination || '')}</title>
      <style>
        body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        img { max-width: 100%; height: auto; }
        h1, h2, h3 { page-break-after: avoid; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 6px; }
        .budget-table th { background: #f5f5f5; }
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

// Inject widgets into appropriate sections
function injectWidgetsIntoSections(html, widgets) {
  let modifiedHtml = html;
  console.log(`Injecting ${widgets.length} widgets into HTML`);
  
  // First, completely remove ANY widget blocks anywhere inside the Don't Forget List section
  modifiedHtml = modifiedHtml.replace(
    /(<h2>🧳 Don't Forget List<\/h2>[\s\S]*?<div class="dont-forget-list">)[\s\S]*?(<\/div>\s*\n?\s*<h2>|$)/g,
    (m, start, tail) => {
      // Keep only the checklist markup inside dont-forget-list; strip all section-widget blocks and tpwdgt scripts
      let inner = m.replace(start, '').replace(tail, '');
      inner = inner
        .replace(/<div class="section-widget"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, '')
        .replace(/<script[^>]*src="https?:\/\/tpwdgt\.com[\s\S]*?<\/script>/g, '');
      return start + inner + tail;
    }
  );
  
  // Now inject widgets into their proper sections
  const flightWidget = widgets.find(w => w.category === 'flights');
  if (flightWidget) {
    console.log('Injecting flight widget into Getting Around section');
    const flightWidgetHTML = `
      <div class="section-widget" data-category="flights">
        <div class="widget-header">
          <h4>${flightWidget.name}</h4>
          <p>${flightWidget.description}</p>
        </div>
        <div class="widget-content">
          ${flightWidget.script}
        </div>
      </div>
    `;
    // Inject into "Getting Around" section AFTER the content
    modifiedHtml = modifiedHtml.replace(
      /(<h2>🗺️ Getting Around<\/h2>[\s\S]*?)(<h2>🏨|<h2>🍽️|<h2>🎭|<h2>🎫|<h2>🧳|<h2>🛡️|<h2>📱|<h2>🚨|<h2>🖼️)/s,
      `$1${flightWidgetHTML}$2`
    );
  }
  
  // Find hotel widget
  const hotelWidget = widgets.find(w => w.category === 'accommodation');
  if (hotelWidget) {
    console.log('Injecting hotel widget into Accommodation section');
    const hotelWidgetHTML = `
      <div class="section-widget" data-category="accommodation">
        <div class="widget-header">
          <h4>${hotelWidget.name}</h4>
          <p>${hotelWidget.description}</p>
        </div>
        <div class="widget-content">
          ${hotelWidget.script}
        </div>
      </div>
    `;
    // Inject into "Accommodation" section AFTER the content
    modifiedHtml = modifiedHtml.replace(
      /(<h2>🏨 Accommodation<\/h2>[\s\S]*?)(<h2>🍽️|<h2>🎭|<h2>🎫|<h2>🧳|<h2>🛡️|<h2>📱|<h2>🚨|<h2>🖼️)/s,
      `$1${hotelWidgetHTML}$2`
    );
  }
  
  // Find car rental widget
  const carWidget = widgets.find(w => w.category === 'transport');
  if (carWidget) {
    console.log('Injecting car rental widget into Getting Around section');
    const carWidgetHTML = `
      <div class="section-widget" data-category="transport">
        <div class="widget-header">
          <h4>${carWidget.name}</h4>
          <p>${carWidget.description}</p>
        </div>
        <div class="widget-content">
          ${carWidget.script}
        </div>
      </div>
    `;
    // Inject into "Getting Around" section AFTER the content
    modifiedHtml = modifiedHtml.replace(
      /(<h2>🗺️ Getting Around<\/h2>[\s\S]*?)(<h2>🏨|<h2>🍽️|<h2>🎭|<h2>🎫|<h2>🧳|<h2>🛡️|<h2>📱|<h2>🚨|<h2>🖼️)/s,
      `$1${carWidgetHTML}$2`
    );
  }
  
  // Find eSIM widget
  const esimWidget = widgets.find(w => w.category === 'connectivity');
  if (esimWidget) {
    console.log('Injecting eSIM widget into Travel Tips section');
    const esimWidgetHTML = `
      <div class="section-widget" data-category="connectivity">
        <div class="widget-header">
          <h4>${esimWidget.name}</h4>
          <p>${esimWidget.description}</p>
        </div>
        <div class="widget-content">
          ${esimWidget.script}
        </div>
      </div>
    `;
    // Inject into "Useful Apps" section AFTER the content
    modifiedHtml = modifiedHtml.replace(
      /(<h2>📱 Useful Apps<\/h2>[\s\S]*?)(<h2>🚨|<h2>🖼️)/s,
      `$1${esimWidgetHTML}$2`
    );
  }
  
  // Add remaining widgets at the end if not placed
  const placedWidgets = [flightWidget, hotelWidget, carWidget, esimWidget].filter(Boolean);
  const remainingWidgets = widgets.filter(w => !placedWidgets.includes(w));
  
  if (remainingWidgets.length > 0) {
    const remainingWidgetsHTML = remainingWidgets.map(widget => `
      <div class="section-widget" data-category="${widget.category}">
        <div class="widget-header">
          <h4>${widget.name}</h4>
          <p>${widget.description}</p>
        </div>
        <div class="widget-content">
          ${widget.script}
        </div>
      </div>
    `).join('');
    
    modifiedHtml += `
      <div class="additional-widgets-section">
        <h3>🚀 Additional Booking Options</h3>
        ${remainingWidgetsHTML}
      </div>
    `;
  }
  
  return modifiedHtml;
}
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
