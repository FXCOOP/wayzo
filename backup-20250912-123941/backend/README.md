# TripMaster AI — Backend (Node/Express)

Secure API with Stripe, OpenAI, SQLite.

## Setup
```bash
cd backend
cp .env.example .env   # fill keys
npm i
npm run dev
```

## Endpoints
- `POST /api/preview` → { id, teaser_html, affiliates }
- `POST /api/plan` → { id, markdown, affiliates }
- `GET  /api/plan/:id` → plan JSON
- `GET  /api/plan/:id/pdf` → download PDF
- `POST /api/checkout` → { url } (Stripe Checkout)
- `POST /api/stripe/webhook` → Stripe webhook (use `stripe listen --forward-to localhost:8080/api/stripe/webhook`)

## Notes
- DB: SQLite file at `DB_PATH` (default `./tripmaster.sqlite`).
- Rate-limited to 60 req/minute.
- Update `ORIGIN` to your frontend domain for CORS.
- Last updated: 2025-08-14 08:57:39 UTC
