# 🔐 Add Missing Secrets to Render

## Current Status

✅ **Deployment should now succeed** - The server will start even without secrets (with warnings)
⚠️ **But dashboard won't work fully** until you add these 2 secrets

---

## Required Secrets (2 total)

### 1. SUPABASE_SERVICE_ROLE_KEY

**Where to find it:**
1. Go to: https://supabase.com/dashboard/project/khrxfjekfzcvyjlzryyz
2. Click: **Settings** (gear icon) → **API**
3. Scroll down to **Project API keys**
4. Copy the **`service_role`** key (starts with `eyJhbGc...`)

**Add to Render:**
1. Go to: https://dashboard.render.com/
2. Click your service: **wayzo-staging**
3. Click: **Environment** tab
4. Click: **Add Environment Variable**
5. Key: `SUPABASE_SERVICE_ROLE_KEY`
6. Value: [paste the service_role key]
7. Click: **Save Changes**

Render will auto-redeploy with this secret.

---

### 2. RESEND_API_KEY (Optional for now)

**Where to find it:**
1. Go to: https://resend.com/api-keys
2. Click: **Create API Key**
3. Name: `Wayzo Staging`
4. Permissions: **Full Access** (or **Sending access** minimum)
5. Click: **Create**
6. Copy the API key (starts with `re_...`)

**Add to Render:**
1. Same steps as above
2. Key: `RESEND_API_KEY`
3. Value: [paste the Resend API key]
4. Click: **Save Changes**

**Note:** Email notifications won't work without this, but everything else will work.

---

## What Happens Now

### ✅ After adding SUPABASE_SERVICE_ROLE_KEY:

The service will redeploy automatically (takes 1-2 minutes). Then:

- ✅ Dashboard authentication will work
- ✅ You can sign in with magic link
- ✅ Plans will be saved to Supabase database
- ✅ All API endpoints will function

### ✅ After adding RESEND_API_KEY:

- ✅ Email notifications will be sent when plans are created
- ✅ Branded emails from "Wayzo" will work

---

## Test Your Staging Environment

Once secrets are added, test:

1. **Open**: https://wayzo-staging.onrender.com/dashboard

2. **You should see**:
   - Clean sign-in page (NO fake data!)
   - Modern purple gradient design
   - "Sign In with Email" button

3. **Sign in**:
   - Enter your email
   - Check inbox for Supabase magic link
   - Click link
   - Dashboard should show "No plans yet"

4. **Check logs** (Render dashboard → Logs tab):
   ```
   ✅ Supabase admin client initialized
   ✅ Supabase public client initialized
   Wayzo backend running on 0.0.0.0:10000
   ```

---

## Troubleshooting

### Deployment still fails after adding secrets

**Solution**: Check Render logs tab for the specific error

### "Supabase admin not configured" error

**Symptom**: API returns 503 error
**Cause**: SUPABASE_SERVICE_ROLE_KEY not set or incorrect
**Solution**:
1. Verify the key is correct (check Supabase dashboard)
2. Re-save the environment variable in Render
3. Check logs for "⚠️ SUPABASE_SERVICE_ROLE_KEY not set" warning

### Dashboard still shows fake data

**Cause**: Browser cache
**Solution**:
1. Hard refresh: `Ctrl + Shift + R`
2. Open in incognito mode
3. Wait 2-3 minutes after deployment completes

### Auth redirects to wrong URL

**Solution**: Configure Supabase redirect URLs
1. Go to Supabase dashboard → Authentication → URL Configuration
2. Add:
   ```
   https://wayzo-staging.onrender.com/dashboard
   https://wayzo-staging.onrender.com/dashboard.html
   ```
3. Save

---

## Summary

**Required NOW**:
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to Render

**Optional (but recommended)**:
- [ ] Add `RESEND_API_KEY` to Render
- [ ] Configure Supabase redirect URLs
- [ ] Test dashboard authentication

**Time needed**: 2-3 minutes

After adding the service role key, your staging environment will be fully functional! 🚀
