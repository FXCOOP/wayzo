# Feature Branch Deployment Configuration
## Staging Environment Setup for Backend Development

**Branch**: `feature/backend-user-management-system`  
**Environment**: Staging/Development  
**Auto-Deploy**: Enabled  
**URL**: Will be provided after setup

---

## 🚀 Deployment Strategy

### **Current Setup**
- **Main Branch**: Production deployment (wayzo-trip-planner.onrender.com)
- **Feature Branch**: Staging deployment (wayzo-trip-planner-staging.onrender.com)
- **Auto-Deploy**: Every push to feature branch triggers staging deployment

### **Benefits**
- ✅ Test backend changes safely
- ✅ No impact on production
- ✅ Real environment testing
- ✅ Easy rollback capability

---

## 📋 Deployment Configuration Files

### **1. render.yaml (Updated for Feature Branch)**
```yaml
services:
  # Production Service (Main Branch)
  - type: web
    name: wayzo-trip-planner
    env: static
    buildCommand: echo "No build required for static site"
    staticPublishPath: ./frontend
    routes:
      - type: rewrite
        source: /*
        destination: /index.backend.html
    envVars:
      - key: NODE_ENV
        value: production
      - key: DEPLOYMENT_BRANCH
        value: main

  # Staging Service (Feature Branch)
  - type: web
    name: wayzo-trip-planner-staging
    env: static
    buildCommand: echo "No build required for static site"
    staticPublishPath: ./frontend
    routes:
      - type: rewrite
        source: /*
        destination: /index.backend.html
    envVars:
      - key: NODE_ENV
        value: staging
      - key: DEPLOYMENT_BRANCH
        value: feature/backend-user-management-system
      - key: BACKEND_URL
        value: https://wayzo-backend-staging.onrender.com

  # Backend Service (Feature Branch)
  - type: web
    name: wayzo-backend-staging
    env: node
    buildCommand: cd backend && npm install
    startCommand: cd backend && npm start
    envVars:
      - key: NODE_ENV
        value: staging
      - key: PORT
        value: 10000
      - key: JWT_SECRET
        generateValue: true
      - key: OPENAI_API_KEY
        sync: false
```

### **2. package.json (Updated Scripts)**
```json
{
  "scripts": {
    "start": "cd backend && node server.mjs",
    "dev": "cd backend && node server.mjs",
    "build": "echo 'No build step required for static site'",
    "deploy:staging": "echo 'Staging deployment: Push to feature branch'",
    "deploy:production": "echo 'Production deployment: Merge to main'",
    "test": "echo 'Run tests before deployment'"
  }
}
```

### **3. .env.example (Updated)**
```env
# Environment
NODE_ENV=staging
PORT=10000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Email Configuration (for staging)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Database Configuration
DATABASE_URL=./wayzo.sqlite

# Frontend URL (for CORS)
FRONTEND_URL=https://wayzo-trip-planner-staging.onrender.com

# Backend URL
BACKEND_URL=https://wayzo-backend-staging.onrender.com
```

---

## 🔧 Render.com Setup Instructions

### **Step 1: Create Staging Frontend Service**

1. **Go to Render Dashboard**
   - Visit [https://dashboard.render.com](https://dashboard.render.com)
   - Click "New +" → "Static Site"

2. **Connect Repository**
   - Choose "Connect a repository"
   - Select your `wayzo` repository
   - **Branch**: `feature/backend-user-management-system`

3. **Configure Service**
   - **Name**: `wayzo-trip-planner-staging`
   - **Build Command**: `echo "No build required"`
   - **Publish Directory**: `frontend`
   - **Auto-Deploy**: ✅ Enabled

### **Step 2: Create Staging Backend Service**

1. **Create Web Service**
   - Click "New +" → "Web Service"
   - Connect same repository
   - **Branch**: `feature/backend-user-management-system`

2. **Configure Backend**
   - **Name**: `wayzo-backend-staging`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Environment**: Node

3. **Add Environment Variables**
   - `NODE_ENV`: `staging`
   - `PORT`: `10000`
   - `JWT_SECRET`: (auto-generated)
   - `OPENAI_API_KEY`: (your key)

### **Step 3: Link Services**

1. **Update Frontend Configuration**
   - In frontend, update API endpoints to point to staging backend
   - Update CORS settings in backend

2. **Test Connection**
   - Verify frontend can connect to staging backend
   - Test API endpoints

---

## 🌐 Deployment URLs

### **After Setup**
- **Staging Frontend**: `https://wayzo-trip-planner-staging.onrender.com`
- **Staging Backend**: `https://wayzo-backend-staging.onrender.com`
- **Production**: `https://wayzo-trip-planner.onrender.com` (unchanged)

### **API Endpoints**
- **Staging**: `https://wayzo-backend-staging.onrender.com/api/*`
- **Production**: `https://wayzo-trip-planner.onrender.com/api/*`

---

## 🔄 Auto-Deployment Workflow

### **Development Flow**
```bash
# 1. Make changes on feature branch
git add .
git commit -m "feat: add user authentication"
git push origin feature/backend-user-management-system

# 2. Automatic staging deployment
# Render automatically deploys to staging

# 3. Test on staging
# Visit: https://wayzo-trip-planner-staging.onrender.com

# 4. When ready, merge to main
git checkout main
git merge feature/backend-user-management-system
git push origin main

# 5. Automatic production deployment
# Render automatically deploys to production
```

---

## 🧪 Testing Strategy

### **Staging Testing**
- ✅ Test all new backend features
- ✅ Verify API endpoints work
- ✅ Test user authentication
- ✅ Test plan creation and management
- ✅ Test email notifications
- ✅ Performance testing

### **Production Testing**
- ✅ Only after staging is verified
- ✅ Full integration testing
- ✅ Load testing
- ✅ Security testing

---

## 🛡️ Safety Measures

### **Staging Environment**
- ✅ Separate database
- ✅ Separate API keys
- ✅ No impact on production
- ✅ Easy rollback

### **Production Protection**
- ✅ Main branch only
- ✅ Staging approval required
- ✅ Automated testing
- ✅ Monitoring enabled

---

## 📊 Monitoring & Logs

### **Staging Monitoring**
- **Render Dashboard**: View staging service logs
- **Application Logs**: Backend logging system
- **Error Tracking**: Monitor for issues
- **Performance**: Track response times

### **Production Monitoring**
- **Same monitoring**: But for production
- **Alerting**: Set up alerts for issues
- **Backup**: Database backups

---

## 🎯 Success Criteria

### **Staging Success**
- [ ] Staging frontend deploys successfully
- [ ] Staging backend deploys successfully
- [ ] Frontend can connect to backend
- [ ] All features work on staging
- [ ] No breaking changes

### **Production Success**
- [ ] Staging thoroughly tested
- [ ] All tests pass
- [ ] Performance verified
- [ ] Security validated
- [ ] Smooth deployment

---

## 🚀 Next Steps

1. **Set up Render services** (staging frontend + backend)
2. **Configure environment variables**
3. **Test staging deployment**
4. **Begin development on feature branch**
5. **Auto-deploy to staging with each commit**
6. **Test thoroughly before production merge**

---

**This setup ensures safe, automated deployment of your backend development work to a staging environment where you can test everything before it affects production.**