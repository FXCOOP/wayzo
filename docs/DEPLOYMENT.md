# Deployment Guide

## Frontend
- Deploy `frontend/` to Vercel, Netlify, or any static host.
- Use `index.backend.html` when pointing to your live backend.

## Backend
- Use Render, Railway, Fly.io, or a small VPS.
- Set environment variables from `.env.example`.
- Expose `/api/stripe/webhook` publicly for Stripe to call.
- Ensure `ORIGIN` is your frontend domain for proper CORS.

## Stripe Webhook (local dev)
```bash
stripe listen --forward-to localhost:8080/api/stripe/webhook
```

## Domains
- Frontend: `app.yourdomain.com`
- Backend: `api.yourdomain.com`
- Update `ORIGIN` in `.env` accordingly.
