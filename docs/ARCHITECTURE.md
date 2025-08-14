# Architecture Overview

**TripMaster AI** is a web-first, mobile-optimized travel planning system.

## Components
- **Frontend**: Static HTML + Tailwind. Two variants:
  - `index.html` — local teaser only.
  - `index.backend.html` — wired to backend preview/checkout.
- **Backend**: Node/Express with endpoints for teaser, full plan, Stripe checkout, and PDF export; SQLite storage.
- **OpenAI**: Generates full itineraries; replace placeholders with affiliate links.
- **Stripe**: $19 per plan via Checkout + webhook for payment confirmation.

## Flow
1. User fills the form → `POST /api/preview` (creates plan shell, returns `id`, teaser + affiliate links).
2. User pays → `POST /api/checkout` → Stripe Checkout.
3. On success, frontend fetches full plan (`GET /api/plan/:id`) or triggers `POST /api/plan` to generate if you prefer paywall-before-generation.
4. User views plan, downloads PDF (`/api/plan/:id/pdf`).

## Data
- `plans`: Basic inputs, teaser HTML, full plan markdown, affiliate links JSON.
- `orders`: Stripe session tracking and status.

Last updated: 2025-08-14 08:57:39 UTC
