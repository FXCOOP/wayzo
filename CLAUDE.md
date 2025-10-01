# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wayzo is an AI-powered trip planning application that generates personalized travel itineraries. It features a static frontend with dynamic backend integration, multi-language support, and a comprehensive admin dashboard.

## Development Commands

### Frontend Development
```bash
# Start local development server
cd frontend && python3 -m http.server 8000

# Alternative development server
npm run dev

# Test the application
open http://localhost:8000/test.html
```

### Backend Development
```bash
# Start the backend server
cd backend && npm start

# Run end-to-end tests
cd backend && npm run test:e2e
```

### Deployment
```bash
# Deploy to Netlify
npm run deploy:netlify

# Deploy to Vercel
npm run deploy:vercel

# Run deployment script with options
./deploy.sh
```

## Architecture

### Core Structure
- **Frontend**: Static site in `/frontend` with vanilla JS, no build process required
- **Backend**: Node.js/Express server in `/backend` with SQLite database
- **Main Entry Points**:
  - `frontend/index.backend.html` - Main application connected to backend
  - `backend/server.mjs` - Express server with API endpoints

### Key Components

#### Frontend Architecture
- **Main App** (`app.js`): Core application logic with these key classes:
  - `LanguageManager`: Handles 10-language i18n system
  - `AuthenticationManager`: Google OAuth + manual auth + demo mode
  - `MultiDestinationManager`: Handles multi-destination trip planning
  - `ReferralManager`: $5 discount referral system
  - `FormManager`: Form validation and submission
- **Admin Panel** (`admin.html`, `admin.js`): Professional back-office interface
- **Translations** (`translations.js`): Multi-language support for EN, ES, FR, DE, IT, PT, RU, ZH, JA, KO

#### Backend Architecture
- **API Endpoints**:
  - `POST /api/preview` - Generate trip preview/teaser
  - `POST /api/plan` - Generate full itinerary
  - `POST /api/checkout` - Stripe payment processing
  - `GET /api/plan/:id` - Fetch completed plan
  - `GET /api/plan/:id/pdf` - PDF export
- **Database**: SQLite with `plans` and `orders` tables
- **Integrations**: OpenAI for content generation, Stripe for payments, Puppeteer for PDF generation

### Data Flow
1. User fills form → `POST /api/preview` (creates plan shell + teaser)
2. User pays → `POST /api/checkout` → Stripe Checkout
3. On payment success → `GET /api/plan/:id` or `POST /api/plan` generates full itinerary
4. User downloads PDF via `/api/plan/:id/pdf`

## Tech Stack

### Frontend
- **Languages**: Vanilla HTML, CSS, JavaScript (ES6+)
- **Styling**: Custom CSS with CSS Grid/Flexbox
- **Features**: Multi-language, responsive design, PWA-ready
- **Browser Support**: Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

### Backend
- **Runtime**: Node.js 20.x
- **Framework**: Express.js
- **Database**: SQLite with better-sqlite3
- **AI**: OpenAI API for itinerary generation
- **Payments**: Stripe Checkout + webhooks
- **PDF**: Puppeteer for PDF generation
- **Security**: Helmet, CORS, rate limiting

## File Structure

### Frontend (`/frontend`)
```
frontend/
├── index.backend.html    # Main application (backend-connected)
├── admin.html           # Admin dashboard
├── app.js              # Main application logic
├── admin.js            # Admin panel logic
├── translations.js     # Multi-language support
├── style.css           # Main styles
├── admin.css           # Admin panel styles
└── assets/             # Images and static assets
```

### Backend (`/backend`)
```
backend/
├── server.mjs          # Main Express server
├── lib/               # Utility modules
│   ├── budget.mjs     # Budget calculations
│   ├── links.mjs      # Affiliate link handling
│   ├── widgets.mjs    # Dynamic content widgets
│   └── ics.mjs        # Calendar export
└── tests/             # End-to-end tests
```

## Configuration

### Environment Variables
```bash
# OpenAI Integration
OPENAI_API_KEY=your_openai_key

# Stripe Payments
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Frontend Integration (optional)
GOOGLE_CLIENT_ID=your_google_client_id
PAYPAL_CLIENT_ID=your_paypal_client_id
```

### Development Setup
1. No build process required for frontend - it's a static site
2. Backend requires `npm install` in `/backend` directory
3. SQLite database is created automatically on first run
4. Use environment variables or `.env` file for API keys

## Testing

## 🚨 CRITICAL: QA Testing Process (MANDATORY)

**EVERY code change MUST follow this testing protocol to prevent breaking critical functionality:**

### QA Testing Requirements (NON-NEGOTIABLE):
1. **Pre-Change Testing**: Run full test suite before making ANY changes
2. **Per-Fix Validation**: Test each fix individually before moving to next
3. **Regression Testing**: Verify all existing functionality still works
4. **Cross-Browser Testing**: Validate on Chrome, Firefox, Safari, Edge
5. **Mobile Testing**: Test responsive design on multiple screen sizes
6. **User Journey Testing**: Complete end-to-end user flows

### Mandatory Test Commands:
```bash
# 1. ALWAYS run before starting work
cd backend && npm run test

# 2. Run after each fix (HIGH PRIORITY first)
node tests/run-critical-tests.mjs --priority=high

# 3. Run comprehensive validation before deployment
npx playwright test tests/e2e/critical-fixes.test.js

# 4. Validate specific functionality
npm run test:openai  # For GPT API fixes
npm run test:location  # For location detection fixes
npm run test:widgets  # For widget integration fixes
```

### Critical Test Checkpoints:
- **Location Detection**: Must auto-populate form fields
- **Date Validation**: Prevent past dates, validate date ranges
- **Multi-Language**: All 10 languages must work
- **Authentication**: Google OAuth, demo mode, manual auth
- **Payment Flow**: Stripe integration must remain functional
- **Admin Panel**: All admin functionality preserved
- **Mobile Responsive**: Tables and forms work on mobile

### QA Agent Usage (REQUIRED):
```bash
# Use QA agent for every significant change
Task(subagent_type="qa-testing", description="Validate [specific fix]")
```

### Rollback Triggers (IMMEDIATE ACTION):
- Any test failure rate >20%
- Location detection stops working
- Trip generation fails for any destination
- Payment processing broken
- Admin panel inaccessible
- Mobile layout completely broken

### Emergency Rollback Procedure:
```bash
# Immediate rollback to last known good state
git checkout f0bbb2e
git push origin HEAD:fix-links-v68 --force
```

**⚠️ WARNING: Do NOT skip QA testing steps. Breaking core functionality affects user experience and business operations.**

### Manual Testing
- Frontend: `http://localhost:8000/test.html`
- Test features: location detection, language switching, authentication, multi-destination planning, admin panel

### Automated Testing
- E2E tests: `cd backend && npm run test:e2e`
- Uses Playwright for browser automation
- QA-specific tests: `cd backend && npm run test:critical-fixes`
- Mobile testing: Uses Playwright MCP integration

## Deployment Configurations

### Static Site Deployment (Frontend Only)
- **Netlify**: Configured in `netlify.toml`, build dir: `frontend`
- **Vercel**: Standard static site deployment
- **Render**: Static site service with rewrite rules in `render.yaml`

### Full-Stack Deployment (Frontend + Backend)
- **Render**: Web service running `node backend/server.mjs` (see `Procfile`)
- **Heroku**: Compatible with Procfile configuration

## Key Features to Understand

### Multi-Language System
- 10 languages supported with flag icons
- Translations stored in `translations.js` with nested object structure
- Language preference persists in localStorage
- All UI elements automatically translated

### Authentication System
- Multiple sign-in options: Google OAuth, manual email/password, demo mode
- Demo mode provides instant admin access for testing
- Session management with localStorage persistence

### Admin Dashboard
- Comprehensive back-office interface in `admin.html`
- Features: user management, analytics, reports, system monitoring
- Access via user menu after admin login

### Payment Integration
- $19 per trip plan via Stripe Checkout
- Webhook handling for payment confirmation
- Referral system provides $5 discounts

## Debugging

### Enable Debug Mode
```javascript
localStorage.setItem('wayzo_debug', 'true');
```

### Common Issues
- Authentication problems: Clear browser cache and localStorage
- Language not switching: Check `translations.js` loading
- Admin panel access: Ensure admin user login via demo mode