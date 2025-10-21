# Wayzo Supabase + Fly.io + Resend Integration Plan

## 🔍 Current Status Analysis

### ✅ What's Already Working
1. **Fly.io Deployment**: Configured and ready (`fly.toml`, `Dockerfile`)
2. **Backend Server**: Express server running on port 8080
3. **Database**: SQLite with `better-sqlite3`
4. **Frontend**: Static HTML/CSS/JS with dashboard UI already built
5. **AI Generation**: OpenAI integration for trip planning

### ❌ What's Missing (CRITICAL)
1. **NO Supabase Integration**
   - Missing: `@supabase/supabase-js` package
   - Missing: `backend/lib/supabase.mjs`
   - Missing: `backend/lib/auth.mjs` (JWT middleware)
   - Missing: Environment variables for Supabase

2. **NO Resend Email Integration**
   - Missing: `resend` package
   - Missing: `backend/lib/email.mjs`
   - Missing: RESEND_API_KEY environment variable

3. **NO User Authentication Flow**
   - No Supabase auth in frontend
   - No JWT token handling
   - No protected routes

4. **NO Persistent User Plans**
   - No `/api/plans` (list user plans)
   - No `POST /api/plan` (create plan for authenticated user)
   - No `GET /api/plan/:id` (fetch single plan)
   - No `GET /api/plan/:id/pdf` (PDF with signed URL)

5. **NO Backoffice Page**
   - Missing: `frontend/backoffice.html` (user dashboard for saved plans)

---

## 📋 Complete Implementation Checklist

### Phase 1: Backend Dependencies & Configuration

#### 1.1 Install Required Packages
```bash
cd backend
npm install @supabase/supabase-js@^2.45.0 resend@^3.0.0
```

**Files to modify:**
- [backend/package.json](backend/package.json): Add dependencies

#### 1.2 Create Supabase Client Module
**New file:** `backend/lib/supabase.mjs`

```javascript
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
```

#### 1.3 Create Authentication Middleware
**New file:** `backend/lib/auth.mjs`

```javascript
import { supabasePublic } from './supabase.mjs';

export async function requireUser(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });

    const { data, error } = await supabasePublic.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });

    req.user = { id: data.user.id, email: data.user.email };
    next();
  } catch (e) {
    console.error('requireUser error', e);
    res.status(401).json({ error: 'Unauthorized' });
  }
}
```

#### 1.4 Create Email Helper
**New file:** `backend/lib/email.mjs`

```javascript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPlanReadyEmail(to, planUrl) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping email');
    return;
  }
  try {
    await resend.emails.send({
      from: 'Wayzo <hello@wayzo.online>',
      to,
      subject: '✨ Your Wayzo trip plan is ready!',
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;max-width:600px;margin:0 auto">
          <h2 style="color:#111">✨ Your Wayzo plan is ready</h2>
          <p style="font-size:16px;color:#333">Your personalized travel itinerary has been generated and is ready to view!</p>
          <p style="text-align:center;margin:30px 0">
            <a href="${planUrl}" style="display:inline-block;padding:14px 28px;border-radius:8px;background:#111;color:#fff;text-decoration:none;font-weight:600">Open My Plan</a>
          </p>
          <p style="color:#6b7280;font-size:12px;margin-top:40px">${planUrl}</p>
        </div>
      `,
    });
    console.log('Plan ready email sent to', to);
  } catch (e) {
    console.error('Resend email error:', e);
  }
}
```

#### 1.5 Update Environment Variables
**File to modify:** `backend/.env`

Add these variables:
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Resend Email
RESEND_API_KEY=re_your_resend_api_key

# Public URL for email links
PUBLIC_BASE_URL=https://wayzo.fly.dev
```

**Also set in Fly.io secrets:**
```bash
flyctl secrets set SUPABASE_URL="https://your-project.supabase.co" -a wayzo
flyctl secrets set SUPABASE_ANON_KEY="your_anon_key" -a wayzo
flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="your_service_role_key" -a wayzo
flyctl secrets set RESEND_API_KEY="re_your_key" -a wayzo
flyctl secrets set PUBLIC_BASE_URL="https://wayzo.fly.dev" -a wayzo
```

---

### Phase 2: Backend API Routes

#### 2.1 Import New Modules in server.mjs
**File to modify:** [backend/server.mjs](backend/server.mjs)

Add at top (around line 20):
```javascript
import { supabaseAdmin } from './lib/supabase.mjs';
import { requireUser } from './lib/auth.mjs';
import { sendPlanReadyEmail } from './lib/email.mjs';
```

#### 2.2 Add New API Routes
**File to modify:** [backend/server.mjs](backend/server.mjs)

Add these routes AFTER existing routes (around line 500+):

```javascript
// ========================================
// SUPABASE-AUTHENTICATED ROUTES
// ========================================

// List all plans for authenticated user
app.get('/api/plans', requireUser, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('plans')
      .select('id,title,destination,start_date,end_date,created_at,pdf_path,budget_low,budget_high')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('List plans error:', error);
      return res.status(500).json({ error: 'Failed to list plans' });
    }

    res.json(data || []);
  } catch (e) {
    console.error('GET /api/plans error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single plan for authenticated user
app.get('/api/plan/:id', requireUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) {
      console.error('Get plan error:', error);
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json(data);
  } catch (e) {
    console.error('GET /api/plan/:id error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get signed PDF URL for plan
app.get('/api/plan/:id/pdf', requireUser, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const { data: plan, error } = await supabaseAdmin
      .from('plans')
      .select('user_id,pdf_path')
      .eq('id', id)
      .single();

    if (error || !plan || plan.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (!plan.pdf_path) {
      return res.status(404).json({ error: 'PDF not generated yet' });
    }

    // Create signed URL (60 seconds expiry)
    const { data: signed, error: sErr } = await supabaseAdmin
      .storage.from('plans')
      .createSignedUrl(plan.pdf_path, 60);

    if (sErr) {
      console.error('PDF sign error:', sErr);
      return res.status(500).json({ error: 'Failed to generate PDF URL' });
    }

    res.json({ url: signed.signedUrl });
  } catch (e) {
    console.error('GET /api/plan/:id/pdf error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new plan (main generation endpoint)
app.post('/api/plan', requireUser, async (req, res) => {
  try {
    const { params, planJson, planHtml, meta } = req.body || {};

    // TODO: If params is provided but planJson/planHtml are not,
    // call your existing AI generation logic here
    // For now, we assume the frontend sends the complete data

    const insertPayload = {
      user_id: req.user.id,
      title: meta?.title || (params?.destination ? `Trip to ${params.destination}` : 'My Trip Plan'),
      destination: params?.destination || null,
      start_date: params?.startDate || null,
      end_date: params?.endDate || null,
      budget_low: meta?.budgetLow || params?.budgetMin || null,
      budget_high: meta?.budgetHigh || params?.budgetMax || null,
      travelers: params?.travelers || null,
      style: params?.style || null,
      params: params || null,
      content: planJson || null,
      html: planHtml || null,
      created_at: new Date().toISOString()
    };

    const { data: row, error } = await supabaseAdmin
      .from('plans')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      console.error('Insert plan error:', error);
      return res.status(500).json({ error: 'Failed to create plan' });
    }

    // Send email notification
    const planUrl = `${process.env.PUBLIC_BASE_URL || 'https://wayzo.fly.dev'}/backoffice.html#plan=${row.id}`;
    await sendPlanReadyEmail(req.user.email, planUrl);

    console.log(`Plan ${row.id} created for user ${req.user.id}`);
    res.json({ ok: true, id: row.id });
  } catch (e) {
    console.error('POST /api/plan error:', e);
    res.status(500).json({ error: 'Failed to create plan' });
  }
});
```

#### 2.3 Update Server Listen Configuration
**File to modify:** [backend/server.mjs](backend/server.mjs)

Find the server listen section and ensure it binds to `0.0.0.0`:

```javascript
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Wayzo server ${VERSION} running on http://0.0.0.0:${PORT}`);
  console.log(`📁 Serving frontend from: ${FRONTEND}`);
  console.log(`🗄️  Database: ${DB_PATH}`);
});
```

---

### Phase 3: Supabase Database Setup

#### 3.1 Create Plans Table

Run this SQL in Supabase SQL Editor:

```sql
-- Create plans table
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  budget_low NUMERIC,
  budget_high NUMERIC,
  travelers INTEGER,
  style TEXT,
  params JSONB,
  content JSONB,
  html TEXT,
  pdf_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for user queries
CREATE INDEX idx_plans_user_id ON plans(user_id);
CREATE INDEX idx_plans_created_at ON plans(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own plans
CREATE POLICY "Users can view own plans"
  ON plans FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own plans
CREATE POLICY "Users can insert own plans"
  ON plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own plans
CREATE POLICY "Users can update own plans"
  ON plans FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own plans
CREATE POLICY "Users can delete own plans"
  ON plans FOR DELETE
  USING (auth.uid() = user_id);
```

#### 3.2 Create Storage Bucket for PDFs

1. Go to Supabase Dashboard → Storage
2. Create new bucket: `plans`
3. Set as **Public** or create signed URL policy
4. Add RLS policy:

```sql
-- Storage policy: Users can upload PDFs for their own plans
CREATE POLICY "Users can upload own plan PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'plans'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policy: Users can view own PDFs
CREATE POLICY "Users can view own plan PDFs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'plans'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

### Phase 4: Frontend Backoffice Page

#### 4.1 Create Backoffice HTML
**New file:** `frontend/backoffice.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Plans - Wayzo</title>
  <link rel="stylesheet" href="/frontend/style.css">
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <style>
    body { font-family: Inter, system-ui, sans-serif; background: #f9fafb; margin: 0; padding: 0; }
    .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
    .header h1 { margin: 0; font-size: 32px; font-weight: 700; }
    .btn { padding: 12px 24px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; }
    .btn-primary { background: #111; color: #fff; }
    .btn-ghost { background: transparent; color: #111; border: 1px solid #e5e7eb; }
    .auth-section { text-align: center; padding: 80px 20px; }
    .plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
    .plan-card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .plan-card h3 { margin: 0 0 12px 0; font-size: 20px; }
    .plan-meta { color: #6b7280; font-size: 14px; margin-bottom: 8px; }
    .plan-actions { display: flex; gap: 8px; margin-top: 16px; }
    .empty-state { text-align: center; padding: 80px 20px; color: #6b7280; }
    .empty-state h2 { font-size: 24px; margin-bottom: 12px; }
    .loading { text-align: center; padding: 80px 20px; }
  </style>
</head>
<body>
  <div id="authSection" class="auth-section" style="display:none">
    <h2>Sign in to view your plans</h2>
    <p style="color:#6b7280;margin:16px 0">Use your email to sign in and access your saved trip plans</p>
    <div style="max-width:400px;margin:32px auto">
      <input type="email" id="emailInput" placeholder="your@email.com" style="width:100%;padding:12px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:12px;font-size:16px">
      <button class="btn btn-primary" onclick="signInWithEmail()" style="width:100%">Sign In with Email</button>
    </div>
  </div>

  <div id="mainSection" style="display:none">
    <div class="container">
      <div class="header">
        <div>
          <h1>My Trip Plans</h1>
          <p style="color:#6b7280;margin:8px 0 0 0" id="userEmail"></p>
        </div>
        <div style="display:flex;gap:12px">
          <button class="btn btn-primary" onclick="createNewPlan()">+ Create New Plan</button>
          <button class="btn btn-ghost" onclick="signOut()">Sign Out</button>
        </div>
      </div>

      <div id="plansContainer">
        <div class="loading">
          <p>Loading your plans...</p>
        </div>
      </div>
    </div>
  </div>

  <script>
    const SUPABASE_URL = 'https://your-project.supabase.co';
    const SUPABASE_ANON_KEY = 'your_anon_key_here';
    const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let currentUser = null;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        currentUser = session.user;
        showMainSection();
        loadPlans();
      } else {
        showAuthSection();
      }

      // Handle auth state changes
      supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          currentUser = session.user;
          showMainSection();
          loadPlans();
        } else {
          currentUser = null;
          showAuthSection();
        }
      });

      // Handle deep link to specific plan
      const hash = window.location.hash;
      if (hash.startsWith('#plan=')) {
        const planId = hash.slice(6);
        if (currentUser) loadSinglePlan(planId);
      }
    }

    function showAuthSection() {
      document.getElementById('authSection').style.display = 'block';
      document.getElementById('mainSection').style.display = 'none';
    }

    function showMainSection() {
      document.getElementById('authSection').style.display = 'none';
      document.getElementById('mainSection').style.display = 'block';
      document.getElementById('userEmail').textContent = currentUser.email;
    }

    async function signInWithEmail() {
      const email = document.getElementById('emailInput').value.trim();
      if (!email) return alert('Please enter your email');

      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        alert('Error: ' + error.message);
      } else {
        alert('Check your email for the magic link!');
      }
    }

    async function signOut() {
      await supabase.auth.signOut();
      window.location.reload();
    }

    async function loadPlans() {
      const container = document.getElementById('plansContainer');
      container.innerHTML = '<div class="loading"><p>Loading your plans...</p></div>';

      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        const resp = await fetch('/api/plans', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!resp.ok) throw new Error('Failed to load plans');

        const plans = await resp.json();

        if (plans.length === 0) {
          container.innerHTML = `
            <div class="empty-state">
              <h2>No plans yet</h2>
              <p>Create your first trip plan to get started!</p>
              <button class="btn btn-primary" onclick="createNewPlan()" style="margin-top:20px">Create New Plan</button>
            </div>
          `;
          return;
        }

        container.innerHTML = `<div class="plans-grid">${plans.map(plan => `
          <div class="plan-card">
            <h3>${plan.title || 'Untitled Plan'}</h3>
            ${plan.destination ? `<div class="plan-meta">📍 ${plan.destination}</div>` : ''}
            ${plan.start_date ? `<div class="plan-meta">📅 ${plan.start_date} → ${plan.end_date || '?'}</div>` : ''}
            ${plan.budget_low ? `<div class="plan-meta">💰 $${plan.budget_low} - $${plan.budget_high || '?'}</div>` : ''}
            <div class="plan-meta" style="margin-top:12px;color:#9ca3af">Created ${new Date(plan.created_at).toLocaleDateString()}</div>
            <div class="plan-actions">
              <button class="btn btn-primary" onclick="viewPlan('${plan.id}')">View Plan</button>
              ${plan.pdf_path ? `<button class="btn btn-ghost" onclick="downloadPDF('${plan.id}')">Download PDF</button>` : ''}
            </div>
          </div>
        `).join('')}</div>`;
      } catch (e) {
        console.error('Load plans error:', e);
        container.innerHTML = `<div class="empty-state"><h2>Error loading plans</h2><p>${e.message}</p></div>`;
      }
    }

    async function viewPlan(id) {
      window.location.hash = `plan=${id}`;
      loadSinglePlan(id);
    }

    async function loadSinglePlan(id) {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const resp = await fetch(`/api/plan/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!resp.ok) {
        alert('Failed to load plan');
        return;
      }

      const plan = await resp.json();

      // Display plan (replace with your actual plan viewer)
      document.getElementById('plansContainer').innerHTML = `
        <div style="background:white;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
          <button class="btn btn-ghost" onclick="loadPlans();window.location.hash=''">← Back to Plans</button>
          <h2 style="margin:24px 0">${plan.title || 'Untitled Plan'}</h2>
          ${plan.html || '<p>Plan content not available</p>'}
        </div>
      `;
    }

    async function downloadPDF(id) {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const resp = await fetch(`/api/plan/${id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!resp.ok) {
        alert('PDF not available');
        return;
      }

      const { url } = await resp.json();
      window.open(url, '_blank');
    }

    function createNewPlan() {
      window.location.href = '/';
    }

    // Initialize on load
    init();
  </script>
</body>
</html>
```

**IMPORTANT:** Replace `SUPABASE_URL` and `SUPABASE_ANON_KEY` with actual values!

---

### Phase 5: Frontend Integration in Main App

#### 5.1 Add Supabase to Main HTML
**File to modify:** `frontend/index.backend.html`

Add before closing `</head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

#### 5.2 Initialize Supabase Client in app.js
**File to modify:** `frontend/app.js`

Add at top of file:
```javascript
// Initialize Supabase
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your_anon_key_here';
const supabaseClient = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY);
```

#### 5.3 Protect "Generate Plan" Button
**File to modify:** `frontend/app.js`

Find the "Generate Full Plan" button handler and modify:

```javascript
// Example: When user clicks "Generate Plan"
async function generateFullPlan() {
  // Check authentication
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    alert('Please sign in to generate a plan');
    window.location.href = '/backoffice.html';
    return;
  }

  // Collect form data
  const params = {
    destination: document.getElementById('destination').value,
    startDate: document.getElementById('startDate').value,
    endDate: document.getElementById('endDate').value,
    travelers: document.getElementById('travelers').value,
    style: document.getElementById('style').value,
    budgetMin: document.getElementById('budgetMin').value,
    budgetMax: document.getElementById('budgetMax').value,
  };

  // TODO: Generate plan using your existing logic
  // const { planJson, planHtml, meta } = await yourGenerationFunction(params);

  // For now, send params to backend (backend will generate or store)
  const token = (await supabaseClient.auth.getSession()).data.session?.access_token;

  const resp = await fetch('/api/plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ params })
  });

  const data = await resp.json();

  if (!resp.ok) {
    alert('Failed to create plan: ' + (data?.error || 'unknown'));
    return;
  }

  // Redirect to backoffice to view plan
  window.location.href = `/backoffice.html#plan=${data.id}`;
}
```

---

### Phase 6: Deployment & Testing

#### 6.1 Set Fly.io Secrets
```bash
flyctl secrets set SUPABASE_URL="https://your-project.supabase.co" -a wayzo
flyctl secrets set SUPABASE_ANON_KEY="your_anon_key" -a wayzo
flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="your_service_role_key" -a wayzo
flyctl secrets set RESEND_API_KEY="re_your_key" -a wayzo
flyctl secrets set PUBLIC_BASE_URL="https://wayzo.fly.dev" -a wayzo
```

#### 6.2 Deploy to Fly.io
```bash
flyctl deploy -a wayzo --remote-only --no-cache
```

#### 6.3 Monitor Logs
```bash
flyctl logs -a wayzo -f
```

#### 6.4 Test Authentication Flow

1. **Sign Up/In**: Go to `https://wayzo.fly.dev/backoffice.html`
   - Enter email
   - Check email for magic link
   - Click link to authenticate

2. **Create Plan**: Go to `https://wayzo.fly.dev/`
   - Fill out trip form
   - Click "Generate Plan"
   - Should redirect to backoffice after creation

3. **View Plans**: Go to `https://wayzo.fly.dev/backoffice.html`
   - Should see list of all your plans
   - Click "View Plan" to see details

4. **Email Notification**: Check email for "Plan Ready" notification

#### 6.5 Test API with curl

```bash
# 1. Get access token from browser console
# In backoffice.html, open console and run:
# (await supabase.auth.getSession()).data.session.access_token

# 2. Test create plan
curl -X POST https://wayzo.fly.dev/api/plan \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "destination": "Tyrol, Austria",
      "startDate": "2025-10-09",
      "endDate": "2025-10-23",
      "style": "budget"
    }
  }'

# Expected: {"ok":true,"id":"uuid-here"}

# 3. Test list plans
curl https://wayzo.fly.dev/api/plans \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Expected: [{"id":"...","title":"...","destination":"...", ...}]

# 4. Test get single plan
curl https://wayzo.fly.dev/api/plan/UUID_HERE \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Expected: {"id":"...","title":"...","html":"...", ...}
```

---

## 🎯 Summary of Changes

### New Files Created (8 files)
1. `backend/lib/supabase.mjs` - Supabase clients
2. `backend/lib/auth.mjs` - JWT authentication middleware
3. `backend/lib/email.mjs` - Resend email helper
4. `frontend/backoffice.html` - User dashboard for plans

### Files Modified (4 files)
1. `backend/package.json` - Add dependencies
2. `backend/.env` - Add Supabase/Resend env vars
3. `backend/server.mjs` - Add 4 new API routes
4. `frontend/app.js` - Add Supabase auth + protect generate button
5. `frontend/index.backend.html` - Add Supabase CDN script

### Environment Variables Required (5 new)
1. `SUPABASE_URL`
2. `SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `RESEND_API_KEY`
5. `PUBLIC_BASE_URL`

### Database Changes (Supabase)
1. Create `plans` table with RLS policies
2. Create `plans` storage bucket for PDFs

---

## 🚀 Next Steps After Implementation

### 1. Integrate AI Generation in Backend
Currently, `POST /api/plan` accepts pre-generated plan data. You should:
- Move your AI generation logic into the backend route
- Generate `planJson` and `planHtml` server-side
- This will make the flow more secure and consistent

### 2. Add PDF Generation
- Use Puppeteer to generate PDF from `planHtml`
- Upload to Supabase Storage at `plans/{user_id}/{plan_id}.pdf`
- Update `pdf_path` column in database

### 3. Enhance Backoffice UI
- Add filters (by date, destination)
- Add search functionality
- Add plan editing/deletion
- Add export options (Calendar, Print)

### 4. Add Payment Integration
- Gate plan generation behind Stripe payment
- Store payment status in database
- Only send email after successful payment

### 5. Add Analytics
- Track plan creation events
- Monitor user engagement
- Track email open rates (Resend analytics)

---

## 🐛 Troubleshooting

### Problem: 401 Unauthorized
**Solution:**
- Check that `Authorization: Bearer TOKEN` header is sent
- Verify token is valid: `(await supabase.auth.getSession()).data.session?.access_token`
- Check Supabase keys are correct

### Problem: Insert failed
**Solution:**
- Check Supabase SQL logs for RLS policy violations
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set (bypasses RLS)
- Check database schema matches insert payload

### Problem: Email not sent
**Solution:**
- Verify `RESEND_API_KEY` is set
- Check Resend dashboard for delivery status
- Verify sending domain is verified in Resend

### Problem: Plans not showing in backoffice
**Solution:**
- Open browser console for errors
- Check network tab for failed API calls
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in HTML

---

## 📚 Resources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Resend Docs](https://resend.com/docs)
- [Fly.io Docs](https://fly.io/docs)

---

**Status:** ⚠️ **NOT IMPLEMENTED** - This is a planning document. Follow the checklist above to implement each phase.
