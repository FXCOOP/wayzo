# 🔧 Render Deployment Fix - URGENT

## The Problem

`npm install --prefix backend` creates node_modules in the wrong location for ES modules.

## The Solution

Update your Render Settings:

### 1. Build Command
Change FROM:
```
npm install --prefix backend
```

Change TO:
```
cd backend && npm ci --omit=dev
```

### 2. Start Command
Keep as:
```
cd backend && node server.mjs
```

### 3. Save and Deploy

Click "Save Changes" then "Manual Deploy"

---

## Why This Works

- `cd backend` ensures we're IN the backend directory
- `npm ci` installs packages to `./node_modules` (current directory)
- When we run `node server.mjs`, it finds node_modules correctly
- `--omit=dev` skips dev dependencies (faster build)

---

## Expected Success Logs

```
==> Running build command 'cd backend && npm ci --omit=dev'...
added 303 packages, and audited 304 packages in 4s
==> Build successful 🎉
==> Running 'cd backend && node server.mjs'
⚠️ SUPABASE_SERVICE_ROLE_KEY not set - admin features disabled
✅ Supabase public client initialized
Wayzo backend running on 0.0.0.0:10000
Version: staging-v65
```

Then test: https://wayzo-staging.onrender.com

---

## Do This NOW:

1. Go to Render Settings
2. Edit Build Command → `cd backend && npm ci --omit=dev`
3. Save Changes
4. Manual Deploy
5. Watch logs for success! 🚀
