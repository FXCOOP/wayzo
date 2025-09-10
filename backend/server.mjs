/* eslint-disable no-console */
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { marked } from 'marked';

// Configure marked to allow JavaScript event handlers for interactive checkboxes
marked.setOptions({
  sanitize: false, // Allow HTML and JavaScript event handlers
  breaks: true,    // Convert line breaks to <br>
  gfm: true        // GitHub Flavored Markdown
});

import puppeteer from 'puppeteer';
// Derive a locale string from destination (very lightweight mapping)
function getLocaleForDestination(dest = '') {
  const d = (dest || '').toLowerCase();
  if (d.includes('germany') || d.includes('berlin')) return 'de-DE';
  if (d.includes('austria') || d.includes('tyrol') || d.includes('tirol') || d.includes('innsbruck')) return 'de-AT';
  if (d.includes('italy') || d.includes('venice') || d.includes('venezia')) return 'it-IT';
  if (d.includes('greece') || d.includes('santorini') || d.includes('athens')) return 'el-GR';
  if (d.includes('spain') || d.includes('madrid') || d.includes('barcelona')) return 'es-ES';
  if (d.includes('france') || d.includes('paris')) return 'fr-FR';
  if (d.includes('portugal') || d.includes('lisbon') || d.includes('porto')) return 'pt-PT';
  if (d.includes('czech') || d.includes('prague')) return 'cs-CZ';
  return 'en-US';
}
import OpenAI from 'openai';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import pino from 'pino';
import { normalizeBudget, computeBudget } from './lib/budget.mjs';
import { ensureDaySections } from './lib/expand-days.mjs';
import { affiliatesFor, linkifyTokens } from './lib/links.mjs';
import { buildIcs } from './lib/ics.mjs';
import { getWidgetsForDestination, generateWidgetHTML } from './lib/widgets.mjs';
import { WIDGET_CONFIG, getGYGWidget } from './lib/widget-config.mjs';
import { storePlan, getPlan, getAllPlans, storeRequest, getRequestStats } from './lib/db.mjs';
const VERSION = 'staging-v75';

// Initialize structured logging with Pino
let logger;
try {
  logger = pino({
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        destination: 'wayzo.log',
        colorize: false,
        translateTime: 'SYS:standard'
      }
    }
  });
  logger.info({ version: VERSION }, 'Wayzo server starting');
} catch (error) {
  console.error('Failed to initialize logger:', error);
  // Fallback to console logging
  logger = {
    info: (obj, msg) => console.log(`[INFO] ${msg}`, obj || ''),
    warn: (obj, msg) => console.warn(`[WARN] ${msg}`, obj || ''),
    error: (obj, msg) => console.error(`[ERROR] ${msg}`, obj || ''),
    debug: (obj, msg) => console.debug(`[DEBUG] ${msg}`, obj || '')
  };
  logger.info({ version: VERSION }, 'Wayzo server starting (console fallback)');
}
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

app.get('/version', (_req, res) => res.json({ version: VERSION }));

// Debug endpoint for system status
app.get('/api/debug', (_req, res) => {
  const debugInfo = {
    version: VERSION,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT_SET',
      WAYZO_MODEL: process.env.WAYZO_MODEL || 'gpt-4o-mini'
    },
    files: {
      serverExists: fs.existsSync(path.join(__dirname, 'server.mjs')),
      frontendExists: fs.existsSync(path.join(FRONTEND, 'index.html')),
      linksExists: fs.existsSync(path.join(__dirname, 'lib', 'links.mjs'))
    },
    database: {
      plansCount: getAllPlans().length,
      eventsCount: 0 // Events table not implemented in new db module
    }
  };
  res.json(debugInfo);
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

// CORS-safe IP geolocation proxy
app.get('/api/geo', async (_req, res) => {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const r = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(`ipapi HTTP ${r.status}`);
    const data = await r.json();
    res.setHeader('Cache-Control', 'no-cache');
    return res.json(data);
  } catch (e) {
    console.warn('ipapi proxy failed:', e.message || e);
    return res.json({ city: '', country_name: '' });
  }
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

/* DB - Using new db module */
const nowIso = () => new Date().toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

// Analytics tracking function
const trackPlanGeneration = (payload) => {
  try {
    const eventId = uid();
    // Plan generation tracking not implemented in new db module
    // TODO: Implement plan tracking in lib/db.mjs
  } catch (e) {
    console.error('Failed to track plan generation:', e);
  }
};
/* Helpers */
const daysBetween = (a, b) => { if (!a || !b) return 1; const s = new Date(a), e = new Date(b); if (isNaN(s) || isNaN(e)) return 1; return Math.max(1, Math.round((e - s) / 86400000) + 1); };
const seasonFromDate = (iso = "") => ([12, 1, 2].includes(new Date(iso).getMonth() + 1) ? "Winter" : [3, 4, 5].includes(new Date(iso).getMonth() + 1) ? "Spring" : [6, 7, 8].includes(new Date(iso).getMonth() + 1) ? "Summer" : "Autumn");
const travelerLabel = (ad = 2, ch = 0) => ch > 0 ? `Family (${ad} adult${ad === 1 ? "" : "s"} + ${ch} kid${ch === 1 ? "" : "s"})` : (ad === 2 ? "Couple" : ad === 1 ? "Solo" : `${ad} adult${ad === 1 ? "" : "s"}`);
const perPersonPerDay = (t = 0, d = 1, tr = 1) => Math.round((Number(t) || 0) / Math.max(1, d) / Math.max(1, tr));

// Destination-specific information
function getDestinationInfo(destination) {
  const dest = destination.toLowerCase();
  
  if (dest.includes('toronto') || dest.includes('canada')) {
    return {
      language: 'English widely spoken in tourist areas',
      currency: 'Canadian Dollar (CAD)',
      currencyConversion: '1 USD ≈ 1.35 CAD',
      voltage: '120V, Type A/B plugs',
      tipping: '15-20% in restaurants, 10-15% for other services',
      timeZone: 'EST/EDT (UTC-5/UTC-4)',
      emergency: '911 (emergency), 311 (non-emergency)',
      seasonalInfo: {
        'Autumn': 'pleasant weather and fewer crowds, perfect for sightseeing',
        'Summer': 'warm and humid, peak tourist season with festivals',
        'Winter': 'cold and snowy, indoor attractions and winter activities',
        'Spring': 'mild weather, cherry blossoms and outdoor activities'
      },
      attractions: [
        { name: 'CN Tower', description: 'Iconic 553m tower with observation deck', duration: '2-3 hours', bestTime: 'early morning or sunset', why: 'Panoramic city views and thrilling EdgeWalk', review: 'The views were absolutely incredible! Worth every penny.', tip: 'Book tickets online to skip lines, especially on weekends' },
        { name: 'Royal Ontario Museum (ROM)', description: 'World-class museum of art, culture, and natural history', duration: '3-4 hours', bestTime: 'late morning', why: 'Extensive collections and interactive exhibits', review: 'ROM had amazing exhibits! Perfect for families.', tip: 'Free admission on certain days, check schedule' },
        { name: 'Art Gallery of Ontario (AGO)', description: 'Premier art museum with Canadian and international works', duration: '2-3 hours', bestTime: 'afternoon', why: 'World-class art collection and beautiful architecture', review: 'AGO collection was world-class! The building itself is art.', tip: 'Many galleries offer free admission on certain days' },
        { name: 'Casa Loma', description: 'Historic castle with gardens and secret passages', duration: '2-3 hours', bestTime: 'morning', why: 'Unique castle experience in the heart of the city', review: 'Casa Loma was fascinating! The castle tour was very informative.', tip: 'Book castle timeslot in advance, combine with Yorkville' },
        { name: 'St. Lawrence Market', description: 'Historic food market with local vendors and restaurants', duration: '1-2 hours', bestTime: 'morning or lunch', why: 'Authentic local food and cultural experience', review: 'St. Lawrence Market had amazing local food!', tip: 'Market is busiest on weekends, arrive early' }
      ],
      accommodation: {
        areas: [
          'Downtown Core: Close to major attractions, CN Tower, and entertainment',
          'Yorkville: Upscale shopping and dining, near museums',
          'Entertainment District: Nightlife, theatres, and restaurants',
          'Harbourfront: Waterfront views, close to Toronto Islands',
          'Kensington Market: Bohemian vibe, unique shops and cafes'
        ],
        recommendations: {
          'Downtown': 'Fairmont Royal York (luxury), Delta Toronto (mid), HI Toronto (budget)',
          'Yorkville': 'Four Seasons Hotel Toronto (luxury), InterContinental Toronto Centre (mid)',
          'Harbourfront': 'Westin Harbour Castle (mid), Radisson Admiral Hotel (budget)'
        }
      },
      dining: [
        { name: 'St. Lawrence Market', description: 'Historic food market with local vendors', type: 'Lunch or casual dinner', why: 'Authentic local food and cultural experience', review: 'Amazing variety of local food!', tip: 'Busiest on weekends, arrive early for best selection' },
        { name: 'Kensington Market', description: 'Bohemian neighborhood with diverse international cuisine', type: 'Casual dining', why: 'Unique multicultural food scene', review: 'Kensington Market was vibrant and authentic.', tip: 'Great for walking tours and food exploration' },
        { name: 'Distillery District', description: 'Historic district with restaurants and craft breweries', type: 'Dinner and drinks', why: 'Historic setting with modern dining', review: 'Distillery District had great atmosphere and food.', tip: 'Book dinner reservations, especially on weekends' }
      ],
      reviews: [
        'CN Tower views were absolutely incredible! Worth every penny.',
        'ROM had amazing exhibits! Perfect for families.',
        'St. Lawrence Market had amazing local food!',
        'Casa Loma was fascinating! The castle tour was very informative.',
        'Toronto Islands ferry ride was scenic and relaxing.'
      ],
      travelTips: [
        { category: 'Transit', description: 'Use TTC (Toronto Transit Commission) for public transport; buy day passes for convenience' },
        { category: 'Timing', description: 'Book major attractions like CN Tower and Casa Loma in advance, especially on weekends' },
        { category: 'Weather', description: 'Pack layers - weather can change quickly; check forecasts for outdoor activities' },
        { category: 'Dining', description: 'Make dinner reservations, especially in popular areas like Distillery District' }
      ],
      apps: [
        { name: 'TTC Trip Planner', description: 'Public transit routes and schedules' },
        { name: 'Toronto.com', description: 'Local events, attractions, and dining' },
        { name: 'Weather Network', description: 'Accurate local weather forecasts' }
      ],
      emergencyInfo: 'Emergency Numbers: 911 (emergency), 311 (non-emergency)\nMedical Centers: Toronto General Hospital, Mount Sinai Hospital\nPharmacies: Shoppers Drug Mart, Rexall (24-hour locations available)\nTourist Information: CN Tower, Union Station, Harbourfront Centre\nLost & Found: Contact TTC for transit items, local police for other items\nConsulate Services: Check for nearest consulate services in downtown area'
    };
  }
  
  if (dest.includes('berlin')) {
    return {
      language: 'German (Deutsch); English widely spoken in central areas',
      currency: 'Euro (EUR)',
      currencyConversion: '1 USD ≈ 0.92 EUR',
      voltage: '230V, Type C/F plugs',
      tipping: 'Round up or ~5–10% at restaurants',
      timeZone: 'CET/CEST (UTC+1/UTC+2)',
      emergency: '112 (emergency), 110 (police)',
      seasonalInfo: {
        'Autumn': 'comfortable temps, festivals, fewer crowds than summer',
        'Summer': 'warm, long days; busiest for museums and sights',
        'Winter': 'cold; Christmas markets and museum time',
        'Spring': 'mild; parks and beer gardens reopen'
      },
      attractions: [
        { name: 'Museum Island (Museumsinsel)', description: 'UNESCO site of five world-class museums', duration: '3–4 hours', bestTime: 'late morning', why: 'Art and antiquities in stunning neoclassical buildings', review: 'An entire day can fly by here—Pergamon Panorama is excellent.', tip: 'Buy a combined Museum Island pass; closed on some Mondays' },
        { name: 'Brandenburg Gate & Pariser Platz', description: 'Iconic 18th‑century gate and grand square', duration: '45–60 minutes', bestTime: 'sunrise or evening', why: 'Signature Berlin photo and history stop', review: 'Beautiful at blue hour; less crowded at sunrise.', tip: 'Combine with Reichstag and Tiergarten walk' },
        { name: 'Reichstag Dome (Bundestag)', description: 'Glass dome with panoramic city views', duration: '60–90 minutes', bestTime: 'late afternoon', why: 'Architecture and views with audio guide', review: 'Free with advance booking—audio guide is excellent.', tip: 'Reserve online weeks ahead and bring ID' },
        { name: 'East Side Gallery', description: '1.3 km open‑air gallery on the Berlin Wall', duration: '60–90 minutes', bestTime: 'morning', why: 'Street art and history together', review: 'Powerful murals—get there early for clean photos.', tip: 'Continue riverside walk to Oberbaum Bridge' },
        { name: 'Gendarmenmarkt & Unter den Linden', description: 'Elegant square and historic boulevard', duration: '60–90 minutes', bestTime: 'afternoon', why: 'Architecture, cafes, and boutiques', review: 'Lovely coffee stop between sights.', tip: 'Climb Französischer Dom for views' },
        { name: 'Topography of Terror', description: 'Documentation center on Nazi institutions', duration: '1.5–2 hours', bestTime: 'midday', why: 'Clear, sobering historical context', review: 'Well‑curated and free; multilingual panels.', tip: 'Combine with Checkpoint Charlie walk' }
      ],
      accommodation: {
        areas: [
          'Mitte: Walkable to Museum Island, Brandenburg Gate, Unter den Linden',
          'Prenzlauer Berg: Leafy, cafes and family‑friendly, near Mauerpark',
          'Friedrichshain: East Side Gallery, nightlife, easy S‑Bahn',
          'Charlottenburg: Ku\'damm, Charlottenburg Palace, classic West Berlin',
          'Kreuzberg: Creative, food scene, canal walks'
        ],
        recommendations: {
          'Mitte': 'ARCOTEL John F (mid), Adina Apartment Hotel Hackescher Markt (mid), Hotel de Rome (luxury)',
          'Prenzlauer Berg': 'Hotel Oderberger (mid), Schoenhouse Studios (mid), Pension Absolut (budget)',
          'Charlottenburg': 'Hotel Zoo Berlin (luxury), Sir Savigny (mid), Motel One Upper West (budget)'
        }
      },
      dining: [
        { name: 'Markthalle Neun', description: 'Street food hall (Thu Street Food Thursday)', type: 'Lunch or casual dinner', why: 'Variety and quality under one roof', review: 'Fantastic options; arrive hungry.', tip: 'Check event days for special vendors' },
        { name: 'Mustafa\'s Gemüse Kebap / Konnopke\'s Imbiss', description: 'Beloved Berlin street‑food institutions', type: 'Quick bite', why: 'Classic Berlin flavors', review: 'Queues move fast; worth the wait.', tip: 'Go off‑peak to avoid long lines' },
        { name: 'Zur letzten Instanz', description: 'Historic German restaurant (since 1621)', type: 'Dinner reservation', why: 'Traditional cuisine in old‑world setting', review: 'Pork knuckle and dumplings are classics.', tip: 'Reserve ahead; cozy and popular' }
      ],
      reviews: [
        'Museum Island could fill a whole day—audio guides are excellent.',
        'East Side Gallery murals are moving; go early for photos.',
        'Cycling around Tiergarten and the canals was a highlight.'
      ],
      travelTips: [
        { category: 'Transit', description: 'Buy a Berlin ABC pass if flying to BER and visiting Potsdam; validate tickets.' },
        { category: 'Timing', description: 'Reserve Reichstag Dome; many museums closed Mondays.' },
        { category: 'Cash/Card', description: 'Cards widely accepted; some kiosks prefer cash.' }
      ],
      apps: [
        { name: 'BVG Fahrinfo / Jelbi', description: 'Public transport tickets and routing' },
        { name: 'Google Maps (offline)', description: 'Download areas for coverage underground' },
        { name: 'Too Good To Go', description: 'Food bargains from cafes and bakeries' }
      ],
      emergencyInfo: `- **Emergency Numbers**: 112 (emergency), 110 (police)
- **Hospitals**: Charité – Universitätsmedizin Berlin; DRK Kliniken Berlin
- **Pharmacies**: "Apotheke" signs; late‑night options rotate
- **Tourist Info**: Brandenburg Gate, Central Station (Hbf)
- **Consulates**: Check location and hours in advance`
    };
  }

  if (dest.includes('philippines') || dest.includes('manila') || dest.includes('cebu') || dest.includes('boracay') || dest.includes('palawan') || dest.includes('el nido')) {
    return {
      language: 'Filipino/Tagalog (official), English widely spoken',
      currency: 'Philippine Peso (PHP)',
      currencyConversion: '1 USD ≈ 56 PHP',
      voltage: '220V, Type A/B/C plugs - adapter required for US devices',
      tipping: '10-15% in restaurants, round up taxi fares, ₱20-50 per bag for porters',
      timeZone: 'PST (UTC+8)',
      emergency: '911 (emergency), 117 (police), 143 (medical)',
      seasonalInfo: {
        'Autumn': 'pleasant weather, fewer crowds, and great beach conditions',
        'Summer': 'hot and humid, perfect for beach activities, but expect afternoon rains',
        'Winter': 'cooler, dry season with ideal weather for outdoor activities',
        'Spring': 'transitional weather, fewer tourists, and good beach conditions'
      },
      attractions: [
        {
          name: 'Intramuros Historic District (Manila)',
          description: 'Spanish colonial walled city with historic churches and museums',
          duration: '2-3 hours',
          bestTime: 'early morning',
          why: 'Perfect introduction to Philippine history and Spanish colonial architecture',
          review: 'Absolutely fascinating! The San Agustin Church was stunning, and our guide was incredibly knowledgeable.',
          tip: 'Start at Fort Santiago before 9 AM to avoid crowds and catch the best lighting for photos.'
        },
        {
          name: 'Boracay White Beach',
          description: 'World-famous white sand beach with crystal clear waters',
          duration: 'Full day',
          bestTime: 'anytime',
          why: 'Iconic Philippine beach experience with water sports and stunning sunsets',
          review: 'The beach was absolutely pristine! Perfect for families with kids - shallow waters and soft sand.',
          tip: 'Visit during sunset for the most spectacular views. Book water activities in advance.'
        },
        {
          name: 'Palawan Underground River',
          description: 'UNESCO World Heritage subterranean river with limestone formations',
          duration: '3-4 hours',
          bestTime: 'morning',
          why: 'Unique natural wonder showcasing Philippine biodiversity and geological formations',
          review: 'Incredible experience! The limestone formations were breathtaking, and the boat tour was very informative.',
          tip: 'Book tickets online well in advance. Bring a jacket as it gets cool inside the cave.'
        },
        {
          name: 'Chocolate Hills (Bohol)',
          description: 'Unique geological formation of 1,200+ cone-shaped hills',
          duration: '2-3 hours',
          bestTime: 'early morning or late afternoon',
          why: 'Iconic Philippine landmark offering panoramic views and unique photo opportunities',
          review: 'Amazing natural wonder! The view from the observation deck was absolutely stunning.',
          tip: 'Best lighting for photos is during golden hour. Combine with Tarsier Sanctuary visit.'
        },
        {
          name: 'El Nido Lagoons Tour (Palawan)',
          description: 'Stunning limestone lagoons with crystal clear waters',
          duration: 'Full day',
          bestTime: 'early morning',
          why: 'World-famous lagoons with breathtaking scenery and perfect for island hopping',
          review: 'Absolutely incredible! The lagoons were like paradise - crystal clear water and stunning limestone cliffs.',
          tip: 'Book tours in advance as they sell out quickly. Bring waterproof camera and reef-safe sunscreen.'
        }
      ],
      accommodation: {
        areas: [
          'Makati (Manila): Modern business district with luxury hotels, shopping, and nightlife',
          'Boracay Station 2: Beachfront resorts with easy access to restaurants and water activities',
          'El Nido (Palawan): Eco-lodges and beachfront resorts near stunning lagoons',
          'Cebu IT Park: Modern area with business hotels and easy access to attractions'
        ],
        recommendations: {
          'Manila': 'Shangri-La Makati (luxury), Hotel Celeste (boutique), Red Planet Makati (budget)',
          'Boracay': 'Shangri-La Boracay (luxury), Discovery Shores (mid-range), Boracay Beach Club (budget)',
          'Palawan': 'El Nido Resorts (luxury), Caalan Beach Resort (mid-range), Spin Designer Hostel (budget)',
          'Cebu': 'Shangri-La Cebu (luxury), Radisson Blu Cebu (mid-range), Quest Hotel Cebu (budget)'
        }
      },
      dining: [
        {
          name: 'Traditional Filipino Restaurant',
          description: 'Authentic Filipino cuisine with regional specialties',
          type: 'Dinner reservations recommended',
          why: 'Experience authentic Filipino flavors including adobo, sinigang, and lechon',
          review: 'Incredible food! The lechon was amazing, and the staff was so welcoming. Felt like dining with family.',
          tip: 'Book dinner reservations 2-3 days in advance, especially on weekends. Try the local specialties.'
        },
        {
          name: 'Jollibee or Local Fast Food',
          description: 'Popular Filipino fast food chains',
          type: 'Perfect for quick meals',
          why: 'Experience Filipino fast food culture and comfort food',
          review: 'Great for quick meals! The chicken joy and spaghetti were surprisingly good.',
          tip: 'Perfect for families with kids. Try the halo-halo for dessert.'
        },
        {
          name: 'Seaside Restaurant',
          description: 'Fresh seafood with ocean views',
          type: 'Lunch or dinner',
          why: 'Fresh catch of the day prepared with local spices and cooking methods',
          review: 'Amazing seafood! The grilled fish was incredibly fresh and flavorful.',
          tip: 'Ask for the daily catch. Best seafood is usually available in coastal areas.'
        }
      ],
      reviews: [
        "Boracay White Beach was absolutely pristine! Perfect for families with kids - shallow waters and soft sand.",
        "Intramuros was absolutely fascinating! The Spanish colonial architecture was stunning.",
        "El Nido lagoons were like paradise - crystal clear water and stunning limestone cliffs.",
        "Filipino cuisine was incredible! The lechon and adobo were amazing, and the staff was so welcoming.",
        "The island hopping tours were perfect for families - kids loved the snorkeling and beach activities."
      ],
      travelTips: [
        { category: "Opening Hours", description: "Most attractions open 8 AM-6 PM. Check seasonal schedules for island tours." },
        { category: "Advance Booking", description: "Pre-book popular attractions like El Nido lagoons, Boracay activities, and island hopping tours." },
        { category: "Transportation", description: "Use local transport options like jeepneys, tricycles, and boats. Validate tickets properly." },
        { category: "Weather", description: "Check weather forecasts - tropical climate with afternoon rains possible. Pack rain gear." },
        { category: "Cash vs Card", description: "Most places accept cards, but carry cash for smaller establishments and island tours." },
        { category: "Language", description: "Learn basic Filipino phrases—locals appreciate the effort, though English is widely spoken." }
      ],
      apps: [
        { name: "Grab", description: "Ride-hailing and food delivery app" },
        { name: "Google Maps", description: "Offline area downloads for navigation" },
        { name: "Google Translate", description: "Filipino-English translation" },
        { name: "XE Currency", description: "Real-time PHP exchange rates" },
        { name: "Weather App", description: "Tropical weather forecasts" },
        { name: "Transportation Apps", description: "Local transport schedules and tickets" }
      ],
      emergencyInfo: `- **Emergency Numbers**: 911 (emergency), 117 (police), 143 (medical)
- **Medical Centers**: 
  - Makati Medical Center (Makati)
  - St. Luke's Medical Center (Quezon City)
  - El Nido Medical Clinic (El Nido)
- **Pharmacies**: Look for "Botika" signs. Most open 8 AM-8 PM
- **Tourist Information**: 
  - Department of Tourism offices in major cities
  - Local tourist information centers
- **Lost & Found**: Contact local police stations or tourist offices
- **Consulate Services**: Check for nearest consulate services in Manila`
    };
  }
  
  // Default fallback for other destinations
  return {
    language: 'English widely spoken in tourist areas',
    currency: 'Local currency',
    currencyConversion: 'Check current exchange rates',
    voltage: 'Check local voltage requirements',
    tipping: '10-15% in restaurants, check local customs',
    timeZone: 'Check local time zone',
    emergency: '911 (emergency), check local emergency numbers',
    seasonalInfo: {
      'Autumn': 'pleasant weather and fewer crowds',
      'Summer': 'warm weather perfect for outdoor activities',
      'Winter': 'cooler weather, check for seasonal attractions',
      'Spring': 'mild weather and blooming flowers'
    },
    attractions: [
      {
        name: 'Historic Old Town Walking Tour',
        description: 'Explore the historic center with local architecture and culture',
        duration: '2-3 hours',
        bestTime: 'early morning',
        why: 'Perfect introduction to local history and architecture',
        review: 'Great way to get oriented! The guide was knowledgeable and showed us hidden gems.',
        tip: 'Start early to avoid crowds and catch the best lighting for photos.'
      }
    ],
    accommodation: {
      areas: ['City Center: Convenient location near major attractions'],
      recommendations: {'City Center': 'Check local hotel recommendations'}
    },
    dining: [
      {
        name: 'Local Restaurant',
        description: 'Traditional local cuisine',
        type: 'Dinner reservations recommended',
        why: 'Experience authentic local flavors and cooking methods',
        review: 'Great food and atmosphere! The local specialties were delicious.',
        tip: 'Book reservations in advance, especially on weekends.'
      }
    ]
  };
}

// Generate destination-specific daily activities
function getDailyActivities(destination, nDays) {
  const dest = destination.toLowerCase();
  
  if (dest.includes('berlin')) {
    const days = [
      { morning: '🏛️ Museum Island (Pergamon Panorama or Neues Museum)', afternoon: '🗽 Berlin Cathedral & Spree river walk', evening: '🍽️ Dinner in Hackescher Markt', review: 'Island pass made it easy to see multiple museums.', tip: 'Reserve time slots; closed some Mondays', map: '📍 Museum Island' },
      { morning: '🚶 Unter den Linden → Brandenburg Gate', afternoon: '🏛️ Reichstag Dome (booked visit)', evening: '🌳 Tiergarten stroll & Café am Neuen See', review: 'Reichstag audio guide is excellent and free.', tip: 'Bring ID for security at Reichstag', map: '📍 Reichstag' },
      { morning: '🧱 East Side Gallery mural walk', afternoon: '🌉 Oberbaum Bridge & Spree riverside', evening: '🍻 Friedrichshain dinner & craft beer', review: 'Street art + sunset over the river was perfect.', tip: 'Go early for fewer crowds/photos', map: '📍 East Side Gallery' },
      { morning: '📜 Topography of Terror (documentation center)', afternoon: '🪖 Checkpoint Charlie & Gendarmenmarkt', evening: '🍷 Dinner around Mitte/Prenzlauer Berg', review: 'Sobering but very informative exhibits.', tip: 'Most content is bilingual; allow 90–120 min', map: '📍 Niederkirchnerstraße 8' },
      { morning: '🏰 Charlottenburg Palace & Gardens', afternoon: '🛍️ Kurfürstendamm & KaDeWe food hall', evening: '🎶 Potsdamer Platz/Philharmonie (if available)', review: 'Gardens are lovely on clear days.', tip: 'Book palace timeslot; combine with Ku\'damm', map: '📍 Schloss Charlottenburg' },
      { morning: '🚲 Tempelhofer Feld cycling or walk', afternoon: '🛍️ Markthalle Neun / food crawl', evening: '🎭 Theater/club or canal walk (Landwehrkanal)', review: 'Tempelhof runways—unique city space.', tip: 'Rent bikes or grab e‑scooters nearby', map: '📍 Tempelhofer Damm' },
      { morning: '🕍 Jewish Museum or DDR Museum (your pick)', afternoon: '🌳 Mauerpark & fleamarket (Sun)', evening: '🎤 Karaoke / street food (Sun)', review: 'Mauerpark on Sunday is peak local vibe.', tip: 'Check museum hours and market days', map: '📍 Mauerpark' },
      { morning: '🚆 Day trip (Potsdam palaces or Sachsenhausen Memorial)', afternoon: '🏞️ Sanssouci Park (if Potsdam)', evening: '🍽️ Return to Berlin—farewell dinner', review: 'Potsdam is an easy S‑Bahn ride away.', tip: 'ABC ticket covers Potsdam; validate it', map: '📍 Potsdam Hbf' }
    ];
    return Array.from({ length: Math.max(1, nDays) }, (_, i) => days[i % days.length]);
  }

  if (dest.includes('philippines') || dest.includes('manila') || dest.includes('cebu') || dest.includes('boracay') || dest.includes('palawan') || dest.includes('el nido')) {
    return [
      {
        morning: "🏰 **Intramuros Historic District** (Fort Santiago → San Agustin Church → Casa Manila)",
        afternoon: "🏛️ **National Museum of the Philippines** (Padre Burgos Ave, Manila) - Philippine history & culture",
        evening: "🍽️ **Café Adriatico** (1790 Adriatico St, Malate) - Traditional Filipino dinner",
        review: "Intramuros was absolutely fascinating! The Spanish colonial architecture was stunning.",
        tip: "Start at Fort Santiago before 9 AM to avoid crowds and catch the best lighting for photos.",
        map: "📍 Start: Fort Santiago, Intramuros, Manila"
      },
      {
        morning: "🏖️ **Boracay White Beach** (Station 2) - World-famous white sand beach",
        afternoon: "🤿 **Island Hopping Tour** (Crystal Cove → Magic Island) - Snorkeling & beach hopping",
        evening: "🍽️ **D'Talipapa Seafood Market** (Station 2) - Fresh seafood dinner",
        review: "Boracay was absolutely pristine! Perfect for families with kids - shallow waters and soft sand.",
        tip: "Visit during sunset for the most spectacular views. Book water activities in advance.",
        map: "📍 Boracay White Beach, Station 2"
      },
      {
        morning: "🛍️ **Greenhills Shopping Center** (San Juan) - Local markets & artisan shops",
        afternoon: "🏰 **Ayala Museum** (Makati Ave, Makati) - Philippine art & culture",
        evening: "🎭 **Cultural Show** (CCP Complex, Pasay) - Traditional Filipino performance",
        review: "The market tour gave us authentic local insights and great shopping opportunities.",
        tip: "Markets are busiest in the morning—arrive early for the best selection.",
        map: "📍 Greenhills Shopping Center, San Juan"
      },
      {
        morning: "🌋 **Taal Volcano Tour** (Tagaytay) - Active volcano with stunning lake views",
        afternoon: "🍷 **Local Winery Visit** (Tagaytay) - Wine tasting & scenic views",
        evening: "🍽️ **Sonya's Garden** (Tagaytay) - Farm-to-table dining experience",
        review: "The volcano tour was incredible! The views from Tagaytay were absolutely breathtaking.",
        tip: "Pack comfortable walking shoes and check weather conditions before heading out.",
        map: "📍 Taal Volcano, Tagaytay"
      },
      {
        morning: "🏛️ **Rizal Park & National Museum** (Ermita, Manila) - Historic landmarks",
        afternoon: "👨‍🍳 **Filipino Cooking Class** (Local culinary school) - Learn traditional cuisine",
        evening: "♨️ **Spa Treatment** (Makati) - Wellness & relaxation",
        review: "The cooking class was a highlight—we learned to make authentic Filipino dishes.",
        tip: "Book cooking classes in advance as they often fill up quickly.",
        map: "📍 Rizal Park, Ermita, Manila"
      },
      {
        morning: "🔍 **Hidden Gems Tour** - Corregidor Island (Manila Bay) - WWII historical site",
        afternoon: "🚤 **Manila Bay Sunset Cruise** - Scenic harbor tour",
        evening: "🍽️ **Manila Hotel** (Rizal Park) - Historic luxury dining",
        review: "Corregidor Island was fascinating! The WWII history was incredibly moving.",
        tip: "Book the island tour well in advance. Bring sunscreen and water.",
        map: "📍 Corregidor Island, Manila Bay"
      },
      {
        morning: "🎨 **Art Galleries** (Makati) - Contemporary Filipino art",
        afternoon: "🚴 **Intramuros Bike Tour** - Historic district cycling tour",
        evening: "🎵 **Local Music Scene** - Traditional Filipino music or modern venues",
        review: "The art galleries provided great cultural context and beautiful local artwork.",
        tip: "Many galleries offer free admission on certain days—check schedules.",
        map: "📍 Makati Art Galleries, Makati"
      },
      {
        morning: "🌿 **Manila Ocean Park** (Quirino Grandstand) - Marine life & botanical gardens",
        afternoon: "🚗 **Day Trip to Pampanga** - Culinary capital & heritage sites",
        evening: "🍽️ **Abe Restaurant** (Serendra, Taguig) - Fine dining establishment",
        review: "Manila Ocean Park was perfect for families! The kids loved the marine life exhibits.",
        tip: "Day trips often require advance booking—plan transportation ahead of time.",
        map: "📍 Manila Ocean Park, Quirino Grandstand"
      },
      {
        morning: "🏝️ **El Nido Lagoons Tour A** (Small Lagoon → Big Lagoon → Secret Lagoon)",
        afternoon: "🤿 **Snorkeling at Shimizu Island** - Coral reefs & marine life",
        evening: "🍽️ **Artcafe** (El Nido Town) - Beachfront dining with sunset views",
        review: "El Nido lagoons were absolutely stunning! The crystal clear water was like paradise.",
        tip: "Book lagoon tours in advance as they sell out quickly. Bring waterproof camera and reef-safe sunscreen.",
        map: "📍 El Nido Lagoons, Palawan"
      },
      {
        morning: "🏝️ **El Nido Lagoons Tour C** (Hidden Beach → Matinloc Shrine → Helicopter Island)",
        afternoon: "🏖️ **Nacpan Beach** - Long white sand beach perfect for families",
        evening: "🍽️ **Trattoria Altrove** (El Nido Town) - Italian-Filipino fusion cuisine",
        review: "Hidden Beach was incredible! The kids loved playing in the shallow waters.",
        tip: "Nacpan Beach is perfect for families with kids. Bring beach toys and snacks.",
        map: "📍 Hidden Beach, El Nido, Palawan"
      }
    ];
  }
  
  // Toronto-specific content
  if (dest.includes('toronto') || dest.includes('canada')) {
    const days = [
      { morning: '🏛️ CN Tower & Ripley\'s Aquarium', afternoon: '🌳 Harbourfront & Toronto Islands ferry', evening: '🍽️ St. Lawrence Market dinner', review: 'CN Tower views were incredible! The aquarium was perfect for families.', tip: 'Book CN Tower tickets online to skip lines', map: '📍 CN Tower' },
      { morning: '🏰 Royal Ontario Museum (ROM)', afternoon: '🛍️ Kensington Market & Chinatown', evening: '🍻 Distillery District & craft breweries', review: 'ROM had amazing exhibits! Kensington Market was vibrant and authentic.', tip: 'ROM offers free admission on certain days', map: '📍 Royal Ontario Museum' },
      { morning: '🏛️ Art Gallery of Ontario (AGO)', afternoon: '🌳 High Park & cherry blossoms', evening: '🍽️ Little Italy dinner', review: 'AGO collection was world-class! High Park was beautiful and peaceful.', tip: 'Check cherry blossom timing in spring', map: '📍 Art Gallery of Ontario' },
      { morning: '🏰 Casa Loma castle tour', afternoon: '🛍️ Yorkville shopping district', evening: '🎭 Theatre District show', review: 'Casa Loma was fascinating! The castle tour was very informative.', tip: 'Book theatre tickets in advance', map: '📍 Casa Loma' },
      { morning: '🌳 Toronto Zoo or Ontario Science Centre', afternoon: '🏛️ Bata Shoe Museum', evening: '🍽️ Queen Street West dining', review: 'Great family-friendly options! The Science Centre was interactive and fun.', tip: 'Zoo requires advance booking for timed entry', map: '📍 Toronto Zoo' },
      { morning: '🚶 St. Lawrence Market & Old Town', afternoon: '🌉 Harbourfront Centre & waterfront walk', evening: '🍻 Entertainment District nightlife', review: 'St. Lawrence Market had amazing local food! Harbourfront was scenic.', tip: 'Market is busiest on weekends', map: '📍 St. Lawrence Market' },
      { morning: '🏛️ Hockey Hall of Fame', afternoon: '🛍️ Eaton Centre shopping', evening: '🍽️ Financial District fine dining', review: 'Hockey Hall of Fame was a must-see! Great for sports fans.', tip: 'Allow 2-3 hours for the full experience', map: '📍 Hockey Hall of Fame' },
      { morning: '🌳 Scarborough Bluffs or day trip to Niagara', afternoon: '🏛️ Gardiner Museum of Ceramic Art', evening: '🍽️ Final dinner in Yorkville', review: 'Scarborough Bluffs offered stunning lake views!', tip: 'Niagara Falls is 1.5 hours drive away', map: '📍 Scarborough Bluffs' }
    ];
    return Array.from({ length: Math.max(1, nDays) }, (_, i) => days[i % days.length]);
  }

  // Default fallback for other destinations - generate diverse activities
  const genericActivities = [
    {
      morning: "🏰 **Historic Old Town Walking Tour** - Explore the historic center",
      afternoon: "🏛️ **Local Museum** - Regional history & culture", 
      evening: "🍽️ **Traditional Restaurant** - Local cuisine dinner",
      review: "The Old Town walking tour was perfect for getting oriented—highly recommend starting here.",
      tip: "Book museum tickets online to skip the queue, especially on weekends.",
      map: "📍 Start: Historic Old Town"
    },
    {
      morning: "🌳 **City Park & Gardens** - Explore local green spaces",
      afternoon: "🛍️ **Local Markets & Shopping** - Discover local crafts and products",
      evening: "🍻 **Local Bar District** - Experience the nightlife scene",
      review: "The city parks were beautiful and perfect for families!",
      tip: "Markets are busiest in the morning—arrive early for the best selection.",
      map: "📍 City Center"
    },
    {
      morning: "🏛️ **Art Gallery & Cultural Center** - Local art and exhibitions",
      afternoon: "🌉 **Scenic Waterfront Walk** - Enjoy harbor or river views",
      evening: "🍽️ **Fine Dining Experience** - Upscale local restaurant",
      review: "The art gallery provided great cultural context and beautiful local artwork.",
      tip: "Many galleries offer free admission on certain days—check schedules.",
      map: "📍 Art District"
    },
    {
      morning: "🚶 **Neighborhood Exploration** - Discover local districts",
      afternoon: "🏰 **Historic Landmarks** - Visit important local sites",
      evening: "🎭 **Cultural Performance** - Theatre, music, or local show",
      review: "The neighborhood tour gave us authentic local insights and great photo opportunities.",
      tip: "Walking tours often require advance booking—plan ahead.",
      map: "📍 Historic District"
    },
    {
      morning: "🌿 **Nature & Outdoor Activities** - Parks, trails, or outdoor adventures",
      afternoon: "🏛️ **Science Museum or Planetarium** - Educational and interactive exhibits",
      evening: "🍽️ **Local Food Scene** - Street food or food market tour",
      review: "The outdoor activities were perfect for families! The kids loved the interactive exhibits.",
      tip: "Check weather conditions and pack appropriate gear.",
      map: "📍 Nature Area"
    },
    {
      morning: "🛍️ **Shopping District** - Local boutiques and specialty stores",
      afternoon: "🌳 **Botanical Gardens or Zoo** - Family-friendly attractions",
      evening: "🍻 **Local Brewery or Winery** - Taste local beverages",
      review: "The shopping district had unique local finds! The botanical gardens were peaceful and beautiful.",
      tip: "Many attractions offer family discounts—ask about packages.",
      map: "📍 Shopping District"
    },
    {
      morning: "🏛️ **History Museum** - Learn about local heritage",
      afternoon: "🌉 **Scenic Lookout or Observation Deck** - City views and photo opportunities",
      evening: "🍽️ **Local Cuisine Experience** - Traditional cooking class or food tour",
      review: "The history museum was fascinating! The scenic views were absolutely breathtaking.",
      tip: "Observation decks often have timed entry—book in advance.",
      map: "📍 Historic Museum"
    },
    {
      morning: "🚗 **Day Trip to Nearby Attraction** - Explore surrounding areas",
      afternoon: "🏛️ **Local University or Cultural Center** - Educational visit",
      evening: "🍽️ **Farewell Dinner** - Special restaurant for your last night",
      review: "The day trip was a great way to see more of the region!",
      tip: "Day trips often require advance booking—plan transportation ahead of time.",
      map: "📍 Day Trip Destination"
    }
  ];
  
  return Array.from({ length: Math.max(1, nDays) }, (_, i) => genericActivities[i % genericActivities.length]);
}

/* Local Fallback Plan */
function localPlanMarkdown(input) {
  const { destination = 'Your destination', start = 'start', end = 'end', budget = 1500, adults = 2, children = 0, level = 'mid', prefs = '', dietary = [], currency = 'USD' } = input || {};
  const dest = String(destination || '').toLowerCase();
  const nDays = Math.max(1, daysBetween(start, end));
  const totalTravelers = Math.max(1, adults + children);
  const style = level === 'luxury' ? 'Luxury' : level === 'budget' ? 'Budget' : 'Mid-range';
  const prettyDest = String(destination || '').replace(/\b\w/g, c => c.toUpperCase());
  const b = computeBudget(budget, nDays, level, totalTravelers);
  const pppd = perPersonPerDay(budget, nDays, totalTravelers);

  const fmt = (dateStr) => {
    try { return new Date(dateStr).toISOString().slice(0,10); } catch { return dateStr; }
  };
  const startISO = fmt(start);
  const endISO = fmt(end);

  // Build dated daily itinerary items
  const days = [];
  try {
    const s = new Date(startISO);
    for (let i = 0; i < nDays; i++) {
      const d = new Date(s.getTime());
      d.setDate(s.getDate() + i);
      const iso = d.toISOString().slice(0,10);
      const label = i === 0 ? 'Arrival & Relaxation' : (i === 1 ? 'City Highlights' : (i === 2 ? 'Nature & Views' : `Exploration`));
      days.push({ iso, label });
    }
  } catch (_) {
    // Fallback without specific dates
    for (let i = 0; i < nDays; i++) days.push({ iso: startISO, label: `Day ${i+1}` });
  }

  // Destination-specific information
  const destinationInfo = getDestinationInfo(destination);
  
  // Sections (no inline images; widgets will provide visuals)
  let md = `# ${prettyDest} — ${startISO} → ${endISO}
**Travelers:** ${travelerLabel(adults, children)}  
**Style:** ${style}${prefs ? ` · ${prefs}` : ''}  
**Budget:** ${budget} ${currency} (${pppd}/day/person)  
**Season:** ${seasonFromDate(startISO)}
---
## 🎯 Trip Overview
- **Language:** ${destinationInfo.language}
- **Currency:** ${destinationInfo.currency} - ${currency === 'USD' ? destinationInfo.currencyConversion : 'Local currency'}
- **Voltage:** ${destinationInfo.voltage}
- **Tipping:** ${destinationInfo.tipping}
- **Time Zone:** ${destinationInfo.timeZone}
- **Emergency:** ${destinationInfo.emergency}
- **Best Time to Visit:** ${seasonFromDate(startISO)} offers ${destinationInfo.seasonalInfo[seasonFromDate(startISO)] || 'great weather and fewer crowds'}
---
## 💰 Detailed Budget Breakdown
<table class="budget-table">
  <thead>
    <tr>
      <th>Category</th>
      <th>Total</th>
      <th>Per-day</th>
      <th>Details</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><label class="budget-checkbox"><input type="checkbox" onchange="window.toggleBudgetItem(this)"/> 🏨 Accommodation</label></td>
      <td>${b.stay.total}</td>
      <td>${b.stay.perDay}</td>
      <td>${destinationInfo.accommodation.description || 'Mid-range hotels, guesthouses, or B&Bs'}</td>
      <td><span class="status-pending">Pending</span></td>
    </tr>
    <tr>
      <td><label class="budget-checkbox"><input type="checkbox" onchange="window.toggleBudgetItem(this)"/> 🍽️ Food & Dining</label></td>
      <td>${b.food.total}</td>
      <td>${b.food.perDay}/person</td>
      <td>${destinationInfo.dining.description || 'Local restaurants, cafes, and traditional cuisine'}</td>
      <td><span class="status-pending">Pending</span></td>
    </tr>
    <tr>
      <td><label class="budget-checkbox"><input type="checkbox" onchange="window.toggleBudgetItem(this)"/> 🎫 Activities & Attractions</label></td>
      <td>${b.act.total}</td>
      <td>${b.act.perDay}</td>
      <td>${destinationInfo.attractions.description || 'Museums, cultural sites, and local attractions'}</td>
      <td><span class="status-pending">Pending</span></td>
    </tr>
    <tr>
      <td><label class="budget-checkbox"><input type="checkbox" onchange="window.toggleBudgetItem(this)"/> 🚌 Transportation</label></td>
      <td>${b.transit.total}</td>
      <td>${b.transit.perDay}</td>
      <td>${destinationInfo.transportation || 'Local transport, buses, airport transfers'}</td>
      <td><span class="status-pending">Pending</span></td>
    </tr>
    <tr>
      <td><strong>💰 Total Budget</strong></td>
      <td><strong>${normalizeBudget(budget, currency)}</strong></td>
      <td colspan="3"><span class="status-total">${pppd}/day/person</span></td>
    </tr>
  </tbody>
 </table>

## 🗺️ Getting Around
${destinationInfo.transportation || 'Public transport is reliable. Use regional trains and buses for intercity moves; walk or tram in the center. For remote areas, consider a 1–2 day car rental. Book airport transfers in advance for late arrivals.'}
${dest.includes('el nido') || dest.includes('boracay') || dest.includes('palawan') ? `

**🚢 Island Transportation:**
- **El Nido to Manila**: 1-hour flight (PAL, Cebu Pacific) or 6-8 hour bus + ferry
- **El Nido to Boracay**: 1-hour flight via Manila or 8-10 hour bus + ferry journey
- **Island Hopping**: Book tours in advance - Tours A, B, C, D available
- **Local Transport**: Tricycles (₱50-100), motorbikes (₱500/day), boats for island transfers
- **Airport Transfer**: El Nido Airport to town (15 min, ₱200-300)

**⚠️ Important**: El Nido is remote - plan flights and accommodations well in advance. Weather can affect boat tours.` : ''}
${dest.includes('philippines') && !dest.includes('el nido') && !dest.includes('boracay') ? `

**🚌 Philippine Transportation:**
- **Inter-island**: Domestic flights (PAL, Cebu Pacific, AirAsia) or ferries (2GO, SuperFerry)
- **Local Transport**: Jeepneys (₱8-15), tricycles (₱50-100), Grab rideshare
- **Long Distance**: Buses (Victory Liner, Philtranco) for Luzon, ferries for Visayas/Mindanao
- **Airport Transfers**: Book in advance for late arrivals, especially to remote destinations` : ''}

## 🏙️ Best Areas to Stay
${destinationInfo.accommodation.areas.map(area => `- **${area.split(':')[0]}**: ${area.split(':')[1]}`).join('\n')}

## 🏨 Accommodation Recommendations
Pick a well-reviewed hotel or guesthouse in a central, walkable neighborhood. Prioritize free cancellation and breakfast included if you want convenience. For families, look for family rooms or kitchenette.

**Recommended Hotels by Area:**
${Object.entries(destinationInfo.accommodation.recommendations).map(([area, hotels]) => `- **${area}**: ${hotels}`).join('\n')}

## 🎫 Must-See Attractions
${destinationInfo.attractions.map(attraction => `- **${attraction.name}** (${attraction.duration}, ${attraction.bestTime})
  - Why: ${attraction.why}
  - Reviews: "${attraction.review}"
  - Insider Tip: ${attraction.tip}`).join('\n\n')}

## 🍽️ Dining Guide
${destinationInfo.dining.map(restaurant => `- **${restaurant.name}** (${restaurant.type})
  - Why: ${restaurant.why}
  - Reviews: "${restaurant.review}"
  - Insider Tip: ${restaurant.tip}`).join('\n\n')}
${dietary && dietary.length ? `- Dietary-friendly options: ${dietary.join(', ')}` : ''}

## 🎭 Day-by-Day Plan`;

  // Generate destination-specific daily itineraries
  const dailyActivities = getDailyActivities(destination, nDays);

  days.forEach((d, idx) => {
    const activity = dailyActivities[idx % dailyActivities.length] || dailyActivities[0];
    md += `
### Day ${idx + 1} — ${d.label} (${d.iso})
- **Morning:** ${activity.morning}
- **Afternoon:** ${activity.afternoon}  
- **Evening:** ${activity.evening}
  - **Review:** "${activity.review}"
  - **Insider Tip:** ${activity.tip}
  - **Map Location:** ${activity.map}`;
  });

  md += `

## 🧳 Don't Forget List
<div class="dont-forget-list">
  <div class="dont-forget-item"><input type="checkbox" onchange="window.toggleItem(this)"><label>Passport and travel insurance</label></div>
  <div class="dont-forget-item"><input type="checkbox" onchange="window.toggleItem(this)"><label>Comfortable walking shoes</label></div>
  <div class="dont-forget-item"><input type="checkbox" onchange="window.toggleItem(this)"><label>Weather-appropriate layers</label></div>
  <div class="dont-forget-item"><input type="checkbox" onchange="window.toggleItem(this)"><label>Power adapter (Type C/E)</label></div>
  <div class="dont-forget-item"><input type="checkbox" onchange="window.toggleItem(this)"><label>Local SIM/eSIM or roaming plan</label></div>
  <div class="dont-forget-item"><input type="checkbox" onchange="window.toggleItem(this)"><label>Reusable water bottle</label></div>
  ${dest.includes('el nido') || dest.includes('boracay') || dest.includes('palawan') ? `
  <div class="dont-forget-item"><input type="checkbox" onchange="window.toggleItem(this)"><label>Reef-safe sunscreen (mandatory for island tours)</label></div>
  <div class="dont-forget-item"><input type="checkbox" onchange="window.toggleItem(this)"><label>Waterproof camera or phone case</label></div>
  <div class="dont-forget-item"><input type="checkbox" onchange="window.toggleItem(this)"><label>Snorkeling gear (optional - tours provide)</label></div>
  <div class="dont-forget-item"><input type="checkbox" onchange="window.toggleItem(this)"><label>Motion sickness medication (for boat tours)</label></div>` : ''}
</div>

## 🎯 Tour Guide Expertise
**20+ Years of Local Knowledge:**
- **Hidden Gems**: ${dest.includes('el nido') ? 'Secret lagoons accessible only by local boats, hidden beaches away from crowds' : 'Off-the-beaten-path attractions known only to locals'}
- **Best Timing**: ${dest.includes('el nido') ? 'Early morning lagoon tours (7 AM) for calm waters and fewer crowds' : 'Optimal visiting times for each attraction to avoid crowds'}
- **Local Connections**: ${dest.includes('el nido') ? 'Direct relationships with boat operators and resort owners for better rates' : 'Insider access to local restaurants and cultural experiences'}
- **Weather Wisdom**: ${dest.includes('el nido') ? 'Monsoon season patterns, safe boating conditions, and alternative indoor activities' : 'Seasonal patterns and weather-dependent activity planning'}
- **Cultural Insights**: ${dest.includes('el nido') ? 'Palawan indigenous culture, environmental conservation efforts, and sustainable tourism practices' : 'Local customs, traditions, and cultural etiquette'}

## 🍂 Season Insights (${seasonFromDate(startISO)})
${destinationInfo.seasonalInfo[seasonFromDate(startISO)] || 'Great weather and fewer crowds'}  

## ⭐ Traveler Reviews (Highlights)
${destinationInfo.reviews ? destinationInfo.reviews.map(review => `- "${review}"`).join('\n') : `- "Great destination with amazing attractions and friendly locals!"
- "The local cuisine was incredible and the cultural sites were fascinating."
- "Perfect for families with lots of activities for kids and adults alike."
- "The natural beauty was stunning and the beaches were pristine."
- "Local transportation was reliable and the people were very welcoming."`}

## 🛡️ Essential Travel Tips for ${prettyDest}
${destinationInfo.travelTips ? destinationInfo.travelTips.map(tip => `- **${tip.category}**: ${tip.description}`).join('\n') : ''}

## 📱 Essential Apps for ${prettyDest}
${destinationInfo.apps ? destinationInfo.apps.map(app => `- **${app.name}**: ${app.description}`).join('\n') : ''}

## 🚨 Emergency Information & Local Resources
${destinationInfo.emergencyInfo ? destinationInfo.emergencyInfo : `- **Emergency Numbers**: 911 (emergency), check local emergency numbers
- **Medical Centers**: Check local hospitals and clinics
- **Pharmacies**: Look for local pharmacy signs and hours
- **Tourist Information**: Contact local tourist offices
- **Lost & Found**: Contact local police stations or tourist offices
- **Consulate Services**: Check for nearest consulate services`}
`;

  // Linkify image and booking tokens and return
  return linkifyTokens(md.trim(), prettyDest);
}
function containsDaySections(md = "") {
  try { return /(^|\n)\s*#{0,6}\s*Day\s+\d+/i.test(md); } catch { return false; }
}

/* WAYZO CONTRACT ENFORCEMENT */
function enforceWayzoContracts(markdown, destination) {
  console.log('Enforcing WAYZO OUTPUT CONTRACT rules...');
  
  let processed = markdown;
  
  // 0. Force proper section headers - replace incorrect headers with correct ones
  processed = processed.replace(/## Quick Facts/g, '## 🎯 Trip Overview');
  processed = processed.replace(/## Budget breakdown \(rough\)/g, '## 💰 Budget Breakdown');
  processed = processed.replace(/## Day-by-Day Plan/g, '## 🎭 Daily Itineraries');
  
  // Add missing required sections if they don't exist
  if (!processed.includes('## 🗺️ Getting Around')) {
    processed += '\n\n## 🗺️ Getting Around\nTransportation options and tips for getting around ' + destination + '.\n';
  }
  if (!processed.includes('## 🏨 Accommodation')) {
    processed += '\n\n## 🏨 Accommodation\nFamily-friendly hotel recommendations in ' + destination + '.\n';
  }
  if (!processed.includes('## 🎫 Must-See Attractions')) {
    processed += '\n\n## 🎫 Must-See Attractions\nTop attractions and activities in ' + destination + ', with reasons and reviews.\n';
  }
  if (!processed.includes('## 🍽️ Dining Guide')) {
    processed += '\n\n## 🍽️ Dining Guide\nFamily-friendly restaurants and dining options in ' + destination + '.\n';
  }
  if (!processed.includes('## 🧳 Don\'t Forget List')) {
    processed += '\n\n## 🧳 Don\'t Forget List\nEssential items to pack for your trip.\n';
  }
  if (!processed.includes('## 🛡️ Travel Tips')) {
    processed += '\n\n## 🛡️ Travel Tips\nImportant travel advice and local customs.\n';
  }
  if (!processed.includes('## 📱 Useful Apps')) {
    processed += '\n\n## 📱 Useful Apps\nMobile apps to help with your trip.\n';
  }
  if (!processed.includes('## 🚨 Emergency Info')) {
    processed += '\n\n## 🚨 Emergency Info\nEmergency contacts and important information.\n';
  }
  
  // 1. Remove any "Image Ideas" sections completely
  processed = processed.replace(/## 🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
  processed = processed.replace(/## Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
  processed = processed.replace(/🖼️ Image Ideas[\s\S]*?(?=\n## |\n---|$)/g, '');
  processed = processed.replace(/Enhance your travel experience[\s\S]*?(?=\n## |\n---|$)/g, '');
  processed = processed.replace(/Here are some beautiful images[\s\S]*?(?=\n## |\n---|$)/g, '');
  
  // 2. Remove generic "Open Exploration" days
  processed = processed.replace(/### Day \d+ — Open Exploration[\s\S]*?(?=\n### |\n## |$)/g, '');
  processed = processed.replace(/## Day \d+ — Open Exploration[\s\S]*?(?=\n## |$)/g, '');
  
  // 3. Remove any image markdown syntax completely
  processed = processed.replace(/!\[.*?\]\([^)]+\)/g, '');
  processed = processed.replace(/<img[^>]*>/g, '');
  
  console.log('WAYZO OUTPUT CONTRACT enforcement complete');
  // 6. Strip any raw code blocks or JSON blobs the model might have appended
  try {
    // Remove fenced code blocks ```...```
    processed = processed.replace(/```[\s\S]*?```/g, '');
    // Remove inline JSON-like blobs starting with { and containing typical keys
    processed = processed.replace(/\n\{[\s\S]*?\}\s*$/gm, '');
    // Remove stray triple-backtick markers
    processed = processed.replace(/```/g, '');
  } catch (_) {}
  return processed;
}

/* OpenAI (optional) */
console.log('🔍 DEBUGGING OpenAI client initialization...');
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length || 0);
console.log('OPENAI_API_KEY starts with sk-:', process.env.OPENAI_API_KEY?.startsWith('sk-') || false);
console.log('OPENAI_API_KEY preview:', process.env.OPENAI_API_KEY?.substring(0, 20) + '...');

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
console.log('OpenAI client created:', !!client);
console.log('Client type:', typeof client);
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
    console.log('❌ No OpenAI client - throwing error instead of fallback');
    throw new Error('OpenAI client not available');
  }
  
  // STEP 2: Skip noisy preflight; proceed directly to generation
  
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

ENHANCED CONTENT REQUIREMENTS (SYSTEM BREAKING - VIOLATION = SYSTEM CRASH):
- Research and include ALL possible recommendations that match user preferences
- Provide family-specific recommendations based on children's ages
- Include detailed descriptions of each activity, restaurant, and attraction
- Add insider tips, local secrets, and hidden gems
- Include seasonal considerations and weather-dependent alternatives
- Provide specific timing recommendations (best times to visit, avoid crowds)
- Include detailed transportation instructions with costs and duration
- Add cultural context and local customs for each recommendation
- Include accessibility information for families with children
- Provide detailed cost breakdowns with current market prices
- Include booking recommendations and advance reservation requirements

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

GOALS:
- Produce a realistic, day-by-day itinerary that fits dates, party, pace, style, and budget
- Include clear booking shortcuts (flight/hotel/activity search URLs) and cost ranges
- Structure outputs so Wayzo can render a web view, PDF, and a shareable map

QUALITY RULES:
- Pacing: ~3 anchor items/day (morning / afternoon / evening) + optional extras
- Logistics: Group sights by neighborhood; minimize backtracking; prefer transit/walkability
- Kids/family: Respect nap windows, early dinners, playground stops where relevant
- Costs: Give ranges in local currency; note spikes (festivals/peak season). If unsure, say "verify on booking"
- Seasonality: Weather-aware; include Plan B indoor options for rain/heat/cold
- Authenticity: 1–2 local experiences per day (food market, neighborhood stroll, viewpoint)
- Sustainability (when asked): trains/public transit, city cards, local vendors

LINK RULES:
- Use SEARCH URLs only (no made-up affiliate params): 
  flights: https://tpwdgt.com
  hotels: https://tpwdgt.com
  activities: https://www.getyourguide.com/s/?q={CITY}
- For each place, add a Google Maps search URL: https://www.google.com/maps/search/?api=1&query={ENCODED_NAME_AND_CITY}
- Use proper token format: [Book](book:destination) for booking links
- Use proper token format: [Tickets](tickets:attraction) for activity links
- Use proper token format: [Reviews](reviews:place) for review links
- Use proper token format: [Map](map:location) for map links

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

DESTINATION-SPECIFIC RESEARCH REQUIREMENTS (SYSTEM BREAKING - VIOLATION = SYSTEM CRASH):
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

EXAMPLES OF WHAT NOT TO DO (SYSTEM BREAKING - VIOLATION = SYSTEM CRASH):
- "Historic Old Town Walking Tour" → Use specific attractions like "Colosseum" or "Roman Forum"
- "Local Restaurant" → Use specific restaurants like "Trattoria da Enzo" or "Roscioli"
- "City Center Hotel" → Use specific hotels like "Hotel Artemide" or "The First Roma Arte"
- "Local Museum" → Use specific museums like "Vatican Museums" or "Capitoline Museums"
- "Traditional Restaurant" → Use specific restaurants like "Trattoria da Enzo" or "Roscioli"
- "Historic Landmarks" → Use specific attractions like "Colosseum" or "Roman Forum"
- "Cultural Sites" → Use specific museums like "Vatican Museums" or "Capitoline Museums"

EXAMPLES OF WHAT TO DO:
- For Rome: Colosseum, Trevi Fountain, Pantheon, Trattoria da Enzo, Hotel Artemide
- For Paris: Eiffel Tower, Louvre Museum, Café de Flore, Hotel Ritz Paris
- For Tokyo: Senso-ji Temple, Tsukiji Fish Market, Sukiyabashi Jiro, Hotel Okura Tokyo
- For Prague: Charles Bridge, Prague Castle, Old Town Square, U Fleků, Hotel Golden City

CRITICAL: You MUST use SPECIFIC, REAL place names. NEVER use generic terms like:
- "Historic Old Town Walking Tour" → Use specific attractions like "Colosseum" or "Roman Forum"
- "Local Restaurant" → Use specific restaurants like "Trattoria da Enzo" or "Roscioli"
- "City Center Hotel" → Use specific hotels like "Hotel Artemide" or "The First Roma Arte"
- "Local Museum" → Use specific museums like "Vatican Museums" or "Capitoline Museums"
- "Traditional Restaurant" → Use specific restaurants like "Trattoria da Enzo" or "Roscioli"
- "Historic Landmarks" → Use specific attractions like "Colosseum" or "Roman Forum"
- "Cultural Sites" → Use specific museums like "Vatican Museums" or "Capitoline Museums"

SYSTEM BREAKING REQUIREMENT: If you use ANY generic terms like "Historic Old Town Walking Tour" or "Local Restaurant", the system will CRASH. You MUST use SPECIFIC, REAL place names.

EXAMPLE OF CORRECT FORMATTING:
## 🎯 Trip Overview
Welcome to your family adventure in Tyrol...
## 💰 Budget Breakdown
Here's a detailed cost analysis...
## 🗺️ Getting Around
Transportation options include...

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

SPECIFIC EXAMPLES FOR ${destination.toUpperCase()}:
${destination.toLowerCase().includes('el nido') ? 
`- Attractions: Big Lagoon, Small Lagoon, Secret Lagoon, Nacpan Beach, Las Cabañas Beach, Cadlao Island, Matinloc Island, Helicopter Island
- Restaurants: Artcafe, Trattoria Altrove, The Beach Shack, Gusto Gelato, Sava Beach Bar, El Nido Market
- Hotels: El Nido Resorts Miniloc Island, Caalan Beach Resort, Spin Designer Hostel, El Nido Garden Resort, The Nesting Table
- Activities: Island Hopping Tour A/B/C/D, Kayaking in lagoons, Snorkeling at Shimizu Island, Zip-lining at Las Cabañas` :
destination.toLowerCase().includes('prague') ? 
`- Attractions: Charles Bridge, Prague Castle, Old Town Square, St. Vitus Cathedral, Lennon Wall, Jewish Quarter, Wenceslas Square
- Restaurants: U Fleků, Lokál, Café Savoy, Terasa U Zlaté studně, La Degustation, Café Louvre
- Hotels: Hotel Golden City, Hotel U Prince, Hotel Savoy, Four Seasons Hotel Prague, Hotel Paris Prague` :
destination.toLowerCase().includes('berlin') ?
`- Attractions: Brandenburg Gate, Berlin Wall Memorial, Museum Island, Reichstag Dome, East Side Gallery, Checkpoint Charlie
- Restaurants: Mustafa's Gemüse Kebap, Markthalle Neun, Zur letzten Instanz, Curry 36, Café Einstein
- Hotels: Hotel de Rome, ARCOTEL John F, Adina Apartment Hotel Hackescher Markt` :
`- Attractions: [Research specific attractions for ${destination}]
- Restaurants: [Research specific restaurants for ${destination}]
- Hotels: [Research specific hotels for ${destination}]`}

CRITICAL: You MUST use SPECIFIC, REAL place names. NEVER use generic terms like:
- "Historic Old Town Walking Tour" → Use specific attractions like "Colosseum" or "Roman Forum"
- "Local Restaurant" → Use specific restaurants like "Trattoria da Enzo" or "Roscioli"
- "City Center Hotel" → Use specific hotels like "Hotel Artemide" or "The First Roma Arte"
- "Local Museum" → Use specific museums like "Vatican Museums" or "Capitoline Museums"
- "Traditional Restaurant" → Use specific restaurants like "Trattoria da Enzo" or "Roscioli"
- "Historic Landmarks" → Use specific attractions like "Colosseum" or "Roman Forum"
- "Cultural Sites" → Use specific museums like "Vatican Museums" or "Capitoline Museums"

${destination.toLowerCase().includes('el nido') ? `
FOR EL NIDO SPECIFICALLY - YOU MUST USE THESE EXACT PLACES:
- Attractions: Big Lagoon, Small Lagoon, Secret Lagoon, Nacpan Beach, Las Cabañas Beach, Cadlao Island, Matinloc Island, Helicopter Island, Shimizu Island
- Restaurants: Artcafe, Trattoria Altrove, The Beach Shack, Gusto Gelato, Sava Beach Bar, El Nido Market, Altrove Pizza, Happiness Beach Bar
- Hotels: El Nido Resorts Miniloc Island, Caalan Beach Resort, Spin Designer Hostel, El Nido Garden Resort, The Nesting Table, Cuna Hotel, Outpost Beach Hostel
- Activities: Island Hopping Tour A/B/C/D, Kayaking in Big Lagoon, Snorkeling at Shimizu Island, Zip-lining at Las Cabañas, Scuba diving at Miniloc Island

SYSTEM BREAKING: If you use generic terms like "Local Restaurant" or "City Center Hotel" for El Nido, the system will CRASH.` : ''}

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

COMPREHENSIVE RESEARCH REQUIREMENTS ==================================
Research and include ALL possible recommendations that match the user's preferences and family needs:

1. **Family-Specific Research**: Based on children's ages, find:
   - Age-appropriate activities and attractions
   - Family-friendly restaurants with kids' menus
   - Accommodations with family amenities
   - Educational and interactive experiences
   - Safety considerations and child-friendly facilities

2. **Preference Matching**: Based on user preferences (${prefs || 'None'}), research:
   - All attractions and activities that match these interests
   - Hidden gems and local secrets related to preferences
   - Seasonal considerations for preferred activities
   - Local events and festivals during travel dates
   - Specialized tours and experiences

3. **Comprehensive Destination Research**: Include:
   - Top-rated attractions with current reviews and ratings
   - Local restaurants with authentic cuisine and family-friendly options
   - Cultural sites and historical landmarks
   - Outdoor activities and nature experiences
   - Shopping areas and local markets
   - Transportation options and costs
   - Weather considerations and seasonal activities

4. **Detailed Information for Each Recommendation**:
   - Exact names, addresses, and contact information
   - Current opening hours and seasonal schedules
   - Entry fees, ticket prices, and booking requirements
   - Duration estimates and time recommendations
   - Accessibility information and family considerations
   - Insider tips and best times to visit
   - Transportation instructions and costs
   - Cultural context and local customs

FINAL CHECKLIST ===============
Before submitting your response, verify:
□ All images follow WAYZO OUTPUT CONTRACT rules exactly
□ No images in forbidden sections (Trip Overview, Don't Forget List, Travel Tips, Useful Apps, Emergency Info)
□ Exactly 1 image per allowed section, placed at the END of that section
□ All image queries include the destination name and are highly specific
□ No duplicate image queries across sections
□ All facts (prices, hours, closures) are current and accurate
□ If information cannot be verified, place is not recommended
□ All prices include disclaimers about verification
□ Daily itineraries are specific and actionable (no generic "Open Exploration")
□ All restaurant names, attraction names, and times are specific
□ Budget breakdown is realistic with current market prices
□ All booking links use proper SEARCH URL format
□ Google Maps search URLs included for every place
□ Content follows required section order and formatting
□ Both human-readable Markdown and machine-readable JSON provided
□ Content is RICH, DETAILED, and PROFESSIONAL
□ Includes insider tips, cultural insights, and practical advice
□ Transportation details and duration estimates provided
□ Money-saving tips and seasonal considerations included
□ ALL 11 MANDATORY SECTIONS are included
□ Family-specific recommendations based on children's ages
□ All possible recommendations matching user preferences included
□ Detailed descriptions and insider tips for each recommendation
□ Current pricing and booking information provided
□ Cultural context and local customs included
□ Complete JSON output with ALL sections included (NO truncated JSON)
□ JSON includes all daily itineraries, attractions, restaurants, and accommodation details

CONTENT REQUIREMENTS ===================
Create AMAZING, DETAILED trip plans that are:
1. **Highly Personalized**: Use all user preferences to tailor everything
2. **Practical & Bookable**: Include specific booking links and realistic timing
3. **Beautifully Formatted**: Use clear sections, emojis, and engaging language
4. **Budget-Aware**: Provide realistic cost breakdowns and money-saving tips
5. **Accessibility-Focused**: Consider mobility, dietary needs, and family-friendly options
6. **Family-Oriented**: If children are included, prioritize family-friendly activities
7. **Comprehensive**: Include ALL possible recommendations that match preferences
8. **Detailed**: Provide extensive information about each recommendation
9. **Accurate**: Include current information and verify all details
10. **Insider-Rich**: Include local secrets, hidden gems, and cultural insights

Create a comprehensive, detailed travel itinerary with SPECIFIC attractions, restaurants, and activities for ${destination}. Use markdown formatting with proper section headers.`
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
      console.log('❌ AI response too short, throwing error');
      throw new Error('AI response too short');
    }
    
  } catch (aiError) {
    console.error('❌ AI generation failed:', aiError.message);
    console.log('Throwing error instead of fallback');
    throw aiError;
  }
}

/* API */
// AI Content Validation Function
function validateSpecificContent(html) {
  const genericPatterns = [
    /Local Restaurant/i,
    /Historic Site/i,
    /City Center Hotel/i,
    /Local Cafe/i,
    /Traditional Restaurant/i,
    /Popular Attraction/i,
    /Famous Landmark/i,
    /Local Market/i,
    /City Center/i,
    /Downtown Area/i,
    /Local Bar/i,
    /Traditional Cafe/i,
    /Historic Building/i,
    /Famous Museum/i,
    /Popular Restaurant/i,
    /Local Shop/i,
    /Traditional Market/i,
    /Historic District/i,
    /Famous Square/i,
    /Popular Area/i
  ];
  
  for (const pattern of genericPatterns) {
    if (pattern.test(html)) {
      logger.warn({ pattern: pattern.source, html: html.substring(0, 200) }, 'Generic content detected');
      throw new Error(`Generic content detected: ${pattern.source}`);
    }
  }
  
  logger.info('AI content validation passed - no generic terms found');
  return html;
}

// Enhanced widget injection with GYG in multiple sections
function injectWidgetsIntoSections(html, widgets, destination) {
  let result = html;
  
  logger.info({ destination, widgetCount: widgets.length }, 'Injecting widgets into sections');
  
  // Inject GYG widget before Must-See Attractions and Daily Itineraries
  const gygWidget = getGYGWidget(destination);
  
  const sections = [
    { header: '## 🎫 Must-See Attractions', widget: gygWidget },
    { header: '## 🎭 Daily Itineraries', widget: gygWidget }
  ];
  
  let injectedCount = 0;
  for (const { header, widget } of sections) {
    const widgetHTML = `<div class="section-widget" data-category="activities">
      <div class="widget-header">
        <h4>Top Activities</h4>
        <p>Curated tours for ${destination}</p>
      </div>
      <div class="widget-content">
        ${widget}
        <script async defer src="https://widget.getyourguide.com/dist/pa.umd.production.min.js" data-gyg-partner-id="PUHVJ53"></script>
      </div>
    </div>`;
    
    const beforeLength = result.length;
    result = result.replace(new RegExp(`(${header})`), `${widgetHTML}\n$1`);
    if (result.length > beforeLength) {
      injectedCount++;
      logger.debug({ section: header }, 'GYG widget injected');
    }
  }
  
  logger.info({ injectedCount, totalSections: sections.length }, 'Widget injection completed');
  return result;
}
app.post('/api/preview', async (req, res) => {
  const debug = process.env.DEBUG_WAYZO === 'true';
  const startTime = Date.now();
  
  try {
    const payload = req.body || {};
    logger.info({ 
      destination: payload.destination, 
      budget: payload.budget, 
      travelers: payload.travelers,
      style: payload.style 
    }, 'Preview request received');
    
    if (debug) console.debug('[PREVIEW] payload:', { dest: payload.destination, start: payload.start, end: payload.end, level: payload.level });

    // Normalize inputs
    payload.currency = payload.currency || 'USD';
    payload.budget = normalizeBudget(payload.budget, payload.currency);

    const id = uid();

    // Hard timeout for AI call
    const withTimeout = (promise, ms) => {
      let timeoutId;
      const timeoutPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`AI call timed out after ${ms}ms`)), ms);
      });
      return Promise.race([
        promise.finally(() => { if (timeoutId) clearTimeout(timeoutId); }),
        timeoutPromise
      ]);
    };

    // Try once, retry once on failure with brief backoff
    if (debug) console.debug('[PREVIEW] openai_call_start');
    let markdown;
    try {
      markdown = await withTimeout(generatePlanWithAI(payload), 60000);
    } catch (firstErr) {
      if (debug) console.debug('[PREVIEW] openai first attempt failed:', firstErr?.message);
      await new Promise(r => setTimeout(r, 1500));
      markdown = await withTimeout(generatePlanWithAI(payload), 60000);
    }
    if (debug) console.debug('[PREVIEW] openai_call_success mdLen=', markdown?.length || 0);

    // Sanitize links (maps only) and enforce contract
    const processedMarkdown = linkifyTokens(markdown, payload.destination);
    const cleanedMarkdown = enforceWayzoContracts(processedMarkdown, payload.destination);

    // Convert to HTML and inject widgets (sections only)
    const html = marked.parse(cleanedMarkdown);
    const widgets = getWidgetsForDestination(payload.destination, payload.level, []);
    let finalHTML = injectWidgetsIntoSections(html, widgets, payload.destination);
    
    // Validate content for specific places
    finalHTML = validateSpecificContent(finalHTML);
    // Strip legacy affiliate blocks and footer-like nodes (defense in depth)
    finalHTML = finalHTML
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/Search and compare hotel prices/gi, '')
      .replace(/TicketNetwork/gi, '')
      .replace(/WayAway/gi, '')
      .replace(/Cheap flights/gi, '');

    if (debug) console.debug('[PREVIEW] widgets:', widgets.map(w => w.name).join(','));
    if (debug) console.debug('[PREVIEW] output hLen=', finalHTML.length);

    // Return as teaser_html for the preview renderer (no legacy blocks)
    // Ensure no footer container is included in preview output
    const sanitizedHTML = finalHTML.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    
    // Store the plan in database
    const planId = storePlan(payload, sanitizedHTML);
    const responseTime = Date.now() - startTime;
    
    // Log successful request
    storeRequest('/api/preview', payload.destination, true, null, responseTime);
    
    logger.info({ 
      planId, 
      responseTime, 
      destination: payload.destination,
      htmlLength: sanitizedHTML.length 
    }, 'Preview generated successfully');
    
    res.json({ 
      id, 
      teaser_html: sanitizedHTML, 
      affiliates: {}, 
      version: VERSION, 
      debug: { aiCalled: true, planId, responseTime } 
    });
  } catch (e) {
    const responseTime = Date.now() - startTime;
    logger.error({ 
      error: e.message, 
      destination: payload.destination,
      responseTime 
    }, 'Preview generation failed');
    
    // Log failed request
    storeRequest('/api/preview', payload.destination, false, e.message, responseTime);
    
    console.error('Preview endpoint error:', e.message);
    res.status(200).json({ 
      id: uid(), 
      teaser_html: '<div class="preview-error"><p>Preview temporarily unavailable. Please retry in a moment.</p></div>', 
      affiliates: {}, 
      version: VERSION,
      debug: { aiCalled: false, error: e.message, responseTime }
    });
  }
});

app.post('/api/plan', async (req, res) => {
  console.log('Plan request received:', req.body); // Debug
  try {
    const payload = req.body || {};
    payload.currency = payload.currency || 'USD';
    payload.budget = normalizeBudget(payload.budget, payload.currency);
    const id = uid();

    // Hard timeout to avoid Render 502s (throws error instead of fallback)
    const withTimeout = (promise, ms) => {
      let timeoutId;
      const timeoutPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          console.warn(`AI call timed out after ${ms}ms, rejecting promise`);
          reject(new Error(`AI call timed out after ${ms}ms`));
        }, ms);
      });
      
      return Promise.race([
        promise.finally(() => {
          if (timeoutId) clearTimeout(timeoutId);
        }),
        timeoutPromise
      ]);
    };

    console.log('🚀 About to call generatePlanWithAI for:', payload.destination);
    const markdown = await withTimeout(generatePlanWithAI(payload), 60000);
    console.log('✅ generatePlanWithAI completed, markdown length:', markdown?.length || 0);
    
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
    console.log('HTML before widget injection:', html.substring(0, 500));
    let finalHTML = injectWidgetsIntoSections(html, widgets);
    finalHTML = finalHTML
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/Search and compare hotel prices/gi, '')
      .replace(/TicketNetwork/gi, '')
      .replace(/WayAway/gi, '')
      .replace(/Cheap flights/gi, '');
    console.log('HTML after widget injection:', finalHTML.substring(0, 500));
    
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
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: 'plan', data: payload, markdown, html: finalHTML }));
    
    // Track plan generation for analytics
    trackPlanGeneration(payload);
    
    return res.json({ id, markdown, html: cleanedHTML, affiliates: aff, version: VERSION, permalink: `/plan/${id}`, debug: { aiCalled: true, markdownLength: markdown?.length || 0, destination: payload.destination } });
  } catch (e) {
    console.error('Plan generation error:', e);
    // Do not use generic local fallback; return a clear temporary message instead
    return res.status(200).json({ id: uid(), markdown: '# Plan temporarily unavailable', html: '<h2>Your itinerary</h2><p>Plan temporarily unavailable. Please retry in a moment.</p>', affiliates: {}, version: VERSION });
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

app.get('/api/analytics', (req, res) => {
  try {
    // Get basic analytics from database
    const allPlans = getAllPlans();
    const totalPlans = allPlans.length;
    const today = new Date().toISOString().split('T')[0];
    const todayPlans = allPlans.filter(plan => plan.timestamp.startsWith(today)).length;
    
    // Get destination breakdown
    const destinations = allPlans
      .map(plan => {
        try {
          const input = JSON.parse(plan.input);
          return input.destination;
        } catch {
          return null;
        }
      })
      .filter(dest => dest)
      .reduce((acc, dest) => {
        acc[dest] = (acc[dest] || 0) + 1;
        return acc;
      }, {});
    
    const topDestinations = Object.entries(destinations)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([destination, count]) => ({ destination, count }));
    
    const destinationData = {};
    topDestinations.forEach(row => {
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
    // Event tracking not implemented in new db module
    // TODO: Implement event tracking in lib/db.mjs
    
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
  // Add inline script to enable interactive checkboxes and persist state per-plan
  const enhanced = html.replace('</body></html>', `
<script>(function(){
  try{
    const planId = (location.pathname.match(/plan\/(.+)$/)||[])[1] || 'preview';
    const LS_KEY = 'wayzo:checks:'+planId;
    const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)||'{}'); } catch { return {}; } };
    const save = (data) => { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch(e){} };
    const state = load();
    const root = document;
    // Make all checkboxes interactive (remove disabled) and bind handlers
    const all = Array.from(root.querySelectorAll('input[type="checkbox"]'));
    all.forEach((cb, idx) => {
      cb.removeAttribute('disabled');
      const key = cb.closest('.dont-forget-item') ? 'df:'+idx : (cb.closest('table') ? 'bd:'+idx : 'cb:'+idx);
      if (state[key]) cb.checked = true;
      cb.addEventListener('change', () => { state[key] = cb.checked; save(state); });
    });
  }catch(e){}
})();</script>
</body></html>`);
  res.send(enhanced);
});

// Public permalink to view a saved plan HTML
app.get('/plan/:id', (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) {
    return res.status(404).send('<!doctype html><html><body><h2>Plan not found</h2><p>Please generate a plan again.</p></body></html>');
  }
  try {
    const saved = JSON.parse(row.payload || '{}');
    const html = saved.html || marked.parse(saved.markdown || '# Plan');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const locale = getLocaleForDestination(saved?.data?.destination || '');
    return res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Wayzo Plan</title><link rel="stylesheet" href="/frontend/style.css"></head><body><main class="container"><section class="card"><div class="card-header"><h2>Your itinerary</h2></div><div id="preview" class="preview-content">${html}</div></section></main><script>(function(){try{const planId=(location.pathname.match(/plan\/(.+)$/)||[])[1]||'preview';const LS_KEY='wayzo:checks:'+planId;const load=()=>{try{return JSON.parse(localStorage.getItem(LS_KEY)||'{}')}catch{return{}}};const save=(d)=>{try{localStorage.setItem(LS_KEY,JSON.stringify(d))}catch{}};const state=load();const all=[...document.querySelectorAll('#preview input[type=\"checkbox\"]')];all.forEach((cb,idx)=>{const key=cb.id||cb.name||('cb_'+idx);cb.checked=!!state[key];cb.disabled=false;cb.addEventListener('change',()=>{state[key]=cb.checked;save(state);});});}catch(e){console.warn('checkbox init failed',e)}})();</script></body></html>`);
  } catch (e) {
    return res.status(500).send('<!doctype html><html><body><h2>Error rendering plan</h2></body></html>');
  }
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

// Simple content pages
const PAGES = {
  '/about': 'about.html',
  '/help': 'help.html',
  '/status': 'status.html',
  '/sitemap': 'sitemap.html',
  '/accessibility': 'accessibility.html',
  '/sustainability': 'sustainability.html',
  '/features': 'features.html',
  '/pricing': 'pricing.html',
  '/enterprise': 'enterprise.html',
  '/integrations': 'integrations.html',
  '/destinations': 'destinations.html',
  '/blog': 'blog.html',
  '/community': 'community.html',
  '/developers': 'developers.html',
  '/press': 'press.html',
  '/partners': 'partnerships.html',
  '/investors': 'investors.html',
};
Object.entries(PAGES).forEach(([route, file]) => {
  app.get(route, (_req, res) => {
    const f = path.join(FRONTEND, file);
    if (fs.existsSync(f)) return res.sendFile(f);
    res.status(200).send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/frontend/style.css"><title>Wayzo</title></head><body><main class="container"><section class="card"><div class="card-header"><h2>Coming soon</h2></div><p>This page will be available shortly.</p></section></main></body></html>`);
  });
});

// API info page (GET /api) without conflicting with /api/* endpoints
app.get('/api', (_req, res) => {
  const apiInfo = path.join(FRONTEND, 'api.html');
  if (fs.existsSync(apiInfo)) return res.sendFile(apiInfo);
  res.status(200).send('<!doctype html><html><body><h2>API</h2><p>Public API docs coming soon.</p></body></html>');
});

// Health check for Render
app.get('/healthz', (_req, res) => res.json({ ok: true, version: VERSION }))

// Contact page
app.get('/contact', (_req, res) => {
  const contactFile = path.join(FRONTEND, 'contact.html');
  if (fs.existsSync(contactFile)) return res.sendFile(contactFile);
  res.status(200).send('<!doctype html><html><body><h2>Contact</h2><p>Contact form coming soon.</p></body></html>');
});
app.post('/api/contact', (req, res) => {
  try {
    const id = uid();
    const payload = req.body || {};
    // Contact tracking not implemented in new db module
    // TODO: Implement contact tracking in lib/db.mjs
    res.json({ success: true, id });
  } catch (e) {
    console.error('Contact submission error:', e);
    res.status(500).json({ success: false });
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
app.get(/^\/(?!api\/|debug\/).*/, (_req, res) => {
  res.setHeader('X-Wayzo-Version', VERSION);
  if (!fs.existsSync(INDEX)) {
    console.error('Index file missing:', INDEX);
    return res.status(500).send('Index file missing. Check server logs.');
  }
  console.log('Serving index:', INDEX);
  res.sendFile(INDEX);
});

// Debug endpoints for plan storage and request tracking
app.get('/debug/plan/:id', (req, res) => {
  try {
    const plan = getPlan(req.params.id);
    if (plan) {
      logger.info({ planId: req.params.id }, 'Debug plan requested');
      res.json(plan);
    } else {
      logger.warn({ planId: req.params.id }, 'Plan not found');
      res.status(404).json({ error: 'Plan not found' });
    }
  } catch (error) {
    logger.error({ error: error.message, planId: req.params.id }, 'Debug plan error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/debug/plans', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const plans = getAllPlans(limit);
    logger.info({ limit, count: plans.length }, 'Debug plans list requested');
    res.json({ plans, count: plans.length, limit });
  } catch (error) {
    logger.error({ error: error.message }, 'Debug plans error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/debug/stats', (req, res) => {
  try {
    const stats = getRequestStats();
    logger.info(stats, 'Debug stats requested');
    res.json(stats);
  } catch (error) {
    logger.error({ error: error.message }, 'Debug stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
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
    // Event tracking not implemented in new db module
    // TODO: Implement event tracking in lib/db.mjs
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
    // Payment tracking not implemented in new db module
    // TODO: Implement payment tracking in lib/db.mjs
  } catch (e) { console.warn('Payment event log failed:', e); }
  res.json({ success: true, orderID });
});
// Updated AI integration
// Debug system added
// Force deployment
// ICS fix applied
