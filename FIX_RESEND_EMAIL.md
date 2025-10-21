# 📧 Fix Resend Email - Why No Emails Sent

## 🔍 Problem:

Your Resend dashboard shows **0 contacts** = No emails sent yet.

---

## 🎯 Solution:

### Step 1: Verify Resend API Key in Fly.io

Check if it's set:
```bash
flyctl secrets list -a wayzo
```

Look for:
```
RESEND_API_KEY    ✓ (should be there)
```

**If missing, add it:**
```bash
flyctl secrets set RESEND_API_KEY="re_your_key_here" -a wayzo
```

Get your key from: https://resend.com/api-keys

---

### Step 2: Verify Sending Domain

Resend requires a verified domain to send emails.

**Check:**
1. Go to: https://resend.com/domains
2. Look for: `wayzo.online` or `wayzo.fly.dev`
3. Status should be: ✅ **Verified**

**If not verified:**
1. Click "Add Domain"
2. Add: `wayzo.online`
3. Add DNS records (SPF, DKIM)
4. Wait for verification (can take up to 48 hours)

**Quick workaround for testing:**
Use Resend's test domain: `onboarding@resend.dev`

Update `backend/lib/email.mjs` line 18:
```javascript
// Change from:
from: 'Wayzo <hello@wayzo.online>',

// To (for testing):
from: 'Wayzo <onboarding@resend.dev>',
```

---

### Step 3: Test Email Sending

After deploying, watch logs:
```bash
flyctl logs -a wayzo -f
```

When someone signs in or creates a plan, look for:
```
✅ Email sent successfully: { to: 'user@email.com', messageId: '...' }
```

**If you see:**
```
❌ Resend email error: ...
```
That's the actual error to fix.

---

### Step 4: Check Spam Folder

Resend emails might go to spam if:
- Domain not verified
- First time sending
- Email provider flags it

**Always check spam/junk folder first!**

---

## 🚀 Quick Fix Steps:

```bash
# 1. Check if RESEND_API_KEY is set
flyctl secrets list -a wayzo

# 2. If missing, add it
flyctl secrets set RESEND_API_KEY="your_key" -a wayzo

# 3. Redeploy
flyctl deploy -a wayzo --remote-only --no-cache

# 4. Watch logs
flyctl logs -a wayzo -f

# 5. Test sign-in flow
# Go to: https://wayzo.online/dashboard
# Enter email → Check logs for email errors
```

---

## 🔧 Common Issues:

### Issue: "Domain not verified"
**Fix:** Verify domain in Resend dashboard, or use `onboarding@resend.dev` for testing

### Issue: "Invalid API key"
**Fix:** Get new key from Resend dashboard, update Fly.io secret

### Issue: "Rate limit exceeded"
**Fix:** Resend free tier has limits, upgrade or wait

### Issue: Email goes to spam
**Fix:** Verify domain, add SPF/DKIM records, whitelist in email provider

---

## 📊 Test Email Flow:

1. User clicks "Sign In with Magic Link"
2. Backend calls `sendPlanReadyEmail()`
3. Resend API sends email
4. Check Resend dashboard: https://resend.com/emails
5. Should see new email in "Emails" tab

If it appears there but user didn't receive → Check spam!

---

## ⚡ Quick Test Command:

After deployment, test with:
```bash
# Watch logs
flyctl logs -a wayzo -f

# In another terminal, trigger sign-in
# Go to wayzo.online/dashboard
# Enter email
# Should see in logs: "Email sent successfully"
```

---

**Want me to check your Resend configuration?** Share any error messages from the logs!
