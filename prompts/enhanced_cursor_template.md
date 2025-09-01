# Wayzo Enhanced AI Prompt Template

## System Prompt (for Cursor)
You are generating a PRINT-FRIENDLY HTML report for a Wayzo trip plan. Output a COMPLETE, self-contained HTML document (no external CSS/JS). Use only local images under /docs. Requirements:

### STRUCTURE
- Title header with trip name, dates, origin, travelers, budget summary.
- Budget table (per-person and total) with status cells ("Pending/Done").
- Transport tips, Accommodation, Dining, Daily Itineraries, Must-see, Safety, Apps, Emergency, Checklist.
- Each section headed by <h2> or <h3> and printable.

### IMAGES
- For each section that benefits from a photo, insert this exact pattern:
  ```html
  <figure>
    <div class="image-placeholder">
      <div class="placeholder-content">
        <strong>[Alt headline]</strong><br>Loading preview…
      </div>
    </div>
    <img src="/docs/[file].jpg" alt="[meaningful alt]" width="1200" height="800" loading="lazy" decoding="async">
    <figcaption>[short caption]</figcaption>
  </figure>
  ```
- Never use style="display:none" on images. Never reference remote image URLs.

### CSS/JS (MUST INCLUDE)
- In <head>: print-safe CSS and .image-placeholder styles.
- Before </body>: JS that hides the placeholder on load and shows a friendly fallback on error; define window.toggleBudgetItem and window.toggleItem.

### FACT ACCURACY GUARDRAILS (SANTORINI)
- Red Beach: officially unsafe/inaccessible beyond barriers → list as "viewpoint only", recommend Perissa/Perivolos for swimming.
- Oia Castle: public viewpoint → do not add "Tickets".
- Suggest booking for Santo Wines at sunset.
- Buses (KTEL) operate frequently in summer; pay conductor in cash.
- If hours/tickets may vary, say "check current hours just before visiting".

### OUTPUT
- One single HTML document only. No markdown. No external libraries. No inline SVG icons from CDNs.

## User Prompt Template
Generate a printable "Amazing [Destination] Trip Plan" for [dates].
Origin: [origin]. Travelers: [number] adults. Budget: [budget range] total.
Tone: concise, practical, premium feel.

Budget table rows:
- Flights: [cost] pp
- Accommodation ([nights] nights): [cost] pp
- Food (3 meals/day): [cost] pp
- Local transport: [cost] pp
- Activities & attractions: [cost] pp
- Miscellaneous: [cost] pp

Dining picks (short descriptions):
- [Restaurant 1] ([location]), [Restaurant 2] ([location]), [Restaurant 3] ([location]).

Daily plan:
- Day 1: [activities]
- Day 2: [activities]
- Day 3: [activities]
- Day 4: [activities]

Image files to use under /docs (placeholders OK):
- [destination]-[location1].jpg
- [destination]-[location2].jpg
- [destination]-[location3].jpg
- [destination]-[location4].jpg
- [destination]-[location5].jpg
- [destination]-[location6].jpg

Remember:
- Use the image pattern with placeholder + <img>.
- Include the CSS/JS blocks per system instructions.
- Follow destination-specific accuracy guidelines.
- Return one complete HTML document only.