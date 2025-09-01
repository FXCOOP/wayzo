# TripMaster AI — Starter Kit

All-in-one kit to launch an AI-powered travel planning web service.

## Structure
- `frontend/`
  - `index.html` — mobile-first UI (local teaser only)
  - `index.backend.html` — UI wired to backend preview/checkout
- `backend/`
  - `server.mjs` — Express API (OpenAI + Stripe + SQLite + PDF)
  - `package.json` — dependencies and scripts
  - `.env.example` — copy to `.env` and fill
- `docs/`
  - `ARCHITECTURE.md`, `API.md`, `DEPLOYMENT.md`, `STRIPE.md`, `AFFILIATES.md`, `TODO.md`

## Quick Start
1. **Backend**
   ```bash
   cd backend
   cp .env.example .env
   # Fill OpenAI + Stripe + affiliate IDs
   npm i
   npm run dev
   ```
   
   **API Configuration:**
   - Set `OPENAI_API_KEY` for OpenAI GPT (recommended: gpt-4o-mini or gpt-4)
   - Alternatively, you can use ChatGPT API by setting the same OpenAI key
   - The system includes enhanced prompts for destination-specific, high-quality travel plans
2. **Frontend**
   - For local demo: open `frontend/index.html`
   - For full flow: serve `frontend/index.backend.html` from same origin as backend (or configure CORS)

Last updated: 2025-08-14 08:57:39 UTC
