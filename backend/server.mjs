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

const VERSION = 'staging-v25-enhanced';

// Enhanced validation and error handling
const validateTripRequest = (payload) => {
  const errors = [];
  const warnings = [];
  
  if (!payload.destination || payload.destination.trim().length < 2) {
    errors.push('Destination must be at least 2 characters long');
  }
  
  if (!payload.start || !payload.end) {
    errors.push('Start and end dates are required');
  } else {
    const startDate = new Date(payload.start);
    const endDate = new Date(payload.end);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      errors.push('Invalid date format');
    } else if (startDate < today) {
      errors.push('Start date cannot be in the past');
    } else if (endDate <= startDate) {
      errors.push('End date must be after start date');
    } else if (endDate > new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000)) {
      warnings.push('Trip is more than 1 year in the future');
    }
  }
  
  if (!payload.budget || payload.budget < 50) {
    errors.push('Budget must be at least 50');
  } else if (payload.budget > 100000) {
    warnings.push('Budget is very high - consider breaking into smaller trips');
  }
  
  if (!payload.adults || payload.adults < 1) {
    errors.push('At least 1 adult traveler is required');
  } else if (payload.adults > 20) {
    warnings.push('Large group - consider group booking options');
  }
  
  if (payload.children && payload.children < 0) {
    errors.push('Children count cannot be negative');
  }
  
  return { errors, warnings, isValid: errors.length === 0 };
};

// Enhanced trip analysis
const analyzeTrip = (payload) => {
  const { destination, start, end, budget, adults, children, level, prefs } = payload;
  const days = daysBetween(start, end);
  const totalTravelers = (adults || 0) + (children || 0);
  const budgetPerPerson = budget / totalTravelers;
  const budgetPerDay = budget / days;
  const budgetPerPersonPerDay = budgetPerPerson / days;
  
  const season = seasonFromDate(start);
  const isPeakSeason = ['Summer', 'Winter'].includes(season);
  const isWeekend = [0, 6].includes(new Date(start).getDay());
  
  const analysis = {
    tripMetrics: {
      duration: days,
      totalTravelers,
      budgetPerPerson: Math.round(budgetPerPerson),
      budgetPerDay: Math.round(budgetPerDay),
      budgetPerPersonPerDay: Math.round(budgetPerPersonPerDay)
    },
    seasonalFactors: {
      season,
      isPeakSeason,
      priceMultiplier: isPeakSeason ? 1.3 : 1.0
    },
    timingFactors: {
      isWeekend,
      advanceNotice: Math.round((new Date(start) - new Date()) / (1000 * 60 * 60 * 24))
    },
    recommendations: []
  };
  
  // Generate smart recommendations
  if (budgetPerPersonPerDay < 50) {
    analysis.recommendations.push('Consider budget accommodations and local dining');
  } else if (budgetPerPersonPerDay > 200) {
    analysis.recommendations.push('Luxury options available - consider premium experiences');
  }
  
  if (days < 3) {
    analysis.recommendations.push('Short trip - focus on key highlights and efficient routing');
  } else if (days > 14) {
    analysis.recommendations.push('Extended stay - consider weekly rates and local experiences');
  }
  
  if (children > 0) {
    analysis.recommendations.push('Family-friendly activities and flexible scheduling recommended');
  }
  
  if (isPeakSeason) {
    analysis.recommendations.push('Peak season - book accommodations and activities early');
  }
  
  return analysis;
};

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
  const { destination = '', start = '', end = '', budget = 0, currency = 'USD $', adults = 2, children = 0, level = 'mid', prefs = '', diet = '' } = payload || {};
  const nDays = daysBetween(start, end);
  const sys = `Return Markdown ONLY.
Sections:
- Quick Facts (language, currency, voltage, tipping)
- Budget breakdown (rough)
- Day-by-Day Plan with ### Day X — Title and Morning/Afternoon/Evening bullets, each with a short note.
Use token links: [Map](map:query) [Tickets](tickets:query) [Book](book:query) [Reviews](reviews:query).`;
  const user = `Destination: ${destination}
Dates: ${start} to ${end} (${nDays} days)
Party: ${adults} adults${children ? `, ${children} children` : ""}
Style: ${level}${prefs ? ` + ${prefs}` : ""}
Budget: ${budget} ${currency}
Diet: ${diet}`;
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
  
  try {
    const payload = req.body || {};
    
    // Validate request
    const validation = validateTripRequest(payload);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors,
        warnings: validation.warnings,
        version: VERSION
      });
    }
    
    payload.budget = normalizeBudget(payload.budget, payload.currency);
    const id = uid();
    const aff = affiliatesFor(payload.destination || '');
    
    // Generate rich preview with analysis
    const analysis = analyzeTrip(payload);
    const teaser_html = `
<div class="trip-preview">
  <h3 class="h3">${payload.destination || 'Your destination'} — Smart Preview</h3>
  <div class="trip-metrics">
    <div class="metric">
      <span class="metric-value">${analysis.tripMetrics.duration}</span>
      <span class="metric-label">days</span>
    </div>
    <div class="metric">
      <span class="metric-value">${analysis.tripMetrics.totalTravelers}</span>
      <span class="metric-label">travelers</span>
    </div>
    <div class="metric">
      <span class="metric-value">${payload.currency} ${analysis.tripMetrics.budgetPerPersonPerDay}</span>
      <span class="metric-label">per person/day</span>
    </div>
  </div>
  <div class="trip-insights">
    <p><strong>Season:</strong> ${analysis.seasonalFactors.season} ${analysis.seasonalFactors.isPeakSeason ? '🌡️ Peak season' : '🌿 Off-peak'}</p>
    <p><strong>Timing:</strong> ${analysis.timingFactors.advanceNotice} days advance notice</p>
  </div>
  <div class="recommendations">
    <h4>Smart Recommendations:</h4>
    <ul>
      ${analysis.recommendations.map(rec => `<li>💡 ${rec}</li>`).join('')}
    </ul>
  </div>
  <div class="next-steps">
    <p><strong>Next:</strong> Click <b>Generate Full AI Plan</b> for your complete itinerary with:</p>
    <ul>
      <li>🗺️ Neighborhood clustering to minimize transit</li>
      <li>🎫 Tickets/Bookings with direct links</li>
      <li>🍽️ Restaurant recommendations</li>
      <li>📱 Mobile-optimized schedule</li>
    </ul>
  </div>
</div>`;
    
    res.json({ 
      id, 
      teaser_html, 
      affiliates: aff, 
      analysis,
      version: VERSION 
    });
  } catch (error) {
    console.error('Preview generation error:', error);
    res.status(500).json({
      error: 'Failed to generate preview',
      message: error.message,
      version: VERSION
    });
  }
});
app.post('/api/plan', async (req, res) => {
  console.log('Plan request received:', req.body);
  
  try {
    const payload = req.body || {};
    
    // Validate request
    const validation = validateTripRequest(payload);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors,
        warnings: validation.warnings,
        version: VERSION
      });
    }
    
    payload.budget = normalizeBudget(payload.budget, payload.currency);
    const id = uid();
    
    // Generate AI plan
    const markdown = await generatePlanWithAI(payload);
    const html = marked.parse(markdown);
    const aff = affiliatesFor(payload.destination);
    
    // Generate comprehensive analysis
    const analysis = analyzeTrip(payload);
    const budgetBreakdown = computeBudget(payload.budget, analysis.tripMetrics.duration, payload.level, analysis.tripMetrics.totalTravelers);
    
    // Enhanced plan data
    const planData = {
      id,
      type: 'plan',
      data: payload,
      markdown,
      analysis,
      budgetBreakdown,
      generatedAt: nowIso(),
      estimatedCosts: {
        accommodation: budgetBreakdown.stay.total,
        food: budgetBreakdown.food.total,
        activities: budgetBreakdown.act.total,
        transportation: budgetBreakdown.transit.total,
        total: payload.budget
      }
    };
    
    // Save enhanced plan
    savePlan.run(id, nowIso(), JSON.stringify(planData));
    
    res.json({ 
      id, 
      markdown, 
      html, 
      affiliates: aff, 
      analysis,
      budgetBreakdown,
      version: VERSION 
    });
  } catch (error) {
    console.error('Plan generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate plan', 
      message: error.message,
      version: VERSION 
    });
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
  <a href="${icsUrl}" target="_blank" rel="noopener">Download Trip Journal</a>
</div>
<div class="facts"><b>Quick Facts:</b>
  <ul>
    <li>🌡️ <b>Weather:</b> Typical seasonal conditions around ${season}.</li>
    <li>💱 <b>Currency:</b> ${d.currency}</li>
    <li>🗣️ <b>Language:</b> English (tourism friendly)</li>
    <li>🔌 <b>Voltage:</b> 230V, Type C/E plugs (adapter may be required)</li>
    <li>💁 <b>Tipping:</b> 5–10% in restaurants (optional)</li>
  </ul>
</div>
${htmlBody}
<footer>Generated by Wayzo — ${VERSION}</footer>
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

// Enhanced PDF generation endpoint
app.get('/api/plan/:id/enhanced-pdf', (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) return res.status(404).json({ error: 'Plan not found' });
  
  try {
    const saved = JSON.parse(row.payload || '{}');
    const d = saved?.data || {};
    const md = saved?.markdown || '';
    const analysis = saved?.analysis || {};
    const budgetBreakdown = saved?.budgetBreakdown || {};
    
    const htmlBody = marked.parse(md);
    const style = d.level === "luxury" ? "Luxury" : d.level === "budget" ? "Budget" : "Mid-range";
    const season = seasonFromDate(d.start);
    const days = daysBetween(d.start, d.end);
    const pppd = perPersonPerDay(normalizeBudget(d.budget, d.currency), days, Math.max(1, (d.adults || 0) + (d.children || 0)));
    const traveler = travelerLabel(d.adults || 0, d.children || 0);
    
    const base = `${req.protocol}://${req.get('host')}`;
    const icsUrl = `${base}/api/plan/${id}/ics`;
    const shareX = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`My ${d.destination} plan by Wayzo`)}&url=${encodeURIComponent(`${base}/api/plan/${id}/enhanced-pdf`)}`;
    
    // Enhanced HTML with rich styling and comprehensive information
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Wayzo Trip Report - ${d.destination}</title>
  <style>
    :root {
      --ink: #0f172a;
      --muted: #475569;
      --brand: #6366f1;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --bg: #ffffff;
      --accent: #eef2ff;
      --border: #e2e8f0;
      --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    * { box-sizing: border-box; }
    
    body {
      font: 16px/1.6 system-ui, -apple-system, Segoe UI, Roboto, Arial;
      color: var(--ink);
      margin: 0;
      background: var(--bg);
      line-height: 1.6;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    
    header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 3px solid var(--brand);
    }
    
    .logo {
      display: inline-flex;
      gap: 15px;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .badge {
      width: 50px;
      height: 50px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--brand), #4f46e5);
      color: #fff;
      display: grid;
      place-items: center;
      font-weight: 800;
      font-size: 20px;
      box-shadow: var(--shadow);
    }
    
    .brand-name {
      font-size: 32px;
      font-weight: 900;
      color: var(--brand);
    }
    
    .tagline {
      font-size: 18px;
      color: var(--muted);
      font-weight: 500;
    }
    
    .version {
      background: var(--accent);
      color: var(--brand);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      display: inline-block;
      margin-top: 15px;
    }
    
    .trip-header {
      background: linear-gradient(135deg, var(--accent), #f8fafc);
      border-radius: 20px;
      padding: 30px;
      margin-bottom: 40px;
      text-align: center;
      box-shadow: var(--shadow);
    }
    
    .destination-title {
      font-size: 48px;
      font-weight: 900;
      color: var(--ink);
      margin: 0 0 10px 0;
      text-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .trip-dates {
      font-size: 24px;
      color: var(--muted);
      margin-bottom: 30px;
    }
    
    .trip-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    
    .metric-card {
      background: white;
      padding: 25px;
      border-radius: 16px;
      text-align: center;
      box-shadow: var(--shadow);
      border: 2px solid var(--accent);
    }
    
    .metric-value {
      display: block;
      font-size: 36px;
      font-weight: 900;
      color: var(--brand);
      margin-bottom: 8px;
    }
    
    .metric-label {
      font-size: 16px;
      color: var(--muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 25px;
      margin: 40px 0;
    }
    
    .summary-card {
      background: white;
      border-radius: 16px;
      padding: 25px;
      box-shadow: var(--shadow);
      border-left: 4px solid var(--brand);
    }
    
    .summary-card h3 {
      color: var(--brand);
      margin: 0 0 20px 0;
      font-size: 20px;
      font-weight: 700;
    }
    
    .budget-breakdown {
      background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
      border-radius: 16px;
      padding: 30px;
      margin: 40px 0;
    }
    
    .budget-breakdown h3 {
      color: var(--ink);
      margin: 0 0 25px 0;
      font-size: 24px;
      font-weight: 700;
      text-align: center;
    }
    
    .budget-items {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }
    
    .budget-item {
      background: white;
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      box-shadow: var(--shadow);
    }
    
    .budget-amount {
      font-size: 28px;
      font-weight: 800;
      color: var(--success);
      margin-bottom: 8px;
    }
    
    .budget-label {
      font-size: 14px;
      color: var(--muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .recommendations {
      background: #fef3c7;
      border: 2px solid #f59e0b;
      border-radius: 16px;
      padding: 25px;
      margin: 30px 0;
    }
    
    .recommendations h3 {
      color: #92400e;
      margin: 0 0 20px 0;
      font-size: 20px;
      font-weight: 700;
    }
    
    .recommendations ul {
      margin: 0;
      padding-left: 20px;
    }
    
    .recommendations li {
      margin-bottom: 10px;
      color: #92400e;
    }
    
    .itinerary {
      background: white;
      border-radius: 16px;
      padding: 30px;
      margin: 40px 0;
      box-shadow: var(--shadow);
    }
    
    .itinerary h2 {
      color: var(--ink);
      margin: 0 0 30px 0;
      font-size: 28px;
      font-weight: 800;
      text-align: center;
      border-bottom: 3px solid var(--brand);
      padding-bottom: 15px;
    }
    
    .day-section {
      margin-bottom: 30px;
      padding: 25px;
      background: var(--accent);
      border-radius: 12px;
      border-left: 4px solid var(--brand);
    }
    
    .day-title {
      font-size: 24px;
      font-weight: 700;
      color: var(--brand);
      margin: 0 0 20px 0;
    }
    
    .day-content {
      color: var(--ink);
      line-height: 1.8;
    }
    
    .actions {
      text-align: center;
      margin: 40px 0;
      padding: 30px;
      background: var(--accent);
      border-radius: 16px;
    }
    
    .actions h3 {
      color: var(--ink);
      margin: 0 0 25px 0;
      font-size: 20px;
      font-weight: 700;
    }
    
    .action-links {
      display: flex;
      gap: 15px;
      justify-content: center;
      flex-wrap: wrap;
    }
    
    .action-links a {
      background: var(--brand);
      color: white;
      padding: 12px 24px;
      border-radius: 25px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
      box-shadow: var(--shadow);
    }
    
    .action-links a:hover {
      background: #4f46e5;
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(99, 102, 241, 0.3);
    }
    
    .quick-facts {
      background: white;
      border-radius: 16px;
      padding: 25px;
      margin: 30px 0;
      box-shadow: var(--shadow);
      border: 2px solid var(--accent);
    }
    
    .quick-facts h3 {
      color: var(--ink);
      margin: 0 0 20px 0;
      font-size: 20px;
      font-weight: 700;
      text-align: center;
    }
    
    .facts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
    }
    
    .fact-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 15px;
      background: var(--accent);
      border-radius: 10px;
    }
    
    .fact-icon {
      font-size: 24px;
    }
    
    .fact-text {
      font-weight: 600;
      color: var(--ink);
    }
    
    footer {
      text-align: center;
      margin-top: 60px;
      padding: 30px;
      background: var(--ink);
      color: white;
      border-radius: 16px;
    }
    
    .footer-content {
      font-size: 18px;
      font-weight: 600;
    }
    
    @media print {
      body { margin: 0; }
      .container { max-width: none; padding: 20px; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">
        <div class="badge">WZ</div>
        <div>
          <div class="brand-name">Wayzo</div>
          <div class="tagline">Trips that plan themselves.</div>
        </div>
      </div>
      <div class="version">${VERSION}</div>
    </header>
    
    <div class="trip-header">
      <h1 class="destination-title">${d.destination}</h1>
      <div class="trip-dates">${d.start} → ${d.end}</div>
      <div class="trip-metrics">
        <div class="metric-card">
          <span class="metric-value">${days}</span>
          <span class="metric-label">Days</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${traveler}</span>
          <span class="metric-label">Travelers</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${d.currency} ${pppd}</span>
          <span class="metric-label">Per Person/Day</span>
        </div>
        <div class="metric-card">
          <span class="metric-value">${style}</span>
          <span class="metric-label">Style</span>
        </div>
      </div>
    </div>
    
    <div class="summary-grid">
      <div class="summary-card">
        <h3>🌍 Trip Overview</h3>
        <p><strong>Destination:</strong> ${d.destination}</p>
        <p><strong>Duration:</strong> ${days} days</p>
        <p><strong>Travelers:</strong> ${traveler}</p>
        <p><strong>Style:</strong> ${style}${d.prefs ? ` · ${escapeHtml(d.prefs)}` : ""}</p>
        <p><strong>Season:</strong> ${season}</p>
        <p><strong>Budget:</strong> ${d.currency} ${normalizeBudget(d.budget, d.currency)}</p>
      </div>
      
      <div class="summary-card">
        <h3>📊 Smart Analysis</h3>
        <p><strong>Peak Season:</strong> ${analysis.seasonalFactors?.isPeakSeason ? 'Yes 🌡️' : 'No 🌿'}</p>
        <p><strong>Advance Notice:</strong> ${analysis.timingFactors?.advanceNotice || 0} days</p>
        <p><strong>Price Factor:</strong> ${analysis.seasonalFactors?.priceMultiplier || 1.0}x</p>
        <p><strong>Weekend Start:</strong> ${analysis.timingFactors?.isWeekend ? 'Yes' : 'No'}</p>
      </div>
    </div>
    
    <div class="budget-breakdown">
      <h3>💰 Budget Breakdown</h3>
      <div class="budget-items">
        <div class="budget-item">
          <div class="budget-amount">${d.currency} ${budgetBreakdown.stay?.total || 0}</div>
          <div class="budget-label">Accommodation</div>
        </div>
        <div class="budget-item">
          <div class="budget-amount">${d.currency} ${budgetBreakdown.food?.total || 0}</div>
          <div class="budget-label">Food & Dining</div>
        </div>
        <div class="budget-item">
          <div class="budget-amount">${d.currency} ${budgetBreakdown.act?.total || 0}</div>
          <div class="budget-label">Activities</div>
        </div>
        <div class="budget-item">
          <div class="budget-amount">${d.currency} ${budgetBreakdown.transit?.total || 0}</div>
          <div class="budget-label">Transportation</div>
        </div>
      </div>
    </div>
    
    ${analysis.recommendations && analysis.recommendations.length > 0 ? `
    <div class="recommendations">
      <h3>💡 Smart Recommendations</h3>
      <ul>
        ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    <div class="quick-facts">
      <h3>ℹ️ Quick Facts</h3>
      <div class="facts-grid">
        <div class="fact-item">
          <span class="fact-icon">🌡️</span>
          <span class="fact-text"><strong>Weather:</strong> ${season} conditions</span>
        </div>
        <div class="fact-item">
          <span class="fact-icon">💱</span>
          <span class="fact-text"><strong>Currency:</strong> ${d.currency}</span>
        </div>
        <div class="fact-item">
          <span class="fact-icon">🗣️</span>
          <span class="fact-text"><strong>Language:</strong> English (tourism friendly)</span>
        </div>
        <div class="fact-item">
          <span class="fact-icon">🔌</span>
          <span class="fact-text"><strong>Voltage:</strong> 230V, Type C/E plugs</span>
        </div>
        <div class="fact-item">
          <span class="fact-icon">💁</span>
          <span class="fact-text"><strong>Tipping:</strong> 5–10% in restaurants</span>
        </div>
        <div class="fact-item">
          <span class="fact-icon">📱</span>
          <span class="fact-text"><strong>Mobile:</strong> Local SIM recommended</span>
        </div>
      </div>
    </div>
    
    <div class="itinerary">
      <h2>🗓️ Your Itinerary</h2>
      ${htmlBody}
    </div>
    
    <div class="actions">
      <h3>📱 Get Your Trip</h3>
      <div class="action-links">
        <a href="${base}/" target="_blank">Edit Trip Details</a>
        <a href="${icsUrl}" target="_blank">Download Calendar</a>
        <a href="${shareX}" target="_blank">Share on X</a>
      </div>
    </div>
    
    <footer>
      <div class="footer-content">
        Generated by Wayzo — ${VERSION}<br>
        <small>Your AI-powered travel companion</small>
      </div>
    </footer>
  </div>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('Enhanced PDF generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate enhanced PDF', 
      message: error.message,
      version: VERSION 
    });
  }
});

// Comprehensive trip report endpoint
app.get('/api/plan/:id/report', (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) return res.status(404).json({ error: 'Plan not found' });
  
  try {
    const saved = JSON.parse(row.payload || '{}');
    const d = saved?.data || {};
    const md = saved?.markdown || '';
    const analysis = saved?.analysis || {};
    const budgetBreakdown = saved?.budgetBreakdown || {};
    
    const style = d.level === "luxury" ? "Luxury" : d.level === "budget" ? "Budget" : "Mid-range";
    const season = seasonFromDate(d.start);
    const days = daysBetween(d.start, d.end);
    const pppd = perPersonPerDay(normalizeBudget(d.budget, d.currency), days, Math.max(1, (d.adults || 0) + (d.children || 0)));
    const traveler = travelerLabel(d.adults || 0, d.children || 0);
    
    // Generate comprehensive report data
    const report = {
      tripId: id,
      generatedAt: new Date().toISOString(),
      version: VERSION,
      summary: {
        destination: d.destination,
        dates: { start: d.start, end: d.end, duration: days },
        travelers: { total: (d.adults || 0) + (d.children || 0), adults: d.adults || 0, children: d.children || 0 },
        style: style,
        preferences: d.prefs || [],
        dietary: d.diet || 'None specified',
        budget: {
          total: d.budget,
          currency: d.currency,
          perPerson: Math.round(d.budget / Math.max(1, (d.adults || 0) + (d.children || 0))),
          perPersonPerDay: pppd,
          breakdown: budgetBreakdown
        }
      },
      analysis: {
        seasonal: {
          season: season,
          isPeakSeason: analysis.seasonalFactors?.isPeakSeason || false,
          priceMultiplier: analysis.seasonalFactors?.priceMultiplier || 1.0,
          recommendations: analysis.seasonalFactors?.isPeakSeason ? 
            ['Book accommodations early', 'Expect higher prices', 'Consider shoulder season alternatives'] : 
            ['Good timing for deals', 'Less crowded attractions', 'Flexible booking options']
        },
        timing: {
          advanceNotice: analysis.timingFactors?.advanceNotice || 0,
          isWeekend: analysis.timingFactors?.isWeekend || false,
          recommendations: analysis.timingFactors?.advanceNotice < 30 ? 
            ['Book immediately', 'Limited availability', 'Consider flexible dates'] : 
            ['Good advance planning', 'More options available', 'Can wait for deals']
        },
        budget: {
          category: pppd < 50 ? 'Budget' : pppd < 150 ? 'Mid-range' : 'Luxury',
          efficiency: pppd < 50 ? 'High' : pppd < 150 ? 'Medium' : 'Low',
          recommendations: pppd < 50 ? 
            ['Hostels and budget hotels', 'Street food and local markets', 'Free attractions and walking tours'] :
            pppd < 150 ? 
            ['Mid-range hotels', 'Mix of restaurants', 'Paid attractions with some free options'] :
            ['Premium hotels', 'Fine dining', 'Exclusive experiences and private tours']
        }
      },
      recommendations: {
        accommodation: {
          type: d.level === 'luxury' ? 'Premium hotels/resorts' : d.level === 'budget' ? 'Hostels/budget hotels' : 'Mid-range hotels',
          tips: d.level === 'luxury' ? 
            ['Book through luxury travel agencies', 'Request upgrades', 'Consider all-inclusive packages'] :
            d.level === 'budget' ? 
            ['Book early for best rates', 'Consider hostels with private rooms', 'Look for family-run guesthouses'] :
            ['Compare hotel vs apartment rentals', 'Check for package deals', 'Consider loyalty programs']
        },
        transportation: {
          recommendations: days < 3 ? 
            ['Walking and public transport', 'Day passes for transit', 'Central accommodation'] :
            days < 7 ? 
            ['Mix of walking and transit', 'Multi-day transit passes', 'Consider bike rentals'] :
            ['Weekly transit passes', 'Mix of transport modes', 'Consider car rental for day trips']
        },
        activities: {
          daily: Math.round(budgetBreakdown.act?.perDay || 0),
          recommendations: (d.children || 0) > 0 ? 
            ['Family-friendly attractions', 'Interactive museums', 'Parks and playgrounds', 'Kid-friendly restaurants'] :
            ['Cultural sites', 'Local experiences', 'Food tours', 'Historical landmarks']
        },
        dining: {
          daily: Math.round(budgetBreakdown.food?.perDay || 0),
          recommendations: d.diet ? 
            [`Research ${d.diet} options`, 'Contact restaurants in advance', 'Learn dietary phrases in local language'] :
            ['Mix of local and tourist restaurants', 'Try street food', 'Book popular restaurants early']
        }
      },
      practical: {
        weather: {
          season: season,
          typical: season === 'Summer' ? 'Warm to hot, possible rain' :
                   season === 'Winter' ? 'Cold, possible snow' :
                   season === 'Spring' ? 'Mild, variable weather' : 'Cool, pleasant temperatures',
          packing: season === 'Summer' ? ['Light clothing', 'Sunscreen', 'Rain gear'] :
                   season === 'Winter' ? ['Warm layers', 'Waterproof boots', 'Gloves and hat'] :
                   season === 'Spring' ? ['Layered clothing', 'Light jacket', 'Comfortable shoes'] : 
                   ['Medium layers', 'Comfortable walking shoes', 'Light jacket']
        },
        essentials: {
          documents: ['Passport/ID', 'Travel insurance', 'Booking confirmations', 'Emergency contacts'],
          electronics: ['Phone charger', 'Power adapter', 'Portable battery', 'Camera'],
          health: ['Prescriptions', 'First aid kit', 'Insurance cards', 'Medical information']
        },
        local: {
          language: 'English (tourism friendly)',
          currency: d.currency,
          voltage: '230V, Type C/E plugs',
          tipping: '5-10% in restaurants (optional)',
          emergency: '112 (EU emergency number)'
        }
      },
      itinerary: {
        raw: md,
        days: days,
        highlights: extractHighlights(md),
        estimatedDailyCost: Math.round(d.budget / days)
      }
    };
    
    res.json(report);
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate report', 
      message: error.message,
      version: VERSION 
    });
  }
});

// Helper function to extract highlights from markdown
function extractHighlights(markdown) {
  const highlights = [];
  const lines = markdown.split('\n');
  
  for (const line of lines) {
    if (line.includes('**') && (line.includes('Morning:') || line.includes('Afternoon:') || line.includes('Evening:'))) {
      const activity = line.replace(/\*\*/g, '').trim();
      if (activity) highlights.push(activity);
    }
  }
  
  return highlights.slice(0, 10); // Limit to top 10 highlights
}

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