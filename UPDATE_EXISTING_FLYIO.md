# 🔄 Update Your Existing Fly.io Deployment

## ✅ Good News: Your App is Already Live on Fly.io!

The message you saw means Wayzo is **already running** on Fly.io.

Now we just need to **UPDATE** it with the new Supabase integration.

---

## 🚀 Quick Update Steps

### Step 1: Update Supabase Credentials in Frontend

Edit `frontend/backoffice.html` (lines 381-382):

```javascript
const SUPABASE_URL = 'https://khrxfiekfzcvyjlzryvz.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';  // Get from Supabase dashboard
```

**Get your anon key:**
1. Go to: https://supabase.com/dashboard/project/khrxfiekfzcvyjlzryvz/settings/api
2. Copy the **"anon public"** key
3. Paste it in backoffice.html

---

### Step 2: Redeploy with New Code

```bash
flyctl deploy -a wayzo --remote-only --no-cache
```

This will:
- ✅ Build new Docker image with your changes
- ✅ Install new dependencies (@supabase/supabase-js, resend)
- ✅ Copy new files (backoffice.html, auth.mjs, etc.)
- ✅ Restart the app
- ✅ Keep all your secrets (already set)

---

### Step 3: Verify Environment Variable

Check if PUBLIC_BASE_URL is correct:

```bash
flyctl secrets list -a wayzo
```

**If it shows anything other than `https://wayzo.online`:**
```bash
flyctl secrets set PUBLIC_BASE_URL="https://wayzo.online" -a wayzo
```

---

### Step 4: Test Your Updated App

1. **Homepage:** https://wayzo.online
   - Should see "My Plans" link in header

2. **Backoffice:** https://wayzo.online/backoffice.html
   - Should show sign-in page

3. **Sign In:**
   - Enter email → Magic link sent
   - Click link → Dashboard appears

4. **Check Logs:**
   ```bash
   flyctl logs -a wayzo -f
   ```
   Look for: `✅ Supabase clients initialized`

---

## 🎯 What Gets Updated

### New Files Added:
- ✅ `backend/lib/supabase.mjs`
- ✅ `backend/lib/auth.mjs`
- ✅ `backend/lib/email.mjs`
- ✅ `frontend/backoffice.html`

### Files Modified:
- ✅ `backend/package.json` (+2 dependencies)
- ✅ `backend/server.mjs` (+4 API routes)
- ✅ `frontend/index.backend.html` (+"My Plans" link)

### Backend Version:
- Old: `staging-v64`
- New: `staging-v65`

---

## 📊 Current vs Updated

### BEFORE (Current Fly.io):
```
User generates plan → SQLite → Display → Lost after refresh
```

### AFTER (Updated Fly.io):
```
User generates plan → SQLite → Display (same as before)
                                    ↓
                            Option to "Save Plan"
                                    ↓
                        Sign in → Save to Supabase forever
                                    ↓
                            Email notification sent
                                    ↓
                        Accessible in "My Plans" dashboard
```

---

## 🔧 Troubleshooting

### Issue: Deploy fails with "No dockerfile found"

**Solution:**
```bash
# Make sure you're in the project root
cd "C:\Users\User\OneDrive\Desktop\tripmaster\wayzo new\wayzo"

# Then deploy
flyctl deploy -a wayzo --remote-only --no-cache
```

### Issue: "npm ERR! Missing dependencies"

This is normal during build - it will install them automatically.

### Issue: App restarts but features don't work

**Check logs:**
```bash
flyctl logs -a wayzo -f
```

**Look for errors like:**
- `SUPABASE_URL is undefined` → Need to set secrets
- `Cannot find module '@supabase/supabase-js'` → Redeploy with --no-cache

---

## ⚡ THE ACTUAL COMMAND TO RUN

Just this one:

```bash
flyctl deploy -a wayzo --remote-only --no-cache
```

**Expected output:**
```
==> Verifying app config
--> Verified app config
==> Building image
...
==> Pushing image to fly
...
==> Deploying
...
 1 desired, 1 placed, 1 healthy, 0 unhealthy [health checks: 1 total, 1 passing]
--> v69 deployed successfully
```

---

## 🎉 After Successful Deploy

Your app at **wayzo.online** will have:

1. ✅ All existing features (unchanged)
2. ✅ New "My Plans" link in header
3. ✅ New backoffice at `/backoffice.html`
4. ✅ Supabase authentication
5. ✅ Email notifications (Resend)
6. ✅ 4 new authenticated API routes

**But:** Main plan generation still uses old flow (SQLite).

**To fully integrate:** Choose Option A, B, or C after testing.

---

## 📞 Quick Test After Deploy

```bash
# 1. Deploy
flyctl deploy -a wayzo --remote-only --no-cache

# 2. Open in browser
flyctl open -a wayzo

# 3. Test backoffice
# Go to: https://wayzo.online/backoffice.html

# 4. Watch logs (optional)
flyctl logs -a wayzo -f
```

---

## 🚀 Ready to Update?

Run the deploy command now:

```bash
flyctl deploy -a wayzo --remote-only --no-cache
```

**Deployment time:** 3-5 minutes

Then test at https://wayzo.online! 🎉
