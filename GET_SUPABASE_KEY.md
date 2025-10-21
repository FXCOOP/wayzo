# 🔑 Get Your Supabase Anon Key

## Step-by-Step with Screenshots:

### 1. Go to Supabase Settings
Open this URL:
```
https://supabase.com/dashboard/project/khrxfiekfzcvyjlzryvz/settings/api
```

### 2. Find "Project API keys" Section

You'll see two keys:
- **anon public** ← **USE THIS ONE** ✅
- **service_role** ← **DON'T USE** (backend only)

### 3. Copy the Anon Key

Click the copy button next to **anon public** key.

It should look like:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZi...
```
(Very long string)

### 4. Paste It In Your Files

**File 1:** `frontend/dashboard.html`
- Find line 346-347
- Replace `YOUR_SUPABASE_ANON_KEY_HERE` with the key you copied

**File 2:** `frontend/backoffice.html`
- Find line 381-382
- Replace `YOUR_SUPABASE_ANON_KEY_HERE` with the same key

### 5. Example:

**BEFORE:**
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';
```

**AFTER:**
```javascript
const SUPABASE_URL = 'https://khrxfiekfzcvyjlzryvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJz...';  // Your actual key
```

---

## ✅ Done? Deploy!

```bash
flyctl deploy -a wayzo --remote-only --no-cache
```

---

## 📧 About Email (Resend) Issue:

I see you have **0 contacts** in Resend. This means emails are NOT being sent.

**Possible reasons:**
1. ❌ Resend API key not set in Fly.io
2. ❌ Sending domain not verified
3. ❌ Email going to spam

**Let's fix this after deployment!**
