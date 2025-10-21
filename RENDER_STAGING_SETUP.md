# Render Staging Environment Setup Guide

## Overview
This guide will help you deploy a **FREE staging environment** on Render.com for testing before deploying to production (wayzo.online on Fly.io).

## Why Staging + Production?

- **Staging (Render - FREE)**: Test all changes here first
  - URL: `wayzo-staging.onrender.com` (auto-generated)
  - Free tier (spins down after inactivity, boots up on request)
  - Perfect for development and testing

- **Production (Fly.io - PAID)**: Deploy only approved code
  - URL: `wayzo.online` (your custom domain)
  - 24/7 uptime with 2 machines in Amsterdam
  - Only deploy after testing in staging

---

## Step 1: Create Render Account & Deploy

### 1.1 Sign up for Render (if you haven't)
- Go to https://render.com/
- Sign up with GitHub account (easiest method)
- Verify your email

### 1.2 Create New Web Service
1. Click "New +" → "Web Service"
2. **Connect your GitHub repository**: `FXCOOP/wayzo`
3. **Configure the service:**
   - **Name**: `wayzo-staging`
   - **Branch**: `fix-links-v68` (or your dev branch)
   - **Root Directory**: Leave empty
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `node backend/server.mjs`
   - **Plan**: **Free** (important!)

4. Click "Advanced" and add environment variables:

```bash
NODE_ENV=staging
PORT=10000
SUPABASE_URL=https://khrxfjekfzcvyjlzryyz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocnhmamVrZnpjdnlqbHpyeXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NzA3ODEsImV4cCI6MjA3NTQ0Njc4MX0.Uc4Nd9Wxt1TZNoq_nto0vYCdPAG1tI8alhx8ENSv8HA
```

5. **Add SECRET environment variables** (click "Add Secret File" or use Environment tab):

   Get these from your Supabase dashboard:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=[your service role key from Supabase → Settings → API]
   RESEND_API_KEY=[your Resend API key from resend.com dashboard]
   ```

6. Click **"Create Web Service"**

7. Wait for deployment (first deploy takes 2-3 minutes)

---

## Step 2: Get Your Staging URL

After deployment completes, Render will give you a URL like:
```
https://wayzo-staging.onrender.com
```

**Copy this URL** - you'll need it for the next steps.

---

## Step 3: Update PUBLIC_BASE_URL

1. In Render dashboard → Your service → Environment
2. Add one more variable:
   ```
   PUBLIC_BASE_URL=https://wayzo-staging.onrender.com
   ```
   (Replace with your actual URL from Step 2)

3. Save changes - Render will auto-redeploy

---

## Step 4: Test Your Staging Environment

### 4.1 Test Main App
Open: `https://wayzo-staging.onrender.com`

You should see the Wayzo homepage. Test:
- Language switcher
- Form submission
- All pages load correctly

### 4.2 Test Dashboard
Open: `https://wayzo-staging.onrender.com/dashboard`

You should see:
- **Clean sign-in page** (not fake Paris/Tokyo/Bali data)
- "Sign In with Email" button
- Modern purple gradient design

### 4.3 Test Authentication Flow
1. Click "Sign In with Email"
2. Enter your email: `dimahasin2@gmail.com`
3. Check your inbox for email from Supabase
4. Click the "Confirm your mail" link
5. You should be redirected back to dashboard, now signed in
6. Dashboard should show "No plans yet" (empty state)

---

## Step 5: Fix the Issues You Reported

Now that staging is deployed, we need to fix:

### Issue 1: Dashboard Shows Old Fake Data
**Problem**: Browser is caching old dashboard.html
**Solution**: Force cache clear on deployment

Add this to `frontend/dashboard.html` (line 7):
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```

### Issue 2: Email Looks Generic (No Wayzo Branding)
**Problem**: You're receiving Supabase's default signup confirmation email
**What you should see**: Custom Wayzo-branded "Plan Ready" email

The issue is that the Wayzo branded email (in `backend/lib/email.mjs`) is only sent when a plan is created via `POST /api/user/plan`. The signup confirmation email comes from Supabase itself.

**Two solutions:**

**Option A: Customize Supabase Email Templates**
1. Go to Supabase dashboard → Authentication → Email Templates
2. Edit the "Confirm signup" template
3. Add Wayzo branding (logo, colors, text)
4. Change redirect URL to your dashboard

**Option B: Use Magic Link Login Instead of Signup**
Change the auth flow to use `signInWithOtp` which sends a cleaner "magic link" email instead of signup confirmation.

### Issue 3: Auth Redirects to wayzo.online Instead of Staging
**Problem**: Supabase redirects to production URL after auth
**Solution**: Configure redirect URLs in Supabase

1. Go to Supabase dashboard → Authentication → URL Configuration
2. Add your staging URL to "Redirect URLs":
   ```
   https://wayzo-staging.onrender.com/dashboard
   https://wayzo-staging.onrender.com/dashboard.html
   https://wayzo.online/dashboard
   https://wayzo.online/dashboard.html
   ```
3. Save changes

---

## Step 6: Development Workflow

### Making Changes
1. **Work on your dev branch** (e.g., `fix-links-v68`)
2. **Make changes locally**
3. **Commit and push to GitHub**:
   ```bash
   git add .
   git commit -m "Fix: Description of your fix"
   git push origin fix-links-v68
   ```
4. **Render auto-deploys** from your branch (usually takes 1-2 minutes)
5. **Test on staging**: `https://wayzo-staging.onrender.com`
6. **If everything works**, merge to `main` and deploy to production

### Deploying to Production (Fly.io)
Only after you approve staging:

```bash
# Switch to main branch
git checkout main

# Merge your approved changes
git merge fix-links-v68

# Push to GitHub
git push origin main

# Deploy to production
flyctl deploy --app wayzo --config fly.toml
```

---

## Step 7: Monitor Staging

### View Logs
1. Render dashboard → Your service → Logs
2. Watch real-time deployment and runtime logs
3. Debug any errors here

### Check Health
Render dashboard shows:
- **Status**: Running / Deploying / Failed
- **Last deployment**: Timestamp
- **Auto-deploy**: Enabled (deploys on every push to your branch)

---

## Free Tier Limitations

**Render Free Tier:**
- ✅ 750 hours/month free (enough for 24/7 with one service)
- ✅ Automatic SSL (HTTPS)
- ✅ Auto-deploy from GitHub
- ⚠️ **Spins down after 15 min of inactivity**
- ⚠️ **Cold start takes 30-60 seconds** when waking up
- ⚠️ 512 MB RAM limit

**When it spins down:**
- First request wakes it up (30-60 sec wait)
- Subsequent requests are instant
- Perfect for staging/testing

**For production:** Keep using Fly.io (24/7 uptime, no cold starts)

---

## Troubleshooting

### Deployment Fails
**Error**: `npm install` fails
**Solution**: Check Render logs, usually missing dependencies. Make sure `backend/package.json` is correct.

### Dashboard Still Shows Fake Data
**Solution**:
1. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. Clear browser cache
3. Open in incognito/private mode
4. Check if correct dashboard.html is deployed (642 lines, has Supabase code)

### Supabase Auth Not Working
**Check**:
1. SUPABASE_ANON_KEY is correct in Render environment variables
2. SUPABASE_URL matches your project
3. Redirect URLs are configured in Supabase dashboard

### Service Sleeps Too Often
**Upgrade to paid tier** ($7/month) for:
- No sleep
- Faster builds
- More RAM

---

## Next Steps

Once staging is working perfectly:

1. ✅ Test all features in staging
2. ✅ Fix dashboard caching issue
3. ✅ Configure Supabase redirect URLs
4. ✅ Customize Supabase email templates (optional)
5. ✅ Test complete user journey (signup → auth → dashboard → create plan)
6. ✅ Get your approval
7. ✅ Merge to `main` branch
8. ✅ Deploy to production (Fly.io / wayzo.online)

---

## Commands Reference

```bash
# View Render logs
# (Use Render dashboard - no CLI needed)

# Deploy to staging
git push origin fix-links-v68  # Render auto-deploys

# Deploy to production (Fly.io)
git checkout main
git merge fix-links-v68
git push origin main
flyctl deploy --app wayzo

# Check production status
flyctl status --app wayzo
flyctl logs --app wayzo
```

---

## Summary

✅ **Staging (Render)**: `wayzo-staging.onrender.com` - FREE for testing
✅ **Production (Fly.io)**: `wayzo.online` - PAID for 24/7 live app
✅ **Workflow**: Develop → Push to GitHub → Test in Staging → Approve → Deploy to Production

This setup gives you:
- Safe testing environment (free)
- No risk to production
- Clear separation of dev/prod
- Automated deployments
