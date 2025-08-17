/* eslint-disable no-console */
import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// ---------- Paths (server file is in /backend) ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.join(__dirname, '..');
const FRONTEND   = path.join(ROOT, 'frontend');
const DOCS       = path.join(ROOT, 'docs');
const INDEX_HTML = path.join(FRONTEND, 'index.backend.html');

const app = express();
app.use(express.json({ limit: '1mb' }));

// ---------- Static: /docs (local images) ----------
app.use(
  '/docs',
  express.static(DOCS, {
    immutable: true,
    maxAge: '1y',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) res.type('image/jpeg');
      else if (filePath.endsWith('.png'))  res.type('image/png');
      else if (filePath.endsWith('.webp')) res.type('image/webp');
      else if (filePath.endsWith('.svg'))  res.type('image/svg+xml');
    }
  })
);

// ---------- Static: frontend (CSS/JS with correct MIME) ----------
app.use(
  express.static(FRONTEND, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.css'))  res.type('text/css; charset=utf-8');
      else if (filePath.endsWith('.js'))   res.type('application/javascript; charset=utf-8');
      else if (filePath.endsWith('.json')) res.type('application/json; charset=utf-8');
      else if (filePath.endsWith('.html')) res.type('text/html; charset=utf-8');
      else if (filePath.endsWith('.svg'))  res.type('image/svg+xml');
      else if (filePath.endsWith('.woff')) res.type('font/woff');
      else if (filePath.endsWith('.woff2'))res.type('font/woff2');
    }
  })
);

// ---------- Index ----------
app.get('/', (_req, res) => {
  if (fs.existsSync(INDEX_HTML)) return res.sendFile(INDEX_HTML);
  return res.status(500).send('index.backend.html missing');
});

// ---------- Health ----------
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// ---------- Minimal, safe stubs (so UI buttons don’t 500 if no key) ----------
app.post('/api/preview', (req, res) => {
  const i = req.body || {};
  return res.json({
    ok: true,
    preview: {
      tagline: `Quick preview for ${i.destination || 'your trip'}`,
      quickTake: 'Fill dates, budget and style, then generate the full plan.',
      highlights: ['Top sights', 'Kid-friendly picks', 'Local food'],
      estBudget: { currency: 'USD', perDay: 0, total: 0, notes: 'Estimate shown after full plan.' }
    }
  });
});

app.post('/api/plan', (req, res) => {
  const i = req.body || {};
  const plan = {
    destination: i.destination || 'Trip',
    dates: { start: i.start || '', end: i.end || '' },
    party: { adults: Number(i.adults || 2), children: 0, kidsAges: [] },
    style: 'balanced',
    pace: 'balanced',
    daily_start: '09:00',
    budget: { currency: 'USD', total: Number(i.budget || 0) },
    days: [],
    budget_breakdown: { lodging: 0, transport: 0, activities: 0, food: 0, misc: 0 },
    tips: ['Book popular attractions in advance', 'Carry a small power bank']
  };
  const reportMarkdown = `# ${plan.destination}\nDates: ${plan.dates.start} – ${plan.dates.end}\n\n(Use “Generate full plan” later for details.)`;
  const id = Math.random().toString(36).slice(2, 10);
  return res.json({ ok: true, id, plan, reportMarkdown });
});

// PDF endpoint kept but returns 204 for now (no breakage)
app.get('/api/plan/:id/pdf', (_req, res) => res.status(204).end());

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Wayzo running on :${PORT}`);
  console.log(`Serving frontend from: ${FRONTEND}`);
});
