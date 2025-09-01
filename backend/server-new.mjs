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
import { body, validationResult } from 'express-validator';

// Import our new modules
import { initializeDatabase } from './lib/database.mjs';
import { UserModel } from './lib/user.mjs';
import { authMiddleware, optionalAuthMiddleware, adminMiddleware, rateLimitMiddleware } from './lib/auth.mjs';
import { emailService } from './lib/email.mjs';
import { Logger } from './lib/logger.mjs';

// Import existing modules
import { normalizeBudget, computeBudget } from './lib/budget.mjs';
import { ensureDaySections } from './lib/expand-days.mjs';
import { affiliatesFor, linkifyTokens } from './lib/links.mjs';
import { buildIcs } from './lib/ics.mjs';

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

// Initialize database
initializeDatabase();

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

// Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(compression());
app.use(morgan('combined')); // Detailed logging
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
app.use(rateLimit({ windowMs: 60_000, limit: 200 }));
app.use(express.json({ limit: '5mb' }));

// Performance monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    Logger.logSystemAction('request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: duration,
      userAgent: req.get('User-Agent')
    }, req);
  });
  next();
});

/* Static Serving with Proper Headers */
app.use('/frontend', express.static(FRONTEND, {
  setHeaders: (res, filePath) => {
    if (!fs.existsSync(filePath)) console.error('Static file not found:', filePath);
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

app.use('/uploads', express.static(UPLOADS, { 
  setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=1209600') 
}));

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

app.get('/healthz', (_req, res) => res.json({ 
  ok: true, 
  version: VERSION,
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development'
}));

app.get('/version', (_req, res) => res.json({ version: VERSION }));

/* Authentication Routes */
app.post('/api/auth/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').optional().trim().isLength({ min: 1 }).withMessage('Name cannot be empty')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const { email, password, name } = req.body;
    const user = await UserModel.createUser(email, password, name);
    const token = UserModel.generateToken(user.id);
    
    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(user);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }
    
    // Log registration
    await Logger.log(user.id, 'register', { email, name }, req);
    
    res.json({
      success: true,
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const { email, password } = req.body;
    const user = await UserModel.findByEmail(email);
    
    if (!user) {
      await Logger.logSystemAction('login_failed', { email, reason: 'user_not_found' }, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await UserModel.verifyPassword(user, password);
    if (!isValidPassword) {
      await Logger.logSystemAction('login_failed', { email, reason: 'invalid_password' }, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await UserModel.updateLastLogin(user.id);
    const token = UserModel.generateToken(user.id);
    
    // Log successful login
    await Logger.log(user.id, 'login', { email }, req);
    
    res.json({
      success: true,
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name,
        last_login: user.last_login
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const { email } = req.body;
    const { resetToken } = await UserModel.createPasswordResetToken(email);
    
    // Send password reset email
    const user = await UserModel.findByEmail(email);
    await emailService.sendPasswordResetEmail(user, resetToken);
    
    // Log password reset request
    await Logger.log(user.id, 'password_reset_requested', { email }, req);
    
    res.json({ 
      success: true, 
      message: 'Password reset email sent' 
    });
  } catch (error) {
    console.error('Password reset error:', error);
    // Don't reveal if user exists or not
    res.json({ 
      success: true, 
      message: 'If the email exists, a password reset link has been sent' 
    });
  }
});

app.post('/api/auth/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const { token, password } = req.body;
    await UserModel.resetPassword(token, password);
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully' 
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(400).json({ error: error.message });
  }
});

/* User Profile Routes */
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
      last_login: user.last_login,
      preferences: user.preferences ? JSON.parse(user.preferences) : {}
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

app.put('/api/user/profile', authMiddleware, [
  body('name').optional().trim().isLength({ min: 1 }).withMessage('Name cannot be empty'),
  body('preferences').optional().isObject().withMessage('Preferences must be an object')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.preferences) updates.preferences = JSON.stringify(req.body.preferences);
    
    await UserModel.updateProfile(req.userId, updates);
    
    res.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.put('/api/user/change-password', authMiddleware, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const { currentPassword, newPassword } = req.body;
    await UserModel.changePassword(req.userId, currentPassword, newPassword);
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/user/activity', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const activity = await Logger.getUserActivity(req.userId, parseInt(limit), parseInt(offset));
    res.json({ activity });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

app.get('/api/user/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await UserModel.getUserStats(req.userId);
    const destinations = await UserModel.getPopularDestinations(req.userId);
    res.json({ stats, destinations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/* Plan Management Routes */
app.get('/api/user/plans', authMiddleware, (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const stmt = db.prepare(`
      SELECT id, created_at, payload 
      FROM plans 
      WHERE user_id = ? 
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const plans = stmt.all(req.userId, parseInt(limit), parseInt(offset)).map(row => {
      const data = JSON.parse(row.payload);
      return {
        id: row.id,
        created_at: row.created_at,
        destination: data.data?.destination,
        start_date: data.data?.start,
        end_date: data.data?.end,
        budget: data.data?.budget,
        travelers: (data.data?.adults || 0) + (data.data?.children || 0),
        is_public: data.is_public || false
      };
    });
    
    res.json({ plans });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

app.delete('/api/user/plans/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify plan belongs to user
    const plan = getPlan.get(id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const planData = JSON.parse(plan.payload);
    if (planData.user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const deleteStmt = db.prepare('DELETE FROM plans WHERE id = ?');
    deleteStmt.run(id);
    
    // Log plan deletion
    Logger.log(req.userId, 'plan_deleted', { plan_id: id }, req);
    
    res.json({ success: true, message: 'Plan deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});

app.put('/api/user/plans/:id/visibility', authMiddleware, [
  body('is_public').isBoolean().withMessage('is_public must be a boolean')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array()
    });
  }

  try {
    const { id } = req.params;
    const { is_public } = req.body;
    
    // Verify plan belongs to user
    const plan = getPlan.get(id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const planData = JSON.parse(plan.payload);
    if (planData.user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const updateStmt = db.prepare('UPDATE plans SET is_public = ? WHERE id = ?');
    updateStmt.run(is_public, id);
    
    // Log visibility change
    Logger.log(req.userId, 'plan_visibility_changed', { plan_id: id, is_public }, req);
    
    res.json({ success: true, message: `Plan made ${is_public ? 'public' : 'private'}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update plan visibility' });
  }
});

/* Public Plans Discovery */
app.get('/api/plans/public', (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const stmt = db.prepare(`
      SELECT p.id, p.created_at, p.payload, u.name as creator_name
      FROM plans p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_public = true
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const plans = stmt.all(parseInt(limit), parseInt(offset)).map(row => {
      const data = JSON.parse(row.payload);
      return {
        id: row.id,
        created_at: row.created_at,
        destination: data.data?.destination,
        start_date: data.data?.start,
        end_date: data.data?.end,
        budget: data.data?.budget,
        travelers: (data.data?.adults || 0) + (data.data?.children || 0),
        creator_name: row.creator_name
      };
    });
    
    res.json({ plans });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get public plans' });
  }
});

/* Admin Routes */
app.get('/api/admin/stats', adminMiddleware, async (req, res) => {
  try {
    // Get basic system stats
    const userCountStmt = db.prepare('SELECT COUNT(*) as count FROM users WHERE status = "active"');
    const planCountStmt = db.prepare('SELECT COUNT(*) as count FROM plans');
    const recentUsersStmt = db.prepare(`
      SELECT id, email, name, created_at, last_login
      FROM users
      WHERE status = "active"
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    const userCount = userCountStmt.get().count;
    const planCount = planCountStmt.get().count;
    const recentUsers = recentUsersStmt.all();
    
    // Get activity stats
    const activityStats = await Logger.getSystemStats();
    const emailStats = await emailService.getEmailStats();
    
    res.json({
      users: {
        total: userCount,
        recent: recentUsers
      },
      plans: {
        total: planCount
      },
      activity: activityStats,
      email: emailStats
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

app.get('/api/admin/logs', adminMiddleware, async (req, res) => {
  try {
    const { action, limit = 50, offset = 0 } = req.query;
    let logs;
    
    if (action) {
      logs = await Logger.getActionStats(action, 30);
    } else {
      const stmt = db.prepare(`
        SELECT action, details, created_at, ip_address, user_agent
        FROM user_logs
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `);
      logs = stmt.all(parseInt(limit), parseInt(offset));
    }
    
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

app.get('/api/admin/security', adminMiddleware, async (req, res) => {
  try {
    const securityEvents = await Logger.getSecurityEvents(50);
    res.json({ securityEvents });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get security events' });
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

/* Database */
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

app.post('/api/plan', authMiddleware, async (req, res) => {
  console.log('Plan request received:', req.body);
  try {
    const payload = req.body || {};
    payload.budget = normalizeBudget(payload.budget, payload.currency);
    const id = uid();
    const markdown = await generatePlanWithAI(payload);
    const html = marked.parse(markdown);
    const aff = affiliatesFor(payload.destination);
    
    // Save plan with user ID
    savePlan.run(id, nowIso(), JSON.stringify({ 
      id, 
      type: 'plan', 
      data: payload, 
      markdown,
      user_id: req.userId 
    }));
    
    // Log plan creation
    await Logger.log(req.userId, 'plan_create', {
      plan_id: id,
      destination: payload.destination,
      budget: payload.budget
    }, req);
    
    // Send plan created email
    try {
      const user = await UserModel.findById(req.userId);
      await emailService.sendPlanCreatedEmail(user, id, payload.destination);
    } catch (emailError) {
      console.error('Failed to send plan created email:', emailError);
    }
    
    res.json({ id, markdown, html, affiliates: aff, version: VERSION });
  } catch (e) {
    console.error('Plan generation error:', e);
    res.status(500).json({ error: 'Failed to generate plan. Check server logs.', version: VERSION });
  }
});

app.get('/api/plan/:id', optionalAuthMiddleware, (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) return res.status(404).json({ error: 'Plan not found' });
  
  const saved = JSON.parse(row.payload || '{}');
  
  // Log access if user is authenticated
  if (req.userId) {
    Logger.log(req.userId, 'plan_view', { plan_id: id }, req);
  }
  
  res.json(saved);
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
  console.log('Environment:', process.env.NODE_ENV || 'development');
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