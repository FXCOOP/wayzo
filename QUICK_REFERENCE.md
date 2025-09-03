# 🚀 Wayzo Quick Reference Guide
## Essential Information for Immediate Use

---

## 🌐 **Live URLs**

### **Production Servers**
- **Frontend**: `https://wayzo-trip-planner-staging.onrender.com`
- **Backend**: `https://wayzo-backend-staging.onrender.com`
- **Admin Panel**: `https://wayzo-backend-staging.onrender.com/admin`

### **Health Checks**
```bash
# Backend health
curl https://wayzo-backend-staging.onrender.com/healthz

# Version info
curl https://wayzo-backend-staging.onrender.com/version

# API docs
curl https://wayzo-backend-staging.onrender.com/api-docs
```

---

## 🔑 **Admin Access**

### **Admin Panel Login**
- **URL**: `https://wayzo-backend-staging.onrender.com/admin`
- **Username**: `ADMIN_USER` (from environment variables)
- **Password**: `ADMIN_PASS` (from environment variables)

### **Admin API Access**
```bash
# Get system stats
curl -u "admin:password" https://wayzo-backend-staging.onrender.com/api/admin/stats

# Get system logs
curl -u "admin:password" https://wayzo-backend-staging.onrender.com/api/admin/logs

# Get users
curl -u "admin:password" https://wayzo-backend-staging.onrender.com/api/admin/users
```

---

## 👥 **User Management**

### **User Registration**
```bash
curl -X POST https://wayzo-backend-staging.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

### **User Login**
```bash
curl -X POST https://wayzo-backend-staging.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

---

## 🗺️ **Plan Management**

### **Create Trip Plan**
```bash
curl -X POST https://wayzo-backend-staging.onrender.com/api/plan \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "Paris, France",
    "start": "2025-06-01",
    "end": "2025-06-07",
    "budget": 2000,
    "currency": "USD",
    "adults": 2,
    "children": 0,
    "level": "mid",
    "prefs": "museums, food",
    "dietary": ["vegetarian"]
  }'
```

### **Get Plan PDF**
```bash
curl https://wayzo-backend-staging.onrender.com/api/plan/{plan_id}/pdf
```

---

## 📊 **Analytics & Reports**

### **System Analytics**
```bash
# Get overall stats
curl -u "admin:password" https://wayzo-backend-staging.onrender.com/api/admin/stats

# Get user analytics
curl -u "admin:password" https://wayzo-backend-staging.onrender.com/api/admin/analytics/users

# Get plan analytics
curl -u "admin:password" https://wayzo-backend-staging.onrender.com/api/admin/analytics/plans
```

### **Export Data**
```bash
# Export users
curl -u "admin:password" https://wayzo-backend-staging.onrender.com/api/admin/export/users

# Export plans
curl -u "admin:password" https://wayzo-backend-staging.onrender.com/api/admin/export/plans
```

---

## 🔧 **System Management**

### **Environment Variables Required**
```env
NODE_ENV=production
PORT=10000
JWT_SECRET=your-super-secret-jwt-key
DATABASE_URL=./wayzo.sqlite
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
OPENAI_API_KEY=your-openai-api-key
FRONTEND_URL=https://wayzo-trip-planner-staging.onrender.com
BACKEND_URL=https://wayzo-backend-staging.onrender.com
ADMIN_USER=admin
ADMIN_PASS=your-admin-password
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_MODE=sandbox
NPM_CONFIG_BUILD_FROM_SOURCE=false
```

### **Database Commands**
```bash
# Initialize database
node -e "import('./backend/lib/database.mjs').then(db => db.initializeDatabase())"

# Test system
cd backend && node test-system.mjs

# Run complete test
./test-complete-system.sh
```

---

## 🚨 **Troubleshooting**

### **Common Issues**

#### **1. Images Not Loading**
- Check browser console for errors
- Verify Unsplash/Picsum services
- Check network connectivity

#### **2. Authentication Fails**
- Verify JWT_SECRET is set
- Check database connection
- Clear browser cache

#### **3. Plan Generation Fails**
- Verify OPENAI_API_KEY
- Check API quota
- Review server logs

#### **4. Email Not Sending**
- Verify EMAIL_USER/EMAIL_PASS
- Check Gmail app password
- Review email logs

#### **5. Admin Panel Access**
- Verify ADMIN_USER/ADMIN_PASS
- Check basic auth headers
- Clear browser cache

### **Debug Commands**
```bash
# Enable debug mode
localStorage.setItem('wayzo_debug', 'true');

# Check server logs
tail -f backend/logs/app.log

# Test health endpoint
curl https://wayzo-backend-staging.onrender.com/healthz
```

---

## 📚 **Documentation**

### **Complete Documentation**
- **System Manual**: `docs/COMPLETE_SYSTEM_MANUAL.md`
- **Backend Guide**: `backend/IMPLEMENTATION_GUIDE.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **API Docs**: `https://wayzo-backend-staging.onrender.com/api-docs`

### **Key Features**
- ✅ **User Management**: Registration, login, profiles
- ✅ **Plan Generation**: AI-powered trip planning
- ✅ **Admin Dashboard**: Complete business management
- ✅ **Analytics**: User growth, revenue, performance
- ✅ **Email System**: Welcome emails, notifications
- ✅ **Security**: JWT auth, rate limiting, monitoring
- ✅ **Multi-language**: 10 languages supported
- ✅ **Mobile Responsive**: Works on all devices

---

## 🎯 **Quick Start**

### **For Users**
1. Visit `https://wayzo-trip-planner-staging.onrender.com`
2. Try demo mode or create account
3. Fill trip planning form
4. Generate preview plan
5. Purchase full plan ($19)
6. Download PDF or add to calendar

### **For Admins**
1. Access `https://wayzo-backend-staging.onrender.com/admin`
2. Review system statistics
3. Manage users and plans
4. Monitor system logs
5. Generate reports
6. Configure email campaigns

### **For Developers**
1. Set up local environment
2. Configure environment variables
3. Initialize database
4. Run system tests
5. Start development servers
6. Test API endpoints

---

## 📞 **Support**

### **System Status**
- **Health Check**: `https://wayzo-backend-staging.onrender.com/healthz`
- **Version Info**: `https://wayzo-backend-staging.onrender.com/version`
- **API Docs**: `https://wayzo-backend-staging.onrender.com/api-docs`

### **Emergency Contacts**
- **Technical Issues**: Check admin panel logs
- **User Support**: Use admin panel user management
- **System Monitoring**: Admin dashboard analytics

---

**🎉 Your Wayzo system is ready!** 

This comprehensive travel planning platform includes everything needed to run a successful business with advanced analytics, security, and user management capabilities.