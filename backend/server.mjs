/* eslint-disable no-console */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { marked } from 'marked';
import OpenAI from 'openai';

/** ---------- Paths (Render Root Directory = backend) ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const repoRoot   = path.resolve(__dirname, '..');          // -> /opt/render/project/src
const frontendDir = path.join(repoRoot, 'frontend');       // -> /opt/render/project/src/frontend
let indexFile = path.join(frontendDir, 'index.backend.html');
if (!fs.existsSync(indexFile)) {
  const alt = path.join(frontendDir, 'index.html');
  if (fs.existsSync(alt)) indexFile = alt;
}

const docsDir = fs.existsSync(path.join(repoRoot, 'docs'))
  ? path.join(repoRoot, 'docs')
  : frontendDir;

console.log('Serving frontend from:', frontendDir);
console.log('Root file:', indexFile);

/** ---------- App ---------- */
const app  = express();
const PORT = Number(process.env.PORT || 8080);
app.set('trust proxy', 1);

// Relax CSP so inline <script> in the simple HTML works
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));

app.use(compression());
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// Rate limit (safe with proxy on Render)
app.use(rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: true }
}));

/** ---------- DB (ephemeral OK on Render Free) ---------- */
const dbPath = path.join(repoRoot, 'wayzo.sqlite');
const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    payload TEXT NOT NULL
  );
`);
const savePlan = db.prepare('INSERT OR REPLACE INTO plans (id, created_at, payload) VALUES (?, ?, ?)');
const getPlan  = db.prepare('SELECT payload FROM plans WHERE id = ?');

const nowIso = () => new Date().toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

/** ---------- Helpers ---------- */
function affiliatesFor(dest = '') {
  const q = encodeURIComponent(dest || '');
  return {
    flights:    `https://www.kayak.com/flights?query=${q}`,
    hotels:     `https://www.booking.com/searchresults.html?ss=${q}`,
    activities: `https://www.getyourguide.com/s/?q=${q}`,
    cars:       `https://www.rentalcars.com/SearchResults.do?destination=${q}`,
    insurance:  `https://www.worldnomads.com/`,
    reviews:    `https://www.tripadvisor.com/Search?q=${q}`
  };
}

function teaserHTML(input) {
  const { destination, start, end, level='budget', travelers=2 } = input || {};
  return `
  <div class="teaser">
    <h3>${destination || 'Your destination'} — ${level} style</h3>
    <p><b>${travelers}</b> traveler(s) · ${start || 'start'} → ${end || 'end'}</p>
    <ul>
      <li>Top sights, food & neighborhoods tailored to you.</li>
      <li>Morning / Afternoon / Evening blocks for easy pacing.</li>
      <li>Use <b>Generate full plan (AI)</b> for a complete schedule & costs.</li>
    </ul>
  </div>`;
}

function localPlanMarkdown(input) {
  const {
    destination='Your destination', start='start', end='end',
    budget=1500, travelers=2, level='budget', prefs=''
  } = input || {};
  return `# ${destination} Itinerary (${start} → ${end})

**Party:** ${travelers} traveler(s)  •  **Style:** ${level}  •  **Budget:** $${budget}

**Preferences:** ${prefs || '—'}

---

## Trip Summary
- Balanced mix of must-sees and local gems in ${destination}.
- Grouped by neighborhoods to minimize transit.
- Booking shortcuts adapt to **${destination}**.

## Day by Day (sample)
### Day 1
- **Morning**: Historic center & museum  
- **Afternoon**: Market + street food  
- **Evening**: Neighborhood bistro

### Day 2
- **Morning**: Headline sight  
- **Afternoon**: Park/river loop  
- **Evening**: Food hall + dessert

---

## Cost Overview (rough)
- **Accommodation**: varies by style
- **Food**: $20–$40 pp/day
- **Activities**: museums $10–$25
- **Transport**: day passes are best value

Happy travels!`;
}

/** ---------- OpenAI (optional; off if no key) ---------- */
const openaiEnabled = !!process.env.OPENAI_API_KEY;
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function maybeAI(markdownFallback, payload) {
  if (!openaiEnabled) return markdownFallback;

  const prompt = `You are an expert travel planner. Create a clear, friendly **Markdown** itinerary with:
- Title including destination and dates
- Day-by-day sections with morning/afternoon/evening
- Practical tips and rough costs that fit the budget
- Keep it concise and readable

INPUT:
Destination: ${payload.destination}
Dates: ${payload.start} to ${payload.end}
Travelers: ${payload.travelers}
Style: ${payload.level}
Budget: $${payload.budget}
Preferences: ${payload.prefs || 'none'}

Return only Markdown.`;

  try {
    const r = await openai.chat.completions.create({
      model: process.env.WAYZO_MODEL || 'gpt-4o-mini',
      temperature: 0.6,
      messages: [
        { role: 'system', content: 'You write clean Markdown itineraries. No code fences.' },
        { role: 'user', content: prompt }
      ]
    });
    const text = r.choices?.[0]?.message?.content?.trim();
    return text || markdownFallback;
  } catch (e) {
    console.error('OpenAI error → using local plan:', e.message);
    return markdownFallback;
  }
}

/** ---------- API ---------- */
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz',    (_req, res) => res.status(200).send('ok'));
app.get('/__debug',    (_req, res) => res.json({
  now: nowIso(), node: process.version,
  paths: { repoRoot, frontendDir, indexFile, docsDir, dbPath },
  openaiEnabled
}));

// Preview (teaser only)
app.post('/api/preview', (req, res) => {
  const payload = req.body || {};
  const id = uid();
  const teaser = teaserHTML(payload);
  const aff = affiliatesFor(payload.destination);
  savePlan.run(id, nowIso(), JSON.stringify({ id, type:'preview', data:payload, teaser_html:teaser, affiliates:aff }));
  res.json({ id, teaser_html: teaser, affiliates: aff });
});

// Full plan (AI if key; else local)
app.post('/api/plan', async (req, res) => {
  const payload = req.body || {};
  const id = uid();

  const localMd = localPlanMarkdown(payload);
  const markdown = await maybeAI(localMd, payload);
  const aff = affiliatesFor(payload.destination);

  savePlan.run(id, nowIso(), JSON.stringify({ id, type:'plan', data:payload, markdown, affiliates:aff }));
  res.json({ id, markdown, affiliates: aff });
});

// Simple HTML-for-PDF view
app.get('/api/plan/:id/pdf', (req, res) => {
  const row = getPlan.get(req.params.id);
  if (!row) return res.status(404).send('Plan not found');
  const { markdown } = JSON.parse(row.payload || '{}');
  const html = `<!doctype html>
  <html><head>
    <meta charset="utf-8"/>
    <title>Wayzo Plan</title>
    <style>
      body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.55; margin: 28px; color:#0f172a;}
      h1,h2,h3{margin:.6em 0} ul{margin:.4em 0 .6em 1.2em}
      .footer{margin-top:2rem; font-size:12px; color:#475569}
      a{color:#2563eb; text-decoration:none}
    </style>
  </head>
  <body>
    <div class="content">${marked.parse(markdown || '# Plan')}</div>
    <div class="footer">Generated by Wayzo — wayzo.online</div>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/** ---------- Static ---------- */
app.use('/docs', express.static(docsDir, {
  setHeaders: (res) => res.setHeader('Cache-Control','public,max-age=604800')
}));
app.use(express.static(frontendDir, {
  setHeaders: (res, filePath) => {
    if (/\.(css)$/i.test(filePath)) res.setHeader('Content-Type','text/css; charset=utf-8');
    if (/\.(js)$/i.test(filePath))  res.setHeader('Content-Type','application/javascript; charset=utf-8');
    if (/\.(css|js|svg|png|jpg|jpeg|webp|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    }
  }
}));
app.get('/', (_req, res) => fs.existsSync(indexFile) ? res.sendFile(indexFile) : res.status(500).send('index file missing'));
app.get(/^\/(?!api\/).*/, (_req, res) => fs.existsSync(indexFile) ? res.sendFile(indexFile) : res.status(500).send('index file missing'));

/** ---------- Start ---------- */
app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log(`Serving frontend from: ${frontendDir}`);
  console.log(`Root file: ${indexFile}`);
});
