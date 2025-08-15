// backend/server.mjs
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import sanitizeHtml from "sanitize-html";
import { marked } from "marked";
import puppeteer from "puppeteer";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));

// --- Simple CSP that still allows hero images & Google Maps ---
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: https:",
  "script-src 'self' 'unsafe-inline' https: maps.googleapis.com maps.gstatic.com",
  "style-src 'self' 'unsafe-inline' https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https:",
  "frame-src https:",
].join("; ");

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", CSP);
  next();
});

// --- DB (auto created) ---
const db = new Database(path.join(__dirname, "wayzo.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS plans(
    id TEXT PRIMARY KEY,
    created_at TEXT,
    payload_json TEXT,    -- request body
    teaser_html TEXT,
    markdown TEXT
  )
`);

// --- Helpers ---
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasMapsKey = !!process.env.GOOGLE_MAPS_API_KEY;

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
}

function toTeaserHTML(data) {
  const { destination, start, end, travelers, level } = data;
  const dur = start && end ? ` (${start} → ${end})` : "";
  const style = level === "luxury" ? "luxury" : level === "mid" ? "mid-range" : "budget";
  return `
  <div class="teaser">
    <h3>${destination}${dur}</h3>
    <p><b>${travelers}</b> travelers • <b>${style}</b> style</p>
    <ul>
      <li>Estimated total: ${(data.budget || 0).toLocaleString()} USD</li>
      <li>Focus: ${data.prefs || "balanced sights & food"}</li>
    </ul>
    <small>Generate the full schedule, hotels, restaurants, maps, and a cost table when ready.</small>
  </div>`;
}

function naivePOIsFromMarkdown(md, destination) {
  // Very light heuristic: pick bracket text that looks like a place or bold headings
  const names = new Set();
  const linkRe = /\[([^\]]{3,60})\]\((https?:\/\/[^\)]+)\)/g;
  let m;
  while ((m = linkRe.exec(md))) {
    const label = m[1].trim();
    // Skip generic words
    if (!/day|lunch|dinner|breakfast|hotel|market|district|pass|card|ticket/i.test(label)) {
      names.add(label);
    }
  }
  // Fallback: try lines like "- Visit X" / "- Explore X"
  md.split("\n").forEach((line) => {
    const s = line.trim();
    if (/^-+\s*(visit|explore|see|walk|head|arrive)/i.test(s)) {
      const guess = s.replace(/^-\s*(visit|explore|see|walk|head|arrive)\s*/i, "");
      const clean = guess.replace(/\(.*?\)|\**/g, "").trim();
      if (clean.split(" ").length <= 8 && clean.length > 3) {
        names.add(clean);
      }
    }
  });

  // Build GMaps place queries
  return Array.from(names).slice(0, 30).map((n) => ({
    name: n,
    query: `${n}, ${destination}`,
  }));
}

// --- AI (fallback text if no key) ---
async function buildMarkdown(data) {
  const { destination, start, end, travelers, level, prefs = "", pace = "balanced" } = data;

  if (!hasOpenAI) {
    // Plain but tidy fallback
    const budget = (data.budget || 0).toLocaleString();
    return `# Trip Summary
**${destination}** ${start && end ? `(${start} → ${end})` : ""} for **${travelers}** traveler(s), **${level}** style, **${pace}** pace.
Focus: ${prefs || "sights & food"} • Estimated total budget: **$${budget}**.

## Day-by-day (sample)
- **Day 1**: Arrival, old town walk, casual dinner.
- **Day 2**: Highlights & museums, afternoon park, street food.
- **Day 3**: Local market + neighborhood tour.
- **Day 4**: Day trip to a nearby highlight if time/budget allow.
- **Day 5**: Relaxed morning, iconic viewpoint at sunset.
- **Day 6**: Culture & art cluster, trending bistro dinner.
- **Day 7**: Leisure + shopping, farewell dinner.

## Booking Shortcuts
[Flights](https://www.kayak.com/flights?aff=AFF) · [Hotels](https://www.booking.com/?aid=AID) · [Activities](https://www.getyourguide.com/?partner_id=PID) · [Cars](https://www.rentalcars.com/?affiliateCode=CODE) · [Insurance](https://www.worldnomads.com/?aff=AFF)
`;
  }

  // If you want to call OpenAI, plug your preferred model here.
  // Keeping it simple; you already had this wired before.
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const sys = `You are Wayzo Trip Planner. Produce a clear, helpful, copy-edit-ready itinerary in Markdown.
Include: Trip Summary, Neighborhood/Area guide, Day-by-day with times, Cost breakdown table (rough),
essentials, checklist & packing list, and inline Google Maps links for key places. Destination: ${destination}.`;
  const user = JSON.stringify(data);

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: sys }, { role: "user", content: user }],
    temperature: 0.6,
  });

  const md = resp.choices?.[0]?.message?.content || "Plan unavailable.";
  return md;
}

// --- API ---
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
app.get("/__debug", (_req, res) => res.json({ hasOpenAI, hasMapsKey }));

app.get("/api/config", (_req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  });
});

app.post("/api/preview", async (req, res) => {
  try {
    const data = req.body || {};
    const id = uid();
    const teaser = toTeaserHTML(data);

    db.prepare(
      `INSERT INTO plans(id, created_at, payload_json, teaser_html) VALUES(?, datetime('now'), ?, ?)`
    ).run(id, JSON.stringify(data), teaser);

    // Affiliate set (basic sample)
    const q = encodeURIComponent(data.destination || "");
    res.json({
      id,
      teaser_html: teaser,
      affiliates: {
        flights: `https://www.kayak.com/flights?aff=AFF&destination=${q}`,
        hotels: `https://www.booking.com/searchresults.html?aid=AID&ss=${q}`,
        activities: `https://www.getyourguide.com/s/?q=${q}&partner_id=PID`,
        cars: `https://www.rentalcars.com/SearchResults.do?affiliateCode=CODE&destination=${q}`,
        insurance: `https://www.worldnomads.com/?aff=AFF`,
        reviews: `https://www.tripadvisor.com/Search?q=${q}`,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "preview_failed" });
  }
});

app.post("/api/plan", async (req, res) => {
  try {
    const id = uid();
    const data = req.body || {};
    const md = await buildMarkdown(data);

    db.prepare(
      `INSERT INTO plans(id, created_at, payload_json, markdown) VALUES(?, datetime('now'), ?, ?)`
    ).run(id, JSON.stringify(data), md);

    res.json({ id, markdown: md });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "plan_failed" });
  }
});

app.get("/api/plan/:id/points", (req, res) => {
  const row = db.prepare("SELECT markdown, payload_json FROM plans WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  const payload = JSON.parse(row.payload_json || "{}");
  const destination = payload.destination || "";
  const points = naivePOIsFromMarkdown(row.markdown || "", destination);
  res.json({ destination, points });
});

app.get("/api/plan/:id/pdf", async (req, res) => {
  const row = db.prepare("SELECT markdown, payload_json FROM plans WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).send("Not found");

  const payload = JSON.parse(row.payload_json || "{}");
  const title = `Wayzo – ${payload.destination || "Trip"}`;
  const html = marked.parse(row.markdown || "No content");

  // A4, header/footer, hero on right
  const shell = `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>${title}</title>
<style>
  @page { size: A4; margin: 22mm 16mm; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif; color:#0f172a; }
  header { position: fixed; top: -14mm; left: 0; right: 0; height: 10mm; font-size: 11px; color:#64748b;
           display:flex; align-items:center; justify-content:space-between; }
  header .brand { font-weight: 800; color:#0ea5e9; }
  footer { position: fixed; bottom: -14mm; left:0; right:0; height:10mm; font-size: 11px; color:#64748b;
           display:flex; align-items:center; justify-content:space-between; }
  .pagenum:before { content: counter(page); }
  h1,h2,h3 { color:#111827; margin: 12px 0 8px; }
  h1 { font-size: 20px; }
  h2 { font-size: 16px; }
  h3 { font-size: 13px; }
  p, li { font-size: 12px; line-height: 1.45; }
  .hero { display:flex; gap:18px; margin:8px 0 16px; }
  .hero .left { flex: 1; }
  .hero .right { width: 36%; border-radius: 12px; overflow:hidden; }
  .hero .right img{ width:100%; height:100%; object-fit:cover; }
  .prose table { width:100%; border-collapse: collapse; margin: 8px 0; }
  .prose th, .prose td { border:1px solid #e5e7eb; padding:6px 8px; font-size: 12px; }
  .badge { display:inline-block; border:1px solid #d1fae5; background:#ecfdf5; color:#065f46; border-radius:999px; padding:2px 8px; font-size:11px; }
</style>
</head>
<body>
<header>
  <span class="brand">Wayzo</span>
  <span>${payload.destination || ""} · ${payload.start || ""} → ${payload.end || ""}</span>
</header>
<footer>
  <span>wayzo.online</span>
  <span>Page <span class="pagenum"></span></span>
</footer>

<div class="hero">
  <div class="left">
    <h1>${payload.destination || "Your trip"}</h1>
    <p><span class="badge">${(payload.travelers || 1)} traveler(s)</span> 
       <span class="badge">${payload.level || "budget"}</span>
       <span class="badge">${payload.pace || "balanced"}</span></p>
  </div>
  <div class="right">
    <img src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop" alt="Hero"/>
  </div>
</div>

<div class="prose">
${html}
</div>
</body>
</html>`;

  try {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(shell, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" } });
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="wayzo-${(payload.destination || "trip").toLowerCase()}.pdf"`);
    res.send(pdf);
  } catch (e) {
    console.error(e);
    res.status(500).send("pdf_failed");
  }
});

// --- Static frontend ---
const FRONTEND_DIR = path.resolve(__dirname, "../frontend");
app.use(express.static(FRONTEND_DIR, { extensions: ["html"] }));

app.get("/", (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.backend.html"));
});

// --- Start ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Wayzo backend running on :${PORT}`);
  console.log(`Serving frontend from: ${FRONTEND_DIR}`);
  console.log(`Root file: ${path.join(FRONTEND_DIR, "index.backend.html")}`);
});
