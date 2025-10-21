# Supabase Authentication Errors - Fix Instructions

## Errors You're Seeing

```
POST https://khrxfjekfzcvyjlzryyz.supabase.co/auth/v1/otp 500 (Internal Server Error)
Sign in error: AuthApiError: Error sending magic link email

POST https://khrxfjekfzcvyjlzryyz.supabase.co/auth/v1/otp 429 (Too Many Requests)
Sign in error: AuthApiError: email rate limit exceeded
```

## Root Causes

### Issue 1: Magic Link Email Sending Failure (500 Error)

This happens because **Supabase hasn't configured email sending**. By default, Supabase uses their own SMTP which has strict limits and can fail.

### Issue 2: Rate Limit (429 Error)

You triggered Supabase's rate limit by:
- Requesting multiple magic links in short succession
- Free tier has very strict rate limits (typically 3-4 emails per hour per email address)

## Solutions

### ✅ Solution 1: Wait for Rate Limit to Reset (Quick Fix)

**Wait 1 hour** before trying to sign in again. The rate limit will reset.

### ✅ Solution 2: Configure Custom SMTP (Permanent Fix)

You MUST configure custom SMTP to fix the 500 error and avoid rate limits.

#### Steps:

1. **Go to Supabase Dashboard**
   - https://supabase.com/dashboard/project/khrxfjekfzcvyjlzryyz/settings/auth

2. **Navigate to Authentication → Email Templates → SMTP Settings**

3. **Enable Custom SMTP** and configure:

**Option A: Use Resend (Recommended - You already have it)**
```
SMTP Host: smtp.resend.com
SMTP Port: 587
Username: resend
Password: YOUR_RESEND_API_KEY (get from resend.com)
Sender Email: noreply@wayzo.online
Sender Name: Wayzo
```

**Option B: Use SendGrid (Free 100/day)**
```
SMTP Host: smtp.sendgrid.com
SMTP Port: 587
Username: apikey
Password: YOUR_SENDGRID_API_KEY
Sender Email: noreply@wayzo.online
Sender Name: Wayzo
```

4. **Verify Your Domain** (Required for custom email)
   - Add DNS records for your domain (wayzo.online)
   - This allows emails to be sent from @wayzo.online
   - Without this, emails will be blocked

5. **Update Redirect URLs** (While you're there)
   - In **Authentication → URL Configuration**
   - Site URL: `https://wayzo-staging.onrender.com`
   - Redirect URLs:
     ```
     https://wayzo-staging.onrender.com
     https://wayzo-staging.onrender.com/dashboard
     https://wayzo-staging.onrender.com/dashboard.html
     ```

### ✅ Solution 3: Use Different Email (Temporary Workaround)

If you're blocked, try a different email address to test authentication.

### ✅ Solution 4: Enable Test Mode (Development Only)

For testing, you can bypass magic links:

1. In Supabase Dashboard → Authentication → Providers
2. Scroll down to **Email**
3. Enable "Confirm email" = OFF (for development only!)
4. This allows instant sign-in without magic link

⚠️ **WARNING**: Only use this in development. Re-enable for production!

## Why This is Happening

1. **Dashboard redirects to `/backoffice.html`** instead of `/dashboard.html`
   - Error shows: `redirect_to=https://wayzo-staging.onrender.com/backoffice.html`
   - This might be an old URL

2. **Default Supabase SMTP is unreliable**
   - Free tier has very low limits
   - No custom branding
   - Often triggers spam filters

3. **You clicked the button multiple times**
   - Each click triggered a new magic link request
   - Supabase blocked your email after 3-4 attempts

## Fix the Redirect URL Issue

The dashboard is trying to redirect to `/backoffice.html` (wrong file). Let me check the code:

```javascript
// In dashboard.html, line 438
// It should be redirecting to /dashboard, not /backoffice.html
```

This is a bug in the frontend code that needs fixing.

## Testing After Fix

1. Wait 1 hour for rate limit to reset
2. Go to: https://wayzo-staging.onrender.com/dashboard
3. Enter your email
4. Check inbox for magic link
5. Click link - should redirect to dashboard
6. Should see "No plans yet" (or your plans if you've created any while signed in)

## Alternative: Test with Password Auth

If magic links keep failing, you can enable password authentication:

1. In Supabase Dashboard → Authentication → Providers
2. Enable **Email** provider
3. Enable **Password** option
4. Update frontend to support password login

But this requires code changes in `dashboard.html`.

## Expected Behavior After Fix

✅ Magic link emails sent from `noreply@wayzo.online`
✅ No more 500 errors
✅ Higher rate limits (100+ emails/day)
✅ Professional branding in emails
✅ Reliable delivery

## Need Help?

Check Supabase logs:
1. Go to Supabase Dashboard → Logs → Auth Logs
2. Look for failed auth attempts
3. Will show detailed error messages
