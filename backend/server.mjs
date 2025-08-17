import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

// ---------- Paths (stable, original layout) ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const repoRoot   = path.resolve(__dirname, '..');
const frontendDir = path.join(repoRoot, 'frontend');           // << keep this
let indexFile = path.join(frontendDir, 'index.backend.html');  // your simple UI
if (!fs.existsSync(indexFile)) {
  const alt = path.join(frontendDir, 'index.html');
  if (fs.existsSync(alt)) indexFile = alt;
}
const docsDir = fs.existsSync(path.join(repoRoot, 'docs')) ? path.join(repoRoot, 'docs') : frontendDir;

// ---------- App ----------
const app = express();
const PORT = Number(process.env.PORT || 8080);
app.set('trust proxy', 1);

app.use(compression());
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// ---------- DB (small, local) ----------
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
const getLatestPlan = db.prepare("SELECT payload FROM plans WHERE json_extract(payload, '$.type')='plan' ORDER BY created_at DESC LIMIT 1");

const nowIso = () => new Date().toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

// ---------- Helpers (same as before) ----------
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
      <li>Neighborhood grouping</li>
      <li>Morning / Afternoon / Evening anchors</li>
      <li>Two options per block in full plan</li>
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
Balanced mix of must-sees and local gems in ${destination}. Each block has **two options** in the full plan so you can pick A/B before exporting.

## Day 1 (sample)
- **Morning**: Historic center & museum  
- **Afternoon**: Market + street food  
- **Evening**: Neighborhood bistro

---
`;
}

// ---------- OpenAI (optional; unchanged) ----------
const openaiEnabled = !!process.env.OPENAI_API_KEY;
let OpenAI = null;
if (openaiEnabled) {
  ({ default: OpenAI } = await import('openai'));
}
const openai = openaiEnabled ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Minimal prompt—kept simple to avoid changing outputs drastically
function buildUserPrompt(p) {
  return `
Create a realistic day-by-day itinerary for:
- Destination: ${p.destination}
- Dates: ${p.start} to ${p.end}
- Travelers: ${p.travelers}
- Style: ${p.level}
- Budget (USD): ${p.budget}
- Preferences: ${p.prefs || '—'}

Output **Markdown** only:
- Title + 1-paragraph overview
- Each day: Morning / Afternoon / Evening
- For each block, include **Option A** and **Option B** with a one-line “why”
- Cost breakdown table (ranges OK)
- Practical tips
`.trim();
}

async function generateAIPlanMarkdown(payload) {
  const messages = [
    { role: 'system', content: 'You are Wayzo, a concise and practical trip planner.' },
    { role: 'user',   content: buildUserPrompt(payload) }
  ];
  const model = process.env.WAYZO_MODEL || 'gpt-4o-mini';
  const r = await openai.chat.completions.create({
    model,
    temperature: 0.6,
    messages
  });
  return r.choices?.[0]?.message?.content?.trim() || '';
}

// ---------- API (same shapes as your UI expects) ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
app.get('/__debug', (_req, res) => {
  res.json({
    now: nowIso(),
    openaiEnabled,
    frontendDir,
    indexFile,
    dbPath
  });
});

app.post('/api/preview', (req, res) => {
  const payload = req.body || {};
  const id = uid();
  const teaser = teaserHTML(payload);
  const aff = affiliatesFor(payload.destination);
  savePlan.run(id, nowIso(), JSON.stringify({ id, type:'preview', data:payload, teaser_html:teaser, affiliates:aff }));
  res.json({ id, teaser_html: teaser, affiliates: aff });
});

app.post('/api/plan', async (req, res) => {
  const payload = req.body || {};
  const id = uid();
  try {
    let markdown = localPlanMarkdown(payload);
    if (openaiEnabled) {
      const ai = await generateAIPlanMarkdown(payload);
      if (ai) markdown = ai;
    }
    const aff = affiliatesFor(payload.destination);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type:'plan', data:payload, markdown, affiliates:aff }));
    res.json({ id, markdown, affiliates: aff });
  } catch (err) {
    console.error('AI error, sending fallback markdown:', err);
    const aff = affiliatesFor(payload.destination);
    const markdown = localPlanMarkdown(payload);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type:'plan', data:payload, markdown, affiliates:aff }));
    res.json({ id, markdown, affiliates: aff });
  }
});

// Classic PDF page (simple markdown rendering in-browser)
app.get('/api/plan/:id/pdf', (req, res) => {
  const row = getPlan.get(req.params.id);
  if (!row) return res.status(404).send('Plan not found');
  const saved = JSON.parse(row.payload || '{}');
  const { markdown='' } = saved;

  const html = `<!doctype html>
<html><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Wayzo Trip</title>
<style>
  body{font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height:1.55; margin: 24px;}
  h1,h2,h3{margin:.6em 0}
  .md h1{font-size:1.6rem}.md h2{font-size:1.3rem}.md h3{font-size:1.1rem}
  .md p{margin:.5rem 0}.md ul{margin:.5rem 0 .75rem 1.25rem}.md li{margin:.25rem 0}
</style>
</head>
<body>
  <h1>Wayzo Trip Plan</h1>
  <div id="root" class="md"></div>
<script>
  const md = ${JSON.stringify(markdown)};
  function simpleMarkdown(md){
    md = md.replace(/^### (.*)$/gm,'<h3>$1</h3>')
           .replace(/^## (.*)$/gm,'<h2>$1</h2>')
           .replace(/^# (.*)$/gm,'<h1>$1</h1>')
           .replace(/^\\- (.*)$/gm,'<li>$1</li>')
           .replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>')
           .replace(/\\[(.+?)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g,'<a href="$2" target="_blank">$1</a>');
    md = md.replace(/(<li>.*<\\/li>)(\\n(?!<li>))/g,'<ul>$1</ul>\\n');
    md = md.split(/\\n{2,}/).map(b=>/^<h\\d|<ul>|<li>/.test(b.trim())?b:'<p>'+b.replace(/\\n/g,'<br>')+'</p>').join('\\n');
    return '<div class="md">'+md+'</div>';
  }
  document.getElementById('root').innerHTML = simpleMarkdown(md || '# Plan');
</script>
</body></html>`;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(html);
});

// ---------- Static first (fixes CSS/JS MIME) ----------
app.use('/docs', express.static(docsDir));
app.use(express.static(frontendDir));

// ---------- Catch-all after static ----------
app.get('/', (_req, res) => fs.existsSync(indexFile) ? res.sendFile(indexFile) : res.status(500).send('index file missing'));
app.get(/^\/(?!api\/).*/, (_req, res) => fs.existsSync(indexFile) ? res.sendFile(indexFile) : res.status(500).send('index file missing'));

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log(`Serving frontend from: ${frontendDir}`);
  console.log(`Root file: ${indexFile}`);
});
