# 🔑 Update Supabase Keys - MUST DO BEFORE DEPLOY

## ⚠️ CRITICAL: Your dashboard won't work without this!

---

## 📝 Step-by-Step:

### Step 1: Get Your Supabase Anon Key

1. Open: https://supabase.com/dashboard/project/khrxfiekfzcvyjlzryvz/settings/api
2. Find the **"anon public"** key (long string starting with `eyJ...`)
3. Copy it to clipboard

---

### Step 2: Update dashboard.html

Open: `frontend/dashboard.html`

Find **lines 346-347**:
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';
```

Replace with:
```javascript
const SUPABASE_URL = 'https://khrxfiekfzcvyjlzryvz.supabase.co';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_KEY_HERE';  // ← Paste the key from step 1
```

---

### Step 3: Update backoffice.html

Open: `frontend/backoffice.html`

Find **lines 381-382**:
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';
```

Replace with:
```javascript
const SUPABASE_URL = 'https://khrxfiekfzcvyjlzryvz.supabase.co';
const SUPABASE_ANON_KEY = 'PASTE_YOUR_KEY_HERE';  // ← Same key as step 2
```

---

## ✅ Verify:

Both files should now have:
- ✅ URL: `https://khrxfiekfzcvyjlzryvz.supabase.co`
- ✅ Key: Your actual anon key (starts with `eyJ...`)

---

## 🚀 Then Deploy:

```bash
flyctl deploy -a wayzo --remote-only --no-cache
```

---

## 🧪 Test After Deploy:

1. Go to: https://wayzo.online/dashboard
2. Should see: Sign-in page (NOT fake data)
3. Enter email → Magic link sent
4. Click link → Dashboard with real data

---

## ❌ What Happens If You Skip This:

You'll see error: **"Configuration Error - Please configure Supabase credentials"**

---

## 🔐 Security Note:

The **anon key** is SAFE to use in frontend code.
- ✅ Use: `anon` `public` key
- ❌ Don't use: `service_role` key (backend only)

Your backend already has the `service_role` key set in Fly.io secrets ✓

---

**Ready? Get your key and update those 2 files!** 🔑
