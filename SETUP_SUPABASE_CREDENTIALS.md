# Setup Supabase Credentials in Frontend

## IMPORTANT: Update backoffice.html with your Supabase credentials

Edit `frontend/backoffice.html` and replace these lines (around line 381-382):

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';
```

With your actual credentials:

```javascript
const SUPABASE_URL = 'https://khrxfiekfzcvyjlzryvz.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_FROM_SUPABASE_DASHBOARD';
```

## Where to find your credentials:

1. Go to: https://supabase.com/dashboard/project/khrxfiekfzcvyjlzryvz/settings/api
2. Copy:
   - Project URL → Use as `SUPABASE_URL`
   - anon/public key → Use as `SUPABASE_ANON_KEY`

**DO NOT use service_role_key in frontend - only use anon key!**
