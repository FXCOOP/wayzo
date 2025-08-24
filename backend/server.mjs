/* eslint-disable no-console */

import express from "express";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { marked } from "marked";
import OpenAI from "openai";
import multer from "multer";

import { normalizeBudget, computeBudget } from "./lib/budget.mjs";
import { ensureDaySections } from "./lib/expand-days.mjs";
import { affiliatesFor, linkifyTokens } from "./lib/links.mjs";
import { buildIcs } from "./lib/ics.mjs";

const VERSION = "staging-v17";

/* .env locally only (Render uses real env vars) */
if (process.env.NODE_ENV !== "production") {
  try {
    const { config } = await import("dotenv");
    config();
  } catch {}
}

/* Paths */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);     // /backend
const ROOT = __dirname;
const FRONTEND = path.join(__dirname, "..", "frontend");
const DOCS = path.join(__dirname, "..", "docs");
const UPLOADS = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOADS, { recursive: true });

let INDEX = path.join(FRONTEND, "index.backend.html");
if (!fs.existsSync(INDEX)) {
  const alt = path.join(FRONTEND, "index.html");
  if (fs.existsSync(alt)) INDEX = alt;
}

/* App */
const app = express();
const PORT = Number(process.env.PORT || 10000);

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);
app.use(compression());
app.use(morgan("tiny"));
app.use(cors());
app.use(rateLimit({ windowMs: 60_000, limit: 160 }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

/* Static — no-cache for CSS/JS on staging, long cache for images */
const staticHeaders = {
  setHeaders: (res, filePath) => {
    if (/\.css$/i.test(filePath) || /\.js$/i.test(filePath)) {
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
    } else if (/\.(svg|png|jpg|jpeg|webp|ico)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    if (/\.css$/i.test(filePath)) res.setHeader("Content-Type", "text/css; charset=utf-8");
    if (/\.js$/i.test(filePath)) res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  },
};

app.use("/docs", express.static(DOCS, staticHeaders));
app.use("/uploads", express.static(UPLOADS, { setHeaders: res => res.setHeader("Cache-Control", "public, max-age=1209600") }));
app.use("/", express.static(FRONTEND, staticHeaders));

/* Root + health/version */
function sendIndex(res) {
  res.setHeader("X-Wayzo-Version", VERSION);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Surrogate-Control", "no-store");
  if (!fs.existsSync(INDEX)) return res.status(500).send("index file missing");
  res.sendFile(INDEX);
}
app.get("/", (_req, res) => sendIndex(res));
app.get("/healthz", (_req, res) => res.json({ ok: true, version: VERSION }));
app.get("/version", (_req, res) => res.json({ version: VERSION }));

/* Uploads (keeps extensions so images preview fine) */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^\w.-]+/g, "_");
    const ts = Date.now().toString(36);
    const ext = path.extname(safeName);
    cb(null, `${ts}-${safeName}${ext ? "" : ""}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024, files: 8 } });

app.post("/api/upload", upload.array("files", 8), (req, res) => {
  const files = (req.files || []).map(f => ({
    name: f.originalname,
    size: f.size,
    url: `/uploads/${path.basename(f.path)}`,
    mime: f.mimetype,
  }));
  res.json({ files });
});

/* DB */
const db = new Database(path.join(ROOT, "wayzo.sqlite"));
db.exec(`CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, payload TEXT NOT NULL)`);
const savePlan = db.prepare("INSERT OR REPLACE INTO plans (id, created_at, payload) VALUES (?, ?, ?)");
const getPlan = db.prepare("SELECT payload FROM plans WHERE id = ?");

const nowIso = () => new Date().toISOString();
const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

/* marked: open links/images in new tab */
marked.use({
  renderer: {
    link(href, title, text) {
      const t = title ? ` title="${String(title).replace(/"/g, "&quot;")}"` : "";
      const safe = (href || "#").replace(/"/g, "%22");
      return `<a href="${safe}"${t} target="_blank" rel="noopener">${text}</a>`;
    },
    image(href, title, text) {
      const t = title ? ` title="${String(title).replace(/"/g, "&quot;")}"` : "";
      const safe = (href || "").replace(/"/g, "%22");
      return `<img src="${safe}" alt="${String(text || "").replace(/[&<>"]/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[m]))}"${t}/>`;
    },
  },
});

/* Helpers */
const daysBetween = (a, b) => {
  if (!a || !b) return 1;
  const s = new Date(a), e = new Date(b);
  if (isNaN(s) || isNaN(e)) return 1;
  return Math.max(1, Math.round((e - s) / 86400000) + 1);
};
const seasonFromDate = (iso = "") =>
  ([12, 1, 2].includes(new Date(iso).getMonth() + 1) ? "Winter" :
   [3, 4, 5].includes(new Date(iso).getMonth() + 1) ? "Spring" :
   [6, 7, 8].includes(new Date(iso).getMonth() + 1) ? "Summer" : "Autumn");
const travelerLabel = (ad = 2, ch = 0) =>
  ch > 0 ? `Family (${ad} adult${ad === 1 ? "" : "s"} + ${ch} kid${ch === 1 ? "" : "s"})` :
  (ad === 2 ? "Couple" : ad === 1 ? "Solo" : `${ad} adult${ad === 1 ? "" : "s"}`);
const perPersonPerDay = (t = 0, d = 1, tr = 1) => Math.round((Number(t) || 0) / Math.max(1, d) / Math.max(1, tr));

/* Local fallback plan (when no OpenAI key) */
function localPlanMarkdown(input) {
  const { destination = "Your destination", start = "start", end = "end", budget = 1500, adults = 2, children = 0, level = "mid", prefs = "", currency = "USD $" } = input || {};
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
- **Morning:** Arrive and check-in. [Map](map:${destination} airport to hotel)
- **Afternoon:** Easy walk near hotel. [Reviews](reviews:${destination} cafe)
- **Evening:** Dinner nearby. [Book](book:${destination} dinner)
`.trim(), destination);
}

/* OpenAI (optional) */
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

async function generatePlanWithAI(payload) {
  const { destination = "", start = "", end = "", budget = 0, currency = "USD $", adults = 2, children = 0, level = "mid", prefs = "", diet = "" } = payload || {};
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
    let md = localPlanMarkdown(payload);
    md = ensureDaySections(md, nDays, start);
    return md;
  }

  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.6,
    messages: [{ role: "system", content: sys }, { role: "user", content: user }],
  });
  let md = resp.choices?.[0]?.message?.content?.trim() || "";
  if (!md) md = localPlanMarkdown(payload);
  md = linkifyTokens(md, destination);
  md = ensureDaySections(md, nDays, start);
  return md;
}

/* API */
app.post("/api/preview", (req, res) => {
  const payload = req.body || {};
  payload.budget = normalizeBudget(payload.budget, payload.currency);
  const id = uid();
  const teaser_html = `
<div>
  <h3 class="h3">${payload.destination || "Your destination"} — preview</h3>
  <ul>
    <li>Neighborhood clustering to minimize transit</li>
    <li>Tickets/Bookings with direct links</li>
    <li>Click <b>Generate full plan (AI)</b> for complete schedule</li>
  </ul>
</div>`;
  res.json({ id, teaser_html, affiliates: affiliatesFor(payload.destination || ""), version: VERSION });
});

app.post("/api/plan", async (req, res) => {
  try {
    const payload = req.body || {};
    payload.budget = normalizeBudget(payload.budget, payload.currency);
    const id = uid();
    const markdown = await generatePlanWithAI(payload);
    const html = marked.parse(markdown);
    const aff = affiliatesFor(payload.destination);
    savePlan.run(id, nowIso(), JSON.stringify({ id, type: "plan", data: payload, markdown }));
    res.json({ id, markdown, html, affiliates: aff, version: VERSION });
  } catch (e) {
    console.error("plan error:", e);
    res.status(200).json({ markdown: "# Plan unavailable\nPlease try again shortly.", version: VERSION });
  }
});

app.get("/api/plan/:id/pdf", (req, res) => {
  const row = getPlan.get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  const saved = JSON.parse(row.payload || "{}");
  const d = saved?.data || {};
  const md = saved?.markdown || "";
  const htmlBody = marked.parse(md);
  const style = d.level === "luxury" ? "Luxury" : d.level === "budget" ? "Budget" : "Mid-range";
  const season = seasonFromDate(d.start);
  const days = daysBetween(d.start, d.end);
  const pppd = perPersonPerDay(normalizeBudget(d.budget, d.currency), days, Math.max(1, (d.adults || 0) + (d.children || 0)));
  const traveler = travelerLabel(d.adults || 0, d.children || 0);

  const base = `${req.protocol}://${req.get("host")}`;
  const pdfUrl = `${base}/api/plan/${req.params.id}/pdf`;
  const icsUrl = `${base}/api/plan/${req.params.id}/ics`;
  const shareX = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`My ${d.destination} plan by Wayzo`)}&url=${encodeURIComponent(pdfUrl)}`;

  const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Wayzo Trip Report</title>
<style>
:root{--ink:#0f172a; --muted:#475569; --brand:#6366f1; --bg:#ffffff; --accent:#eef2ff; --border:#e2e8f0;}
*{box-sizing:border-box}
body{font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,Arial;color:var(--ink);margin:24px;background:var(--bg)}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;padding-bottom:10px;border-bottom:2px solid var(--border);flex-wrap:wrap}
.logo{display:flex;gap:10px;align-items:center}.badge{width:28px;height:28px;border-radius:8px;background:var(--brand);color:#fff;display:grid;place-items:center;font-weight:700}
.pill{border:1px solid var(--border);background:var(--accent);padding:.25rem .6rem;border-radius:999px;font-size:12px}
.summary{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px 0}
.summary .chip{border:1px solid var(--border);background:#fff;border-radius:999px;padding:.25rem .6rem;font-size:12px}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 14px}.actions a{color:#0f172a;text-decoration:none;border-bottom:1px dotted rgba(2,6,23,.25)}
.facts{background:#fff;border:1px solid var(--border);border-radius:12px;padding:10px;margin:8px 0}
img{max-width:100%;height:auto;border-radius:10px}table{border-collapse:collapse;width:100%}
th,td{border:1px solid var(--border);padding:.45rem .55rem;text-align:left} thead th{background:var(--accent)}
footer{margin-top:24px;color:var(--muted);font-size:12px}
</style></head><body>
<header><div class="logo"><div class="badge">WZ</div><div><b>Wayzo</b><div class="tagline">Trips that plan themselves.</div></div></div><span class="pill">${VERSION}</span></header>
<div class="summary">
  <span class="chip"><b>Travelers:</b> ${traveler}</span>
  <span class="chip"><b>Style:</b> ${style}${d.prefs ? ` · ${String(d.prefs)}` : ""}</span>
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
    <li>🌡️ Weather: seasonal conditions around ${season}.</li>
    <li>💱 Currency: ${d.currency}</li>
    <li>🗣️ Language: English (tourism friendly)</li>
    <li>🔌 Voltage: 230V (Type C/E)</li>
    <li>💁 Tipping: 5–10% in restaurants (optional)</li>
  </ul>
</div>
${htmlBody}
<footer>Generated by Wayzo — ${VERSION}</footer>
</body></html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

app.get("/api/plan/:id/ics", (req, res) => {
  const row = getPlan.get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  const saved = JSON.parse(row.payload || "{}");
  const md = saved.markdown || "";
  const dest = saved?.data?.destination || "Trip";
  const events = [];
  const rx = /^\s*###\s*Day\s+(\d+)\s*(?:—\s*([^\n(]+))?\s*(?:\((\d{4}-\d{2}-\d{2})\))?/gmi;
  let m;
  while ((m = rx.exec(md))) {
    const title = (m[2] || `Day ${m[1]}`).trim();
    const date = m[3] || saved?.data?.start || null;
    if (date) events.push({ title, date, start: "09:00", end: "11:00" });
  }
  const ics = buildIcs(req.params.id, events, { destination: dest });
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="wayzo-${req.params.id}.ics"`);
  res.send(ics);
});

/* SPA catch-all -> index */
app.get(/^\/(?!api\/).*/, (_req, res) => sendIndex(res));

app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log("Version:", VERSION);
  console.log("Index file:", INDEX);
});
