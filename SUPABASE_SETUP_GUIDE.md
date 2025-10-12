# Supabase Setup Guide for Wayzo

This guide will help you configure Supabase to store and manage user trip plans.

## 1. Database Setup

### Plans Table Schema

Your `plans` table should have the following structure:

```sql
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  budget_low INTEGER,
  budget_high INTEGER,
  travelers INTEGER,
  html TEXT,
  markdown TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster user lookups
CREATE INDEX idx_plans_user_id ON plans(user_id);
CREATE INDEX idx_plans_created_at ON plans(created_at DESC);
```

### Enable Row Level Security (RLS)

RLS ensures users can only access their own plans:

```sql
-- Enable RLS on plans table
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own plans
CREATE POLICY "Users can view own plans"
  ON plans
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own plans
CREATE POLICY "Users can insert own plans"
  ON plans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own plans
CREATE POLICY "Users can update own plans"
  ON plans
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own plans
CREATE POLICY "Users can delete own plans"
  ON plans
  FOR DELETE
  USING (auth.uid() = user_id);
```

## 2. Authentication Setup

### Configure Auth Settings

1. Go to **Authentication** → **Settings** in your Supabase dashboard
2. Enable **Email** provider under **Auth Providers**
3. Configure **Email Templates**:
   - Magic Link template
   - Confirmation template

### Custom SMTP Configuration (Recommended)

To avoid rate limits and improve deliverability, configure custom SMTP:

#### Option 1: Resend (Recommended)

1. Go to [resend.com](https://resend.com) and create an account
2. Get your API key
3. In Supabase, go to **Authentication** → **Settings** → **SMTP Settings**
4. Configure:
   ```
   Host: smtp.resend.com
   Port: 587
   Username: resend
   Password: [Your Resend API Key]
   Sender name: Wayzo
   Sender email: hello@wayzo.online (or your verified domain)
   ```

#### Option 2: SendGrid

1. Get SendGrid API key from [sendgrid.com](https://sendgrid.com)
2. Configure in Supabase:
   ```
   Host: smtp.sendgrid.net
   Port: 587
   Username: apikey
   Password: [Your SendGrid API Key]
   ```

### Email Redirect URLs

Configure allowed redirect URLs in **Authentication** → **URL Configuration**:

```
http://localhost:8000/dashboard
http://localhost:8000/backoffice.html
https://yourdomain.com/dashboard
https://yourdomain.com/backoffice.html
```

## 3. Backend API Configuration

### Environment Variables

Add these to your backend `.env` file or hosting environment:

```bash
# Supabase Configuration
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# Public Base URL (for email links)
PUBLIC_BASE_URL=https://yourdomain.com
```

### API Endpoints

The following endpoints are already implemented in `backend/server.mjs`:

- `GET /api/user/plans` - List user's plans
- `GET /api/user/plan/:id` - Get specific plan
- `POST /api/user/plan` - Create new plan
- `GET /api/user/plan/:id/pdf` - Download plan as PDF

### Authentication Middleware

The backend uses JWT validation middleware (`requireUser`) that:
1. Extracts Bearer token from Authorization header
2. Validates JWT signature using Supabase JWT secret
3. Extracts user_id from token
4. Attaches user to request object

## 4. Frontend Configuration

### Dashboard Files

Update these files with your Supabase credentials:

**frontend/dashboard.html** (line 349-350):
```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

**frontend/backoffice.html** (line 346-347):
```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

### Main App Integration

The main app (`frontend/app.js`) now automatically saves plans when generated if user is authenticated.

## 5. Testing the Setup

### Test Authentication

1. Go to `/dashboard` or `/backoffice.html`
2. Enter your email address
3. Click "Sign In with Magic Link"
4. Check email for magic link
5. Click link to authenticate

### Test Plan Storage

1. Generate a trip plan in the main app while logged in
2. You should see: "✅ Plan saved to your dashboard!"
3. Go to dashboard and verify plan appears
4. Click plan to view full details
5. Test share, PDF, and Excel export buttons

### Verify Database

Check Supabase dashboard:
1. Go to **Table Editor** → **plans**
2. You should see your saved plans
3. Verify `user_id` matches your auth user

## 6. Troubleshooting

### "No access token" Error

**Problem**: User not authenticated
**Solution**:
- Clear browser localStorage
- Sign in again via dashboard
- Check Supabase Auth logs

### "Failed to load plans" Error

**Problem**: RLS policies not configured
**Solution**:
- Run RLS policies from section 1
- Verify policies in Supabase SQL Editor
- Check that `user_id` column exists in plans table

### "Email rate limit exceeded"

**Problem**: Default Supabase SMTP has strict limits
**Solution**:
- Configure custom SMTP (see section 2)
- Wait 1 hour for rate limit reset
- Use SendGrid or Resend for production

### Plans Not Saving Automatically

**Problem**: Frontend not detecting authentication
**Solution**:
- Check browser console for errors
- Verify `window.supabase` is initialized
- Ensure `currentUser` is set after login
- Check that API endpoint returns 200 OK

### Share Link Not Working

**Problem**: URL not accessible or authentication required
**Solution**:
- Verify plan is saved to database
- Check that plan_id in URL is correct
- Ensure user is logged in to view plan
- RLS policies must allow user to view plan

## 7. Production Deployment

### Security Checklist

- ✅ RLS policies enabled on all tables
- ✅ Custom SMTP configured (not default Supabase)
- ✅ SERVICE_ROLE_KEY kept secret (server-side only)
- ✅ ANON_KEY in frontend (public, rate-limited)
- ✅ JWT secret configured in backend
- ✅ HTTPS enabled on production domain
- ✅ Allowed redirect URLs configured

### Performance Optimization

1. **Enable caching** for static plan content
2. **Add indexes** on frequently queried columns
3. **Set up database backups** in Supabase
4. **Monitor query performance** in Supabase dashboard
5. **Consider CDN** for PDF exports

### Monitoring

Monitor these metrics in Supabase:
- Auth requests per hour
- Database connections
- Query performance
- Storage usage
- API response times

## 8. Additional Features

### Email Notifications

The backend supports sending email notifications when plans are ready (see `backend/lib/email.mjs`):

```bash
# Add to .env
RESEND_API_KEY=your_resend_api_key
```

Plans will automatically send notification emails to users when completed.

### PDF Storage

PDFs can be stored in Supabase Storage for faster access:

1. Create a `pdfs` bucket in Supabase Storage
2. Configure RLS policies for pdfs bucket
3. Update backend to save PDFs to Storage
4. Reference Storage URLs instead of generating on-demand

## Need Help?

- Check [Supabase Documentation](https://supabase.com/docs)
- Review backend logs for errors
- Test API endpoints with curl/Postman
- Join Wayzo community for support
