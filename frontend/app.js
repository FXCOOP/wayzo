/* global fetch, FormData, FileReader */
"use strict";

/* Tiny helpers */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function html(strings, ...vals) {
  return strings.map((s, i) => s + (vals[i] ?? "")).join("");
}

/* Upload helpers */
async function uploadFiles(inputEl) {
  try {
    if (!inputEl || !inputEl.files || inputEl.files.length === 0) return [];
    const fd = new FormData();
    for (const f of inputEl.files) fd.append("files", f);
    const resp = await fetch("/api/upload", { method: "POST", body: fd });
    if (!resp.ok) throw new Error(`upload failed ${resp.status}`);
    const j = await resp.json().catch(() => ({ files: [] }));
    return j.files || [];
  } catch (e) {
    console.error("upload error:", e);
    return [];
  }
}

function renderThumbs(files, into) {
  into.innerHTML = "";
  for (const f of files) {
    const a = document.createElement("a");
    a.href = f.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.className = "thumb";
    a.title = f.name;
    a.innerHTML = `<img src="${f.url}" alt="${f.name}" loading="lazy" />`;
    into.appendChild(a);
  }
}

/* Read form -> payload */
function readPayload(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const adults = Number(data.adults || 2);
  const children = Number(data.children || 0);

  return {
    destination: data.destination || "",
    start: data.start || "",
    end: data.end || "",
    budget: Number(data.totalBudget || 0),
    currency: data.currency || "USD $",
    level: data.level || "mid",
    adults,
    children,
    prefs: data.prefs || "",
    diet: data.diet || "",
  };
}

async function callPreview(payload) {
  const r = await fetch("/api/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`preview ${r.status}`);
  return r.json();
}

async function callPlan(payload) {
  const r = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`plan ${r.status}`);
  return r.json();
}

/* UI wiring */
document.addEventListener("DOMContentLoaded", () => {
  const form = $("#tripForm");
  const previewDiv = $("#preview");
  const loading = $("#loading");
  const buyBtn = $("#buyBtn");
  const pdfBtn = $("#pdfBtn");
  const saveBtn = $("#saveBtn");

  const filesEl = $("#attachments");
  const thumbsEl = $("#attachmentsPreview"); // <div id="attachmentsPreview"></div> (add if you want visible thumbs)

  const childrenEl = $("#children");
  const agesRow = $("#agesRow");

  // Make sure clicks don't navigate
  if (buyBtn) {
    buyBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await generate(true);
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await generate(false);
    });
  }

  if (childrenEl && agesRow) {
    const toggleAges = () => {
      const n = Number(childrenEl.value || 0);
      agesRow.style.display = n > 0 ? "" : "none";
    };
    childrenEl.addEventListener("input", toggleAges);
    toggleAges();
  }

  if (filesEl) {
    filesEl.addEventListener("change", async () => {
      loading.style.display = "block";
      const uploaded = await uploadFiles(filesEl);
      if (thumbsEl) renderThumbs(uploaded, thumbsEl);
      // store last uploaded list on the input for later submit
      filesEl._uploaded = uploaded;
      loading.style.display = "none";
    });
  }

  async function generate(full) {
    try {
      loading.style.display = "block";
      previewDiv.innerHTML = "";

      const payload = readPayload(form);

      // include uploaded attachments (if any were chosen)
      if (filesEl && Array.isArray(filesEl._uploaded)) {
        payload.attachments = filesEl._uploaded;
      }

      const res = full ? await callPlan(payload) : await callPreview(payload);

      // basic HTML render (preview or full)
      if (res.teaser_html) {
        previewDiv.innerHTML = res.teaser_html;
      } else if (res.html) {
        previewDiv.innerHTML = res.html;
      } else if (res.markdown) {
        // very tiny markdown fallback
        previewDiv.innerHTML = res.markdown
          .replace(/^### (.*)$/gm, "<h3>$1</h3>")
          .replace(/^## (.*)$/gm, "<h2>$1</h2>")
          .replace(/^# (.*)$/gm, "<h1>$1</h1>")
          .replace(/\n/g, "<br/>");
      } else {
        previewDiv.textContent = "No content — please try again.";
      }

      // enable other UI bits when full result exists
      if (pdfBtn) pdfBtn.disabled = !res.id;
      if (saveBtn) saveBtn.disabled = !res.id;

    } catch (e) {
      console.error(e);
      previewDiv.textContent = "Something went wrong. Please try again.";
    } finally {
      loading.style.display = "none";
    }
  }
});
