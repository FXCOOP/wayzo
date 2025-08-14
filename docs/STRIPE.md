# Stripe Setup

1. Create a Product in Stripe (e.g., "Trip Plan").
2. Create a Price (one-time) for $19 → copy `price_...` into `STRIPE_PRICE_ID`.
3. Get your `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
4. Start the backend with these env vars set.
5. In frontend `index.backend.html`, the Buy button calls `/api/checkout`.

**Testing**
- Use Stripe test card: `4242 4242 4242 4242`, any future date, any CVC/ZIP.
- Use `stripe listen` CLI for webhooks in local development.
