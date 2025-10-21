# ✅ Complete Deployment Checklist

## 🎯 Do These 3 Things in Order:

---

## 1️⃣ Get Supabase Anon Key (2 minutes)

### Open this link:
```
https://supabase.com/dashboard/project/khrxfiekfzcvyjlzryvz/settings/api
```

### Copy the "anon public" key
It looks like: `eyJhbGciOiJIUz...` (very long)

### Update 2 files:

**File 1:** `frontend/dashboard.html` (line 346-347)
**File 2:** `frontend/backoffice.html` (line 381-382)

Change:
```javascript
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';
```

To:
```javascript
const SUPABASE_ANON_KEY = 'eyJhbGc...YOUR_ACTUAL_KEY_HERE';
```

---

## 2️⃣ Deploy to Fly.io (5 minutes)

### Run this command:
```bash
flyctl deploy -a wayzo --remote-only --no-cache
```

### Wait for:
```
✓ Health check passed
→ v69 deployed successfully
```

---

## 3️⃣ Test Your Dashboard (2 minutes)

### Open:
```
https://wayzo.online/dashboard
```

### You should see:
- ✅ Sign-in page with email input
- ✅ "Sign In with Magic Link" button
- ❌ NOT the fake dashboard with Paris/Tokyo/Bali

### Try signing in:
1. Enter your email
2. Click "Sign In with Magic Link"
3. Check email (and spam folder!)
4. Click the magic link
5. Should redirect to dashboard

---

## 🐛 If Email Doesn't Arrive:

This is a **separate issue** (not deployment).

**Quick checks:**
```bash
# 1. Check if email key is set
flyctl secrets list -a wayzo | grep RESEND

# 2. Watch logs when you sign in
flyctl logs -a wayzo -f
```

**Look for in logs:**
- ✅ `Email sent successfully` = Email was sent
- ❌ `Resend email error` = Problem with sending

**Common reasons:**
- Domain not verified in Resend
- Email going to spam
- API key incorrect

**Read:** [FIX_RESEND_EMAIL.md](FIX_RESEND_EMAIL.md) for solutions.

---

## 📊 What Success Looks Like:

### Before Deploy:
- ❌ Dashboard shows fake data (Paris, Tokyo, Bali)
- ❌ No real authentication
- ❌ Can't save plans

### After Deploy:
- ✅ Dashboard shows sign-in page
- ✅ Real Supabase authentication
- ✅ Can save plans to database
- ✅ Plans appear in dashboard
- ⏳ Email notification (needs domain setup)

---

## 🚀 Ready? Let's Go!

### Step 1:
Copy your Supabase anon key from dashboard

### Step 2:
Paste it in both files (dashboard.html, backoffice.html)

### Step 3:
Run:
```bash
flyctl deploy -a wayzo --remote-only --no-cache
```

### Step 4:
Test at: https://wayzo.online/dashboard

---

## 📞 Need Help?

**If stuck at any step, share:**
1. Which step you're on
2. What error you see (if any)
3. Screenshot of the issue

I'll help you fix it! 🛠️
