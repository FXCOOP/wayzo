# Wayzo Enhanced Deployment Guide

## 🚀 Quick Deployment Options

### Option 1: Render (Recommended - Free Tier)
1. **Backend Deployment**
   - Connect your GitHub repo to Render
   - Create new Web Service
   - Set build command: `npm install`
   - Set start command: `npm start`
   - Add environment variables (see below)

2. **Frontend Deployment**
   - Create new Static Site
   - Point to `frontend/` directory
   - Set build command: `echo "Static site"`
   - Set publish directory: `frontend`

### Option 2: Railway (Alternative)
1. **Full Stack Deployment**
   - Connect GitHub repo
   - Railway will auto-detect Node.js
   - Add environment variables
   - Deploy both frontend and backend

### Option 3: Vercel + Railway
1. **Frontend on Vercel**
   - Deploy `frontend/` to Vercel
   - Configure custom domain if needed

2. **Backend on Railway**
   - Deploy backend separately
   - Set CORS origin to your Vercel domain

## 🔧 Environment Variables

Create `.env` file in `backend/` directory:

```bash
# Required for AI functionality
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini

# Optional: Affiliate IDs for booking links
BOOKING_AID=your_booking_com_affiliate_id
GYG_PID=your_getyourguide_partner_id
KAYAK_AID=your_kayak_affiliate_id

# Production settings
NODE_ENV=production
PORT=10000

# CORS origin (your frontend domain)
ORIGIN=https://your-frontend-domain.com
```

## 📦 Pre-Deployment Checklist

### Backend Setup
- [ ] Install dependencies: `cd backend && npm install`
- [ ] Create `.env` file with your API keys
- [ ] Test locally: `npm run dev`
- [ ] Verify image handling works
- [ ] Test checkbox functionality

### Frontend Setup
- [ ] Verify CSS styles are included
- [ ] Test image placeholders
- [ ] Check mobile responsiveness
- [ ] Verify form submission works

## 🚀 Step-by-Step Deployment

### 1. Prepare Your Repository
```bash
# Ensure all files are committed
git add .
git commit -m "Enhanced image handling and content accuracy"
git push origin main
```

### 2. Deploy Backend (Render)
1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `wayzo-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `Node`
5. Add environment variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `OPENAI_MODEL`: `gpt-4o-mini`
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
6. Click "Create Web Service"

### 3. Deploy Frontend (Vercel)
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `frontend`
   - **Build Command**: Leave empty
   - **Output Directory**: Leave empty
5. Add environment variable:
   - `REACT_APP_API_URL`: Your backend URL (e.g., `https://wayzo-backend.onrender.com`)
6. Click "Deploy"

### 4. Configure CORS
1. Update your backend `.env`:
   ```bash
   ORIGIN=https://your-vercel-domain.vercel.app
   ```
2. Redeploy backend if needed

## 🔍 Post-Deployment Testing

### Test Image Handling
1. Generate a Santorini trip plan
2. Verify images load properly
3. Check placeholder functionality
4. Test image fallbacks

### Test Interactive Elements
1. Click budget table checkboxes
2. Test packing list items (☐ ↔ ✅)
3. Verify no console errors
4. Check mobile responsiveness

### Test Content Accuracy
1. Verify Red Beach shows as "viewpoint only"
2. Check Oia Castle has no "Tickets" link
3. Confirm Santo Wines booking advice
4. Test KTEL bus information

## 🛠️ Troubleshooting

### Images Not Loading
- Check Unsplash API rate limits
- Verify image URLs are accessible
- Check browser console for errors

### Checkboxes Not Working
- Ensure JavaScript is enabled
- Check for console errors
- Verify CSS classes are loaded

### AI Not Responding
- Verify OpenAI API key is valid
- Check API usage limits
- Ensure model name is correct

### CORS Issues
- Verify `ORIGIN` environment variable
- Check frontend domain matches
- Ensure backend allows your domain

## 📊 Monitoring

### Backend Health Check
```bash
curl https://your-backend-url.com/health
```

### Logs
- Render: Dashboard → Your Service → Logs
- Railway: Dashboard → Your Service → Logs
- Vercel: Dashboard → Your Project → Functions → Logs

## 🔄 Updates

### Deploy Updates
```bash
# Make changes
git add .
git commit -m "Update description"
git push origin main

# Auto-deploy on Render/Railway/Vercel
```

### Environment Variable Updates
1. Go to your deployment platform
2. Update environment variables
3. Redeploy service

## 🎯 Success Metrics

After deployment, verify:
- ✅ Images load and display properly
- ✅ Checkboxes are interactive
- ✅ Santorini content is accurate
- ✅ Mobile responsive design
- ✅ PDF generation works
- ✅ No console errors
- ✅ Fast loading times

## 🆘 Support

If you encounter issues:
1. Check deployment logs
2. Verify environment variables
3. Test locally first
4. Check browser console for errors
5. Verify API keys are valid