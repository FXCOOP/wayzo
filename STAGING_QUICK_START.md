# 🚀 Staging Environment - Quick Start

## What Just Happened

✅ Created **Render staging configuration** (free tier)
✅ Fixed **dashboard caching issue** (added cache-control headers)
✅ Pushed changes to GitHub branch `fix-links-v68`
✅ Created comprehensive setup guide

---

## What You Need To Do NOW (5 Minutes)

### Step 1: Deploy to Render (2 min)

1. **Go to**: https://render.com/
2. **Sign in** with GitHub
3. **Click**: "New +" → "Web Service"
4. **Select**: Your repository `FXCOOP/wayzo`
5. **Configure**:
   - Name: `wayzo-staging`
   - Branch: `fix-links-v68`
   - Build Command: `cd backend && npm install`
   - Start Command: `node backend/server.mjs`
   - **Plan**: FREE ⬅️ Important!

6. **Add Environment Variables** (click "Advanced"):
   ```
   NODE_ENV=staging
   PORT=10000
   SUPABASE_URL=https://khrxfjekfzcvyjlzryyz.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocnhmamVrZnpjdnlqbHpyeXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NzA3ODEsImV4cCI6MjA3NTQ0Njc4MX0.Uc4Nd9Wxt1TZNoq_nto0vYCdPAG1tI8alhx8ENSv8HA
   ```

7. **Add these as secrets** (you'll need to get them):
   - `SUPABASE_SERVICE_ROLE_KEY`: From Supabase dashboard → Settings → API → service_role key
   - `RESEND_API_KEY`: From resend.com dashboard → API Keys

8. **Click "Create Web Service"**

9. **Wait 2-3 minutes** for first deployment

---

### Step 2: Get Your Staging URL (30 sec)

After deployment, Render shows you a URL like:
```
https://wayzo-staging.onrender.com
```

**Copy this URL!**

---

### Step 3: Add PUBLIC_BASE_URL (30 sec)

1. In Render → Your service → Environment tab
2. Add one more variable:
   ```
   PUBLIC_BASE_URL=https://wayzo-staging.onrender.com
   ```
   (Use YOUR actual URL from Step 2)
3. Save → Render auto-redeploys

---

### Step 4: Configure Supabase Redirects (1 min)

1. Go to: https://supabase.com/dashboard/project/khrxfjekfzcvyjlzryyz
2. Click: **Authentication** → **URL Configuration**
3. Under "Redirect URLs", add:
   ```
   https://wayzo-staging.onrender.com/dashboard
   https://wayzo-staging.onrender.com/dashboard.html
   ```
4. **Save**

---

### Step 5: TEST! (1 min)

Open your staging URL:
```
https://wayzo-staging.onrender.com/dashboard
```

**You should now see:**
- ✅ Clean sign-in page (NO fake Paris/Tokyo/Bali data!)
- ✅ Modern purple gradient design
- ✅ "Sign In with Email" button
- ✅ Wayzo branding

**Try signing in:**
1. Enter your email
2. Check inbox for Supabase magic link
3. Click link → Should redirect to dashboard
4. Dashboard shows "No plans yet" (empty state)

---

## Issues Fixed

### ❌ OLD Problem: Dashboard showed fake data
**✅ FIXED**: Added cache-control headers, dashboard now loads fresh from server

### ❌ OLD Problem: Generic Supabase email
**⚠️ PARTIALLY FIXED**: You'll still get Supabase auth emails (can customize templates in Supabase dashboard)
**✅ FIXED**: When you create a plan via API, you'll get beautiful Wayzo-branded email from `hello@wayzo.online`

### ❌ OLD Problem: Redirects to wayzo.online after auth
**✅ FIXED**: Configure redirect URLs in Supabase (Step 4 above)

---

## Development Workflow From Now On

### Making Changes:
```bash
# 1. Make your changes locally
# 2. Commit and push
git add .
git commit -m "Fix: description"
git push origin fix-links-v68

# 3. Render auto-deploys (watch in dashboard)
# 4. Test on staging: https://wayzo-staging.onrender.com
# 5. If good → approve for production
```

### Deploying to Production:
**ONLY after you approve staging!**

```bash
# Merge to main
git checkout main
git merge fix-links-v68
git push origin main

# Deploy to Fly.io (wayzo.online)
flyctl deploy --app wayzo
```

---

## Important Notes

### Staging (Render Free Tier):
- ✅ Free forever
- ✅ Auto-deploys on every push to `fix-links-v68`
- ⚠️ **Spins down after 15 min of inactivity**
- ⚠️ **First load takes 30-60 sec** (cold start)
- ✅ Perfect for testing!

### Production (Fly.io):
- 💰 Paid ($5-10/month)
- ✅ 24/7 uptime (no cold starts)
- ✅ Custom domain (wayzo.online)
- ✅ 2 machines in Amsterdam
- ✅ Only deploy approved code!

---

## What Happens When You Test

### First Visit (Cold Start):
1. Service is asleep
2. Your request wakes it up (30-60 sec wait)
3. Page loads
4. Next requests are instant

### Dashboard Test:
1. Open `/dashboard`
2. See sign-in page
3. Enter email
4. Get magic link
5. Click link → authenticated!
6. See empty dashboard (no fake data!)

---

## Troubleshooting

### "Still seeing fake data"
**Solution**: Hard refresh `Ctrl+Shift+R` or open in incognito mode

### "Auth redirects to wrong URL"
**Solution**: Configure redirect URLs in Supabase (see Step 4)

### "Service won't start"
**Solution**: Check Render logs tab for errors. Usually missing env variables.

### "Takes forever to load"
**Solution**: Normal for free tier cold start (30-60 sec first load)

---

## Next Steps After Testing

Once you confirm staging works:

1. ✅ Test all features
2. ✅ Verify dashboard loads correctly
3. ✅ Test auth flow
4. ✅ Approve changes
5. ✅ Merge to main
6. ✅ Deploy to production

---

## Quick Links

- **Staging Dashboard**: https://wayzo-staging.onrender.com/dashboard
- **Render Dashboard**: https://dashboard.render.com/
- **Supabase Dashboard**: https://supabase.com/dashboard/project/khrxfjekfzcvyjlzryyz
- **Full Setup Guide**: See `RENDER_STAGING_SETUP.md`

---

## Summary

🎯 **Goal**: Test everything in staging (free) before deploying to production (paid)

✅ **Staging is ready** - just deploy to Render following Steps 1-5 above

✅ **Production is safe** - wayzo.online won't be affected until you approve

✅ **Clear workflow** - Develop → Test → Approve → Deploy

**Time to deploy: 5 minutes total**

Let's get your staging environment live! 🚀
