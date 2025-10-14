# Supabase & Render Configuration Guide

## Problem
Magic link authentication emails are redirecting to production (wayzo.online) instead of staying on staging (wayzo-staging.onrender.com).

## Root Cause
Supabase needs to allow both production AND staging URLs in its redirect whitelist. Currently, it may only have the production URL configured.

---

## 1. Supabase Configuration

### Step 1: Add Staging URL to Allowed Redirect URLs

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `khrxfjekfzcvyjlzryyz`
3. Navigate to **Authentication** → **URL Configuration**
4. Find the **Redirect URLs** section
5. Add the following URLs to the whitelist:

```
https://wayzo.online
https://wayzo.online/dashboard
https://wayzo-staging.onrender.com
https://wayzo-staging.onrender.com/dashboard
http://localhost:8000
http://localhost:8000/dashboard
```

**Why this is needed:** Supabase only sends magic links to whitelisted URLs. If staging isn't in the list, it defaults to the first allowed URL (production).

### Step 2: Configure Site URL

In the same **URL Configuration** section:

- **Site URL**: Set to `https://wayzo.online` (production)
- **Additional Redirect URLs**: Add staging and localhost as shown above

### Step 3: Verify Email Templates (Optional)

1. Navigate to **Authentication** → **Email Templates**
2. Check the **Magic Link** template
3. Ensure it uses the dynamic redirect variable: `{{ .ConfirmationURL }}`
4. This ensures emails use the correct URL based on where the request came from

---

## 2. Render Configuration

### Step 1: Environment Variables for Staging

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your staging service: **wayzo-staging**
3. Navigate to **Environment** tab
4. Ensure these variables are set:

```bash
# Supabase (same for both staging and production)
SUPABASE_URL=https://khrxfjekfzcvyjlzryyz.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

# Environment identifier (optional, for logging)
ENVIRONMENT=staging
APP_URL=https://wayzo-staging.onrender.com
```

### Step 2: Environment Variables for Production

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your production service: **wayzo** (main)
3. Navigate to **Environment** tab
4. Ensure these variables are set:

```bash
# Supabase (same for both staging and production)
SUPABASE_URL=https://khrxfjekfzcvyjlzryyz.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

# Environment identifier
ENVIRONMENT=production
APP_URL=https://wayzo.online
```

### Step 3: Auto-Deploy Configuration

**Staging Service:**
- **Branch**: `fix-links-v68`
- **Auto-Deploy**: ✅ Enabled
- Deploys automatically when you push to `fix-links-v68`

**Production Service:**
- **Branch**: `main`
- **Auto-Deploy**: ✅ Enabled (or ❌ Disabled for manual control)
- Only deploys when you merge `fix-links-v68` → `main`

---

## 3. Code Changes (Already Implemented)

The code in `frontend/dashboard.html` and `frontend/backoffice.html` already uses dynamic redirect URLs:

```javascript
emailRedirectTo: window.location.origin + '/dashboard'
```

This means:
- On staging: redirects to `https://wayzo-staging.onrender.com/dashboard`
- On production: redirects to `https://wayzo.online/dashboard`

**No code changes needed** - the issue is purely in Supabase configuration.

---

## 4. Testing After Configuration

### Test Staging Authentication:
1. Go to `https://wayzo-staging.onrender.com`
2. Click "Sign In" or "Dashboard"
3. Enter your email
4. Check your email for the magic link
5. Click the magic link
6. **Expected**: Should redirect to `https://wayzo-staging.onrender.com/dashboard`
7. **Previously**: Redirected to `https://wayzo.online/dashboard` ❌

### Test Production Authentication:
1. Go to `https://wayzo.online`
2. Click "Sign In" or "Dashboard"
3. Enter your email
4. Check your email for the magic link
5. Click the magic link
6. **Expected**: Should redirect to `https://wayzo.online/dashboard`

---

## 5. Troubleshooting

### Problem: Still redirecting to production
**Solution**: Clear browser cache and cookies, or test in incognito mode

### Problem: "Invalid redirect URL" error
**Solution**: Double-check that BOTH URLs are in Supabase's allowed list (with and without `/dashboard`)

### Problem: Magic link says "Link expired"
**Solution**: Supabase magic links expire after 1 hour. Request a new one.

### Problem: Auto-deploy not working on Render
**Solution**:
1. Check **Deploy Hooks** in Render dashboard
2. Ensure branch name matches exactly: `fix-links-v68`
3. Manually trigger deploy: Click **Manual Deploy** → Select branch → Deploy

---

## 6. Workflow After Configuration

Once Supabase and Render are properly configured:

1. **Development**: Push to `fix-links-v68` → Auto-deploys to staging
2. **Testing**: Test on `wayzo-staging.onrender.com`
3. **Approval**: When everything works, merge to `main`
4. **Production**: Merge triggers deploy to `wayzo.online`

---

## Summary

**Supabase Changes:**
- ✅ Add `https://wayzo-staging.onrender.com` to allowed redirect URLs
- ✅ Add `https://wayzo-staging.onrender.com/dashboard` to allowed redirect URLs

**Render Changes:**
- ✅ Ensure staging uses branch `fix-links-v68`
- ✅ Ensure production uses branch `main`
- ✅ Set `APP_URL` environment variable for each service

**Code Changes:**
- ✅ Already done - using `window.location.origin` dynamically

**After these changes, authentication will work correctly on both staging and production.**
