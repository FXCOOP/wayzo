# 🚀 Deploy Wayzo to Fly.io with Supabase

## ✅ Current Status

You're currently on **Render**, but your Fly.io app `wayzo` is configured and has all secrets set.

---

## 🎯 Step-by-Step Deployment

### Step 1: Update Supabase Credentials in Frontend

Before deploying, update `frontend/backoffice.html` (lines 381-382):

```javascript
// REPLACE:
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

// WITH:
const SUPABASE_URL = 'https://khrxfiekfzcvyjlzryvz.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_FROM_DASHBOARD';
```

**Get your anon key from:**
https://supabase.com/dashboard/project/khrxfiekfzcvyjlzryvz/settings/api

Copy the `anon` `public` key (NOT service_role!)

---

### Step 2: Verify Fly.io Secrets

Check that all secrets are set:

```bash
flyctl secrets list -a wayzo
```

You should see (you already have these):
```
SUPABASE_URL                    ✓
SUPABASE_ANON_KEY               ✓
SUPABASE_SERVICE_ROLE_KEY       ✓
RESEND_API_KEY                  ✓
PUBLIC_BASE_URL                 ✓
```

**If PUBLIC_BASE_URL is not `https://wayzo.online`, update it:**
```bash
flyctl secrets set PUBLIC_BASE_URL="https://wayzo.online" -a wayzo
```

---

### Step 3: Install Dependencies Locally (Optional Test)

```bash
cd backend
npm install
```

This installs the new packages:
- `@supabase/supabase-js`
- `resend`

---

### Step 4: Deploy to Fly.io

From your project root:

```bash
flyctl deploy -a wayzo --remote-only --no-cache
```

**What happens:**
1. Builds Docker image on Fly.io servers
2. Installs backend dependencies (including new Supabase + Resend)
3. Copies all files (including new backoffice.html)
4. Starts server on port 8080
5. Makes it live at your domains

**Expected output:**
```
==> Building image
==> Pushing image to fly
==> Deploying
 1 desired, 1 placed, 1 healthy, 0 unhealthy
--> v68 deployed successfully
```

---

### Step 5: Monitor Deployment

Watch logs in real-time:

```bash
flyctl logs -a wayzo -f
```

**Look for:**
```
✅ Supabase clients initialized
✅ Wayzo server staging-v65 running on http://0.0.0.0:8080
```

**Press Ctrl+C to stop watching logs**

---

### Step 6: Configure Domain (wayzo.online)

#### If wayzo.online is NOT yet pointed to Fly.io:

```bash
# Add certificate for wayzo.online
flyctl certs add wayzo.online -a wayzo

# Get the IP addresses to point your DNS
flyctl ips list -a wayzo
```

Then update your DNS:
```
A     @       <IPv4 from command>
AAAA  @       <IPv6 from command>
```

#### If wayzo.online is already configured:
Skip this - it should work automatically!

---

### Step 7: Test Your Deployment

#### 7.1 Test Main Site
```
https://wayzo.online
```
Should load homepage ✓

#### 7.2 Test Backoffice
```
https://wayzo.online/backoffice.html
```
Should show sign-in page ✓

#### 7.3 Test Sign-In Flow
1. Click "Sign In with Magic Link"
2. Enter your email
3. Check inbox
4. Click magic link
5. Should redirect back and show "My Trip Plans" dashboard ✓

#### 7.4 Test API Health
```
https://wayzo.online/health
```
Should return: `{ "status": "ok", "version": "staging-v65" }` ✓

---

## 🔧 Troubleshooting

### Issue: App not starting

**Check logs:**
```bash
flyctl logs -a wayzo
```

**Common issues:**
- Missing dependencies → Redeploy with `--no-cache`
- Environment variables → Check `flyctl secrets list -a wayzo`
- Port mismatch → Should be 8080 (already correct)

### Issue: Supabase connection error

**Check:**
1. Secrets are set: `flyctl secrets list -a wayzo`
2. Credentials are correct in Supabase dashboard
3. Supabase project is active

**Fix:**
```bash
flyctl secrets set SUPABASE_URL="https://khrxfiekfzcvyjlzryvz.supabase.co" -a wayzo
flyctl secrets set SUPABASE_ANON_KEY="your_key" -a wayzo
flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="your_key" -a wayzo
```

### Issue: Domain not working

**Check DNS:**
```bash
nslookup wayzo.online
```

Should point to Fly.io IPs.

**Check certificate:**
```bash
flyctl certs show wayzo.online -a wayzo
```

Status should be "Ready"

---

## 📊 What Gets Deployed

### New Files:
- ✅ `backend/lib/supabase.mjs`
- ✅ `backend/lib/auth.mjs`
- ✅ `backend/lib/email.mjs`
- ✅ `frontend/backoffice.html`

### Modified Files:
- ✅ `backend/package.json` (added dependencies)
- ✅ `backend/server.mjs` (added 4 new routes)
- ✅ `frontend/index.backend.html` (added "My Plans" link)

### New Features:
- ✅ User authentication via Supabase
- ✅ Persistent plan storage
- ✅ Email notifications via Resend
- ✅ Client dashboard at `/backoffice.html`
- ✅ 4 authenticated API endpoints

---

## 🎉 After Deployment

### What Works:

1. **Homepage:** https://wayzo.online ✓
2. **"My Plans" Link:** In header ✓
3. **Backoffice:** https://wayzo.online/backoffice.html ✓
4. **Sign-In:** Magic link authentication ✓
5. **Dashboard:** View saved plans ✓

### What Still Needs Integration:

**Current:** Plan generation uses old flow (SQLite, no auth)
**To integrate:** Choose Option A, B, or C from QUICK_SUMMARY.md

---

## 🚦 Quick Commands Reference

```bash
# Deploy
flyctl deploy -a wayzo --remote-only --no-cache

# Watch logs
flyctl logs -a wayzo -f

# Check secrets
flyctl secrets list -a wayzo

# Set secret
flyctl secrets set KEY=VALUE -a wayzo

# Check app status
flyctl status -a wayzo

# Open in browser
flyctl open -a wayzo

# SSH into machine (debugging)
flyctl ssh console -a wayzo
```

---

## 📞 Next Steps After Deployment

1. ✅ Deploy to Fly.io (run the command above)
2. ✅ Test wayzo.online loads
3. ✅ Test backoffice sign-in
4. ⏳ Choose integration option (A, B, or C)
5. ⏳ I'll implement the integration
6. ✅ Full end-to-end test

---

## 🎯 Ready to Deploy?

Just run:

```bash
flyctl deploy -a wayzo --remote-only --no-cache
```

Then watch it go live! 🚀

**Deployment time:** ~3-5 minutes

After deployment, tell me which integration option you want (A, B, or C from QUICK_SUMMARY.md) and I'll finish it!
