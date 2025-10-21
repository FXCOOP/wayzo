# ⚡ DO THIS NOW - Deploy Wayzo to Fly.io

## 🎯 Super Simple Checklist

### ✅ Step 1: Update Supabase Credentials (2 minutes)

Open file: `frontend/backoffice.html`

Find lines 381-382 and replace:
```javascript
const SUPABASE_URL = 'https://khrxfiekfzcvyjlzryvz.supabase.co';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_KEY_HERE';
```

**Get anon key from:**
1. Go to: https://supabase.com/dashboard/project/khrxfiekfzcvyjlzryvz/settings/api
2. Copy the **"anon public"** key (long string starting with `eyJ...`)
3. Paste it in the file above

---

### ✅ Step 2: Verify Environment Variable (30 seconds)

Run in terminal:
```bash
flyctl secrets list -a wayzo
```

Check if `PUBLIC_BASE_URL` shows in the list.

**If it says `https://wayzo.fly.dev`**, update it:
```bash
flyctl secrets set PUBLIC_BASE_URL="https://wayzo.online" -a wayzo
```

---

### ✅ Step 3: Deploy! (5 minutes)

Run this ONE command:
```bash
flyctl deploy -a wayzo --remote-only --no-cache
```

**Wait for:**
```
✓ Machine created
✓ Waiting for machine to start
✓ Machine started
✓ Health check passed
→ v68 deployed successfully
```

---

### ✅ Step 4: Test It (2 minutes)

#### Test 1: Homepage
Open: https://wayzo.online

**Should see:** Your homepage with "My Plans" link in header ✓

#### Test 2: Backoffice
Click "My Plans" or go to: https://wayzo.online/backoffice.html

**Should see:** Sign-in page with email input ✓

#### Test 3: Magic Link
1. Enter your email
2. Click "Sign In with Magic Link"
3. Check your email inbox
4. Click the magic link
5. Should redirect back and show "My Trip Plans" dashboard ✓

---

## 🎉 Success! You're Live on Fly.io

Your app is now running 24/7 at:
- **Main site:** https://wayzo.online
- **Backoffice:** https://wayzo.online/backoffice.html

---

## 🔄 What Happens Next?

**Current state:**
- ✅ Backoffice works
- ✅ Can sign in and view saved plans
- ⏳ Main app still uses old flow (SQLite)

**To fully integrate:**

Choose one option:

### Option A: Add "Save Plan" Button (Recommended)
Keep current flow, add optional save after generation.
→ Say: **"Implement Option A"**

### Option B: Full Integration
Replace old flow, require auth before generation.
→ Say: **"Implement Option B"**

### Option C: Keep As-Is
Use backoffice independently, integrate later yourself.
→ Say: **"Deploy as-is, I'll integrate later"**

---

## 📞 Having Issues?

### Can't deploy?
```bash
# Check if logged in to Fly.io
flyctl auth whoami

# If not logged in
flyctl auth login
```

### App not starting?
```bash
# Watch logs
flyctl logs -a wayzo -f
```

### Domain not working?
```bash
# Check DNS
nslookup wayzo.online

# Should point to Fly.io IPs
# If not, update your DNS provider
```

---

## 🚀 THE ACTUAL COMMANDS TO RUN

Copy-paste these in order:

```bash
# 1. Check secrets (optional)
flyctl secrets list -a wayzo

# 2. Deploy (required)
flyctl deploy -a wayzo --remote-only --no-cache

# 3. Watch logs (optional)
flyctl logs -a wayzo -f

# 4. Open in browser (optional)
flyctl open -a wayzo
```

---

**That's it! You're done!** 🎉

After deployment works, just tell me which option (A, B, or C) you want for integration!
