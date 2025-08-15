// frontend/app.js
const $ = (s) => document.querySelector(s);
const byName = (n) => document.querySelector(`[name="${n}"]`);

let GOOGLE_KEY = "";
let MAP;
let PLAN_ID;

function showLoading(on) {
  $("#loading").classList.toggle("hidden", !on);
}

/* Minimal markdown -> HTML prettifier (keeps our simple CSS) */
function mdToHTML(md) {
  md = md.replace(/^### (.*)$/gm, "<h3>$1</h3>")
         .replace(/^## (.*)$/gm, "<h2>$1</h2>")
         .replace(/^# (.*)$/gm, "<h1>$1</h1>")
         .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
         .replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
         .replace(/^\- (.*)$/gm, "<li>$1</li>");
  md = md.replace(/(<li>.*<\/li>)(\n(?!<li>))/g, "<ul>$1</ul>\n");
  md = md.split(/\n{2,}/).map(b=>{
    if(/^<h\d|<ul>|<li>/.test(b.trim())) return b;
    return "<p>"+b.replace(/\n/g,"<br>")+"</p>";
  }).join("\n");
  return `<div class="prose">${md}</div>`;
}

/* Update affiliate shortcut links */
function setLinks(aff) {
  if (!aff) return;
  $("#linkFlights").href = aff.flights;
  $("#linkHotels").href = aff.hotels;
  $("#linkActivities").href = aff.activities;
  $("#linkCars").href = aff.cars;
  $("#linkInsurance").href = aff.insurance;
}

/* --- Form submit: Preview --- */
async function handlePreview(e){
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.budget = Number(data.budget||0);
  data.travelers = Number(data.travelers||1);
  showLoading(true);
  try {
    const r = await fetch("/api/preview", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(data)
    });
    const j = await r.json();
    PLAN_ID = j.id;
    $("#preview").innerHTML = j.teaser_html || "Preview unavailable";
    setLinks(j.affiliates);
    localStorage.setItem("wayzo_last", JSON.stringify(data));
    // Reveal map section only when full plan exists (keep hidden here)
    $("#mapSection").classList.add("hidden");
  } catch(err){
    console.error(err);
    alert("Preview failed. Is the backend running?");
  } finally {
    showLoading(false);
  }
}

/* --- Full plan (AI) --- */
async function handleFull() {
  const last = JSON.parse(localStorage.getItem("wayzo_last") || "null");
  if (!last) return alert("Generate a preview first.");
  showLoading(true);
  try {
    const r = await fetch("/api/plan", {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(last)
    });
    const j = await r.json();
    PLAN_ID = j.id;
    $("#preview").innerHTML = mdToHTML(j.markdown || "# Plan unavailable");
    $("#pdfBtn").classList.remove("hidden");
    $("#pdfBtn").href = `/api/plan/${j.id}/pdf`;

    // Show Map section (still empty until "Plot on Map")
    $("#mapSection").classList.remove("hidden");

    // fetch config once
    if (!GOOGLE_KEY) {
      const c = await (await fetch("/api/config")).json();
      GOOGLE_KEY = c.googleMapsApiKey || "";
    }
  } catch(err){
    console.error(err);
    alert("Full plan failed. Check OPENAI_API_KEY on the backend.");
  } finally {
    showLoading(false);
  }
}

/* --- Save preview locally --- */
function handleSave(){
  const plans = JSON.parse(localStorage.getItem("wayzo_saved") || "[]");
  plans.push({ id: PLAN_ID || crypto.randomUUID(), at: new Date().toISOString(), html: $("#preview").innerHTML });
  localStorage.setItem("wayzo_saved", JSON.stringify(plans));
  alert("Saved locally.");
}

/* --- Plot on Google Map --- */
async function handlePlot(){
  if (!PLAN_ID) return alert("Generate a full plan first.");
  if (!GOOGLE_KEY) {
    const c = await (await fetch("/api/config")).json();
    GOOGLE_KEY = c.googleMapsApiKey || "";
  }
  if (!GOOGLE_KEY) return alert("Google Maps key is not configured on the server.");

  // Load gmaps script once
  if (!window.google || !window.google.maps) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&callback=__wayzoInitMap`;
      s.async = true;
      s.onerror = reject;
      window.__wayzoInitMap = () => resolve();
      document.head.appendChild(s);
    });
  }

  // Fetch points from backend
  const j = await (await fetch(`/api/plan/${PLAN_ID}/points`)).json();
  initMapWith(j.destination, j.points || []);
}

function initMapWith(destination, points){
  const mapDiv = $("#map");
  if (!MAP) {
    MAP = new google.maps.Map(mapDiv, { center: { lat: 0, lng: 0 }, zoom: 12, mapTypeControl: false });
  }

  const geocoder = new google.maps.Geocoder();
  const bounds = new google.maps.LatLngBounds();

  // Center on destination
  geocoder.geocode({ address: destination }, (res, status) => {
    if (status === "OK" && res[0]) {
      MAP.setCenter(res[0].geometry.location);
      bounds.extend(res[0].geometry.location);
    }
  });

  // Plot each
  points.slice(0, 30).forEach((p, idx) => {
    geocoder.geocode({ address: p.query }, (res, status) => {
      if (status === "OK" && res[0]) {
        const marker = new google.maps.Marker({
          map: MAP,
          position: res[0].geometry.location,
          label: String((idx % 26) + 1),
          title: p.name
        });
        bounds.extend(res[0].geometry.location);
        MAP.fitBounds(bounds);
      }
    });
  });
}

/* --- hydrate last form --- */
(function hydrate(){
  const last = JSON.parse(localStorage.getItem("wayzo_last") || "null");
  if (!last) return;
  for (const [k,v] of Object.entries(last)) {
    const el = byName(k); if (!el) continue;
    if (el.type === "radio") {
      const r = document.querySelector(`input[name="${k}"][value="${v}"]`);
      r && (r.checked = true);
    } else { el.value = v; }
  }
})();

/* Bind */
$("#tripForm").addEventListener("submit", handlePreview);
$("#fullBtn").addEventListener("click", handleFull);
$("#saveBtn").addEventListener("click", handleSave);
$("#plotBtn").addEventListener("click", handlePlot);
