# API Reference (staging-v28)

Base URL: `https://<your-backend-domain>`

## POST /api/preview
Create a plan shell + teaser.
**Body (JSON)**
```json
{
  "destination": "Paris",
  "start": "2025-09-01",
  "end": "2025-09-07",
  "budget": 1500,
  "travelers": 2,
  "level": "mid",
  "prefs": "romance, museums"
}
```
**Response**
```json
{ "id": "uuid", "teaser_html": "<div>...</div>", "quick_links": { "maps": "...", "flights": "...", "hotels": "...", "activities": "...", "cars": "...", "insurance": "...", "reviews": "..." }, "version": "staging-v28" }
```

## POST /api/plan
Generate and store the full plan with OpenAI.
**Body** — same as `/api/preview`.

**Response**
```json
{ "id": "uuid", "markdown": "# Trip Plan...", "html": "<div>...</div>", "affiliates": { ... }, "version": "staging-v28" }
```

## GET /api/plan/:id
Fetch saved plan JSON (the original payload + markdown).

## GET /api/plan/:id/pdf
Return the report rendered as printable HTML (use a headless browser or your client to save as PDF).

## POST /api/checkout
Create a Stripe Checkout session.
**Body**
```json
{ "planId": "uuid", "success_url": "https://...", "cancel_url": "https://..." }
```

**Response**
```json
{ "url": "https://checkout.stripe.com/..." }
```

## POST /api/stripe/webhook
Stripe webhook for Checkout session events (`checkout.session.completed`).

**Note**: Use `express.raw()` for this route, and configure your webhook secret in `.env`.
