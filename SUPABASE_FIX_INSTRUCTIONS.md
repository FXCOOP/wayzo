# Supabase Authentication & Dashboard Fix

## Problem Summary
1. Magic link redirects to Supabase domain instead of wayzo-staging.onrender.com
2. Dashboard not showing user's plans
3. Email doesn't mention wayzo domain

## Fix Steps

### Step 1: Configure Supabase Redirect URLs (MUST DO FIRST)

Go to Supabase Dashboard: https://supabase.com/dashboard/project/khrxfjekfzcvyjlzryyz

1. Navigate to **Authentication** → **URL Configuration**

2. Set **Site URL**:
   ```
   https://wayzo-staging.onrender.com
   ```

3. Add **Redirect URLs** (one per line):
   ```
   https://wayzo-staging.onrender.com
   https://wayzo-staging.onrender.com/dashboard
   https://wayzo-staging.onrender.com/dashboard.html
   https://wayzo.online
   https://wayzo.online/dashboard
   ```

4. Click **Save**

### Step 2: Configure Email Templates

1. In Supabase Dashboard, go to **Authentication** → **Email Templates**

2. Select **Magic Link** template

3. Update the template to mention your domain:

```html
<h2>Magic Link</h2>
<p>Follow this link to login to Wayzo:</p>
<p><a href="{{ .ConfirmationURL }}">Log In to Wayzo</a></p>
<p>This link will expire in 24 hours.</p>
```

4. Click **Save**

### Step 3: Test Authentication Flow

1. Clear browser cache and localStorage
2. Go to https://wayzo-staging.onrender.com/dashboard
3. Click "Sign In"
4. Enter email address
5. Check email for magic link
6. Click magic link - should redirect to wayzo-staging.onrender.com/dashboard
7. Dashboard should load and show your plans

### Step 4: Verify Backend API Endpoints

The following endpoints should exist and work:

- `GET /api/user/plans` - List user's plans (requires Bearer token)
- `GET /api/user/plan/:id` - Get single plan (requires Bearer token)
- `GET /api/user/plan/:id/pdf` - Download PDF (requires Bearer token)

Test with curl:
```bash
# Get session token from browser console:
# (await supabase.auth.getSession()).data.session.access_token

curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  https://wayzo-staging.onrender.com/api/user/plans
```

### Step 5: Update Frontend Config (if needed)

If you're using a config file, update `frontend/config.js`:

```javascript
const CONFIG = {
  API_BASE_URL: 'https://wayzo-staging.onrender.com',
  SUPABASE_URL: 'https://khrxfjekfzcvyjlzryyz.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocnhmamVrZnpjdnlqbHpyeXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NzA3ODEsImV4cCI6MjA3NTQ0Njc4MX0.Uc4Nd9Wxt1TZNoq_nto0vYCdPAG1tI8alhx8ENSv8HA'
};
```

## Troubleshooting

### Issue: Magic link goes to Supabase domain
**Solution**: Double-check Site URL in Supabase dashboard (Step 1)

### Issue: Dashboard shows "No plans yet" but I created plans
**Solution**:
- Check if plans were saved to Supabase (not just generated)
- Verify user_id matches in database
- Check browser console for API errors

### Issue: "No access token" error
**Solution**:
- Clear browser cache and localStorage
- Sign out and sign in again
- Check if magic link was clicked before expiring

### Issue: API returns 401 Unauthorized
**Solution**:
- Verify Supabase JWT is being sent in Authorization header
- Check backend has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
- Ensure requireUser middleware is working

## Expected Behavior After Fix

1. ✅ Click "My Plans" → Redirects to /dashboard
2. ✅ Enter email → Magic link email sent with "Wayzo" branding
3. ✅ Click magic link → Redirects to wayzo-staging.onrender.com/dashboard
4. ✅ Dashboard shows list of user's generated plans
5. ✅ Click plan → Shows full itinerary with all features
6. ✅ Download PDF works
7. ✅ Add to Calendar works

## Database Check

To verify plans are being saved, check Supabase Dashboard:

1. Go to **Table Editor** → **plans** table
2. Look for rows with your user_id
3. Verify user_id matches your auth.users.id

If no plans exist, that means they weren't saved. Need to update the frontend to save plans after generation.
