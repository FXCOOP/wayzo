# 🚀 Wayzo Complete System Manual
## Beginner's Guide to Your Travel Planning Platform

---

## 📋 **Table of Contents**

1. [System Overview](#system-overview)
2. [Server Architecture](#server-architecture)
3. [Frontend Features](#frontend-features)
4. [Backend Features](#backend-features)
5. [Admin Dashboard](#admin-dashboard)
6. [API Documentation](#api-documentation)
7. [Deployment Guide](#deployment-guide)
8. [Testing & Troubleshooting](#testing--troubleshooting)
9. [Security Features](#security-features)
10. [Analytics & Reports](#analytics--reports)

---

## 🏗️ **System Overview**

### **What is Wayzo?**
Wayzo is a complete AI-powered travel planning platform that helps users create personalized trip itineraries. The system includes:

- **Frontend**: Modern web interface with multi-language support
- **Backend**: Node.js server with user management, analytics, and AI integration
- **Admin Dashboard**: Complete back office for business management
- **Analytics**: Comprehensive reporting and business intelligence
- **Security**: Enterprise-grade security and monitoring

### **Current Status**
- ✅ **Production**: `main` branch - Live system
- ✅ **Staging**: `staging` branch - Testing environment  
- ✅ **Development**: `feature/backend-user-management-system` - New features
- ✅ **Version**: `staging-v25` with complete backend system

---

## 🖥️ **Server Architecture**

### **Server Components**

#### **1. Frontend Server (Static Site)**
- **URL**: `https://wayzo-trip-planner-staging.onrender.com`
- **Purpose**: Main user interface
- **Technology**: HTML/CSS/JavaScript
- **Features**: Multi-language, responsive design, user authentication

#### **2. Backend Server (API)**
- **URL**: `https://wayzo-backend-staging.onrender.com`
- **Purpose**: API endpoints, user management, AI integration
- **Technology**: Node.js/Express/SQLite
- **Features**: Authentication, analytics, email system, admin functions

#### **3. Admin Dashboard**
- **URL**: `https://wayzo-backend-staging.onrender.com/admin`
- **Purpose**: Business management and analytics
- **Access**: Basic authentication (ADMIN_USER/ADMIN_PASS)
- **Features**: User management, reports, system monitoring

### **Server Status Check**
```bash
# Check frontend
curl https://wayzo-trip-planner-staging.onrender.com

# Check backend health
curl https://wayzo-backend-staging.onrender.com/healthz

# Check version
curl https://wayzo-backend-staging.onrender.com/version
```

---

## 🎨 **Frontend Features**

### **Main Application (`index.backend.html`)**

#### **1. Multi-Language Support**
- **10 Languages**: English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean
- **Language Selector**: Top-right corner
- **Persistent**: Saves language preference

#### **2. User Authentication**
- **Demo Mode**: Quick testing without registration
- **Email/Password**: Traditional login
- **Social Login**: Google, Facebook, Apple (placeholder)
- **Session Management**: Automatic login restoration

#### **3. Trip Planning Form**
- **Trip Type**: Single destination or Multi-destination
- **Destination Input**: Smart search with country suggestions
- **Date Flexibility**: Exact dates or flexible (best prices)
- **Budget Planning**: Multiple currencies supported
- **Traveler Details**: Adults and children with age inputs
- **Style Selection**: Budget, Mid-range, Luxury
- **Preferences**: Activities, dietary needs, special requirements

#### **4. Plan Generation**
- **Preview Mode**: Free preview with basic information
- **Full Plan**: Complete AI-generated itinerary ($19)
- **Real-time Generation**: Instant AI-powered plans
- **PDF Export**: Downloadable trip plans
- **Calendar Integration**: Add to calendar (.ics format)

#### **5. User Dashboard**
- **Profile Management**: Update personal information
- **Plan History**: View all generated plans
- **Referral System**: Share and earn rewards
- **Billing**: Payment history and management

### **Key Frontend Files**
```
frontend/
├── index.backend.html    # Main application
├── admin.html           # Admin dashboard
├── style.css            # Main stylesheet
├── admin.css            # Admin panel styles
├── app.js               # Main application logic
├── admin.js             # Admin panel logic
├── translations.js      # Multi-language support
└── assets/              # Images and icons
```

---

## ⚙️ **Backend Features**

### **Core Backend Components**

#### **1. User Management System**
```javascript
// User registration
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}

// User login
POST /api/auth/login
{
  "email": "user@example.com", 
  "password": "securepassword"
}
```

#### **2. Plan Management**
```javascript
// Create new plan
POST /api/plan
{
  "destination": "Paris, France",
  "start": "2025-06-01",
  "end": "2025-06-07",
  "budget": 2000,
  "adults": 2,
  "level": "mid"
}

// Get user's plans
GET /api/user/plans
```

#### **3. Analytics System**
```javascript
// Get system analytics
GET /api/admin/stats

// Get user analytics
GET /api/user/stats
```

### **Backend File Structure**
```
backend/
├── server.mjs           # Original server (preserved)
├── server-new.mjs       # New server with all features
├── lib/
│   ├── database.mjs     # Database schema
│   ├── user.mjs         # User management
│   ├── auth.mjs         # Authentication
│   ├── email.mjs        # Email service
│   ├── analytics.mjs    # Analytics system
│   ├── admin.mjs        # Admin functions
│   ├── security.mjs     # Security monitoring
│   ├── cache.mjs        # Caching system
│   ├── jobs.mjs         # Background jobs
│   └── api-docs.mjs     # API documentation
└── wayzo.sqlite         # Database file
```

### **Database Schema**
```sql
-- Core Tables
users                    # User accounts and profiles
plans                    # Travel plans with user association
user_sessions           # Active user sessions
user_logs               # Activity logging
user_analytics          # User behavior analytics
email_templates         # Email templates
email_logs              # Email delivery tracking
```

---

## 🏢 **Admin Dashboard**

### **Accessing Admin Panel**

#### **1. Via Web Interface**
1. Go to `https://wayzo-backend-staging.onrender.com/admin`
2. Enter credentials:
   - **Username**: `ADMIN_USER` (from environment)
   - **Password**: `ADMIN_PASS` (from environment)

#### **2. Via API**
```bash
# Get system statistics
curl -u "admin:password" \
  https://wayzo-backend-staging.onrender.com/api/admin/stats

# Get system logs
curl -u "admin:password" \
  https://wayzo-backend-staging.onrender.com/api/admin/logs
```

### **Admin Features**

#### **1. Dashboard Overview**
- **Total Users**: Registered user count
- **Total Plans**: Generated trip plans
- **Today's Activity**: Daily statistics
- **System Health**: Performance metrics
- **Revenue Tracking**: Payment analytics

#### **2. User Management**
- **View Users**: List all registered users
- **User Details**: Profile information and activity
- **Account Status**: Active, suspended, locked
- **User Analytics**: Behavior patterns and engagement

#### **3. Plan Management**
- **View Plans**: All generated trip plans
- **Plan Analytics**: Popular destinations, budgets
- **Plan Sharing**: Public/private plan management
- **Plan Statistics**: Creation trends and patterns

#### **4. System Monitoring**
- **Performance Metrics**: Response times, error rates
- **Security Events**: Suspicious activity, login attempts
- **System Logs**: Application and error logs
- **Database Health**: Query performance and storage

#### **5. Email Management**
- **Email Templates**: Manage email content
- **Email Campaigns**: Send bulk emails
- **Delivery Tracking**: Email success rates
- **Email Analytics**: Open rates and engagement

#### **6. Analytics & Reports**
- **User Growth**: Registration trends
- **Revenue Analytics**: Payment processing
- **Popular Destinations**: Most requested locations
- **User Retention**: Engagement metrics
- **Business Intelligence**: Predictive analytics

---

## 📚 **API Documentation**

### **Authentication Endpoints**

#### **User Registration**
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

#### **User Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### **Password Reset**
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### **User Management Endpoints**

#### **Get User Profile**
```http
GET /api/user/profile
Authorization: Bearer <jwt_token>
```

#### **Update Profile**
```http
PUT /api/user/profile
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Updated Name",
  "preferences": {"language": "en"}
}
```

#### **Get User Plans**
```http
GET /api/user/plans
Authorization: Bearer <jwt_token>
```

### **Plan Management Endpoints**

#### **Create Plan**
```http
POST /api/plan
Content-Type: application/json

{
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
}
```

#### **Get Plan by ID**
```http
GET /api/plan/:id
```

#### **Get Plan PDF**
```http
GET /api/plan/:id/pdf
```

### **Admin Endpoints**

#### **System Statistics**
```http
GET /api/admin/stats
Authorization: Basic <base64_credentials>
```

#### **System Logs**
```http
GET /api/admin/logs?limit=100&offset=0
Authorization: Basic <base64_credentials>
```

#### **User Management**
```http
GET /api/admin/users?limit=50&offset=0
Authorization: Basic <base64_credentials>
```

#### **Send Bulk Email**
```http
POST /api/admin/bulk-email
Authorization: Basic <base64_credentials>
Content-Type: application/json

{
  "subject": "Important Update",
  "template": "newsletter",
  "recipients": ["user1@example.com", "user2@example.com"]
}
```

### **System Endpoints**

#### **Health Check**
```http
GET /healthz
```

#### **Version Info**
```http
GET /version
```

#### **API Documentation**
```http
GET /api-docs
```

---

## 🚀 **Deployment Guide**

### **Environment Setup**

#### **1. Required Environment Variables**
```env
# Core Configuration
NODE_ENV=production
PORT=10000
JWT_SECRET=your-super-secret-jwt-key

# Database
DATABASE_URL=./wayzo.sqlite

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# URLs
FRONTEND_URL=https://wayzo-trip-planner-staging.onrender.com
BACKEND_URL=https://wayzo-backend-staging.onrender.com

# Admin Access
ADMIN_USER=admin
ADMIN_PASS=your-admin-password

# PayPal Configuration
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_MODE=sandbox

# Build Configuration
NPM_CONFIG_BUILD_FROM_SOURCE=false
```

#### **2. Gmail App Password Setup**
1. Enable 2-factor authentication on Gmail
2. Go to Google Account → Security → 2-Step Verification
3. Generate App Password for "Mail"
4. Use generated password in `EMAIL_PASS`

### **Render.com Deployment**

#### **1. Backend Service**
- **Repository**: `https://github.com/FXCOOP/wayzo`
- **Branch**: `feature/backend-user-management-system`
- **Build Command**: `npm ci --prefix backend`
- **Start Command**: `node backend/server.mjs`
- **Environment**: Set all required variables

#### **2. Frontend Service**
- **Repository**: `https://github.com/FXCOOP/wayzo`
- **Branch**: `feature/backend-user-management-system`
- **Build Command**: `echo "No build required"`
- **Publish Directory**: `frontend`
- **Environment**: Set `BACKEND_URL`

### **Local Development**

#### **1. Setup Local Environment**
```bash
# Clone repository
git clone https://github.com/FXCOOP/wayzo.git
cd wayzo

# Install dependencies
npm install

# Copy environment file
cp backend/.env.example backend/.env

# Edit environment variables
nano backend/.env
```

#### **2. Initialize Database**
```bash
# Initialize database schema
node -e "import('./backend/lib/database.mjs').then(db => db.initializeDatabase())"
```

#### **3. Start Development Server**
```bash
# Start backend server
cd backend
node server.mjs

# Start frontend (in another terminal)
cd frontend
python3 -m http.server 8000
```

---

## 🧪 **Testing & Troubleshooting**

### **System Testing**

#### **1. Health Check**
```bash
# Test backend health
curl https://wayzo-backend-staging.onrender.com/healthz

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-09-03T...",
  "version": "staging-v25"
}
```

#### **2. API Testing**
```bash
# Test user registration
curl -X POST https://wayzo-backend-staging.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Test plan creation
curl -X POST https://wayzo-backend-staging.onrender.com/api/plan \
  -H "Content-Type: application/json" \
  -d '{"destination":"Paris","start":"2025-06-01","end":"2025-06-07","budget":2000,"adults":2}'
```

#### **3. Frontend Testing**
```bash
# Test frontend accessibility
curl https://wayzo-trip-planner-staging.onrender.com

# Test admin panel
curl -u "admin:password" https://wayzo-backend-staging.onrender.com/admin
```

### **Common Issues & Solutions**

#### **1. Image Loading Issues**
**Problem**: Images show "Image loading..." text
**Solution**: 
- Check image URLs in browser console
- Verify Unsplash/Picsum services are accessible
- Check network connectivity

#### **2. Authentication Issues**
**Problem**: Users can't log in
**Solution**:
- Verify JWT_SECRET is set correctly
- Check database connection
- Clear browser cache and localStorage

#### **3. Plan Generation Fails**
**Problem**: AI doesn't generate plans
**Solution**:
- Verify OPENAI_API_KEY is valid
- Check API quota and billing
- Review server logs for errors

#### **4. Email Not Sending**
**Problem**: Users don't receive emails
**Solution**:
- Verify EMAIL_USER and EMAIL_PASS
- Check Gmail app password setup
- Review email logs in admin panel

#### **5. Admin Panel Access**
**Problem**: Can't access admin dashboard
**Solution**:
- Verify ADMIN_USER and ADMIN_PASS
- Check basic authentication headers
- Clear browser cache

### **Debug Mode**
```javascript
// Enable debug logging in browser
localStorage.setItem('wayzo_debug', 'true');

// Check server logs
tail -f backend/logs/app.log
```

---

## 🔒 **Security Features**

### **Authentication Security**
- **JWT Tokens**: Secure token-based authentication
- **Password Hashing**: bcrypt with 12 rounds
- **Session Management**: Automatic expiration and refresh
- **Rate Limiting**: Login attempt protection

### **Data Protection**
- **Input Validation**: Server-side validation
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Input sanitization
- **CSRF Protection**: Token-based protection

### **Monitoring & Alerts**
- **Suspicious Activity Detection**: Automated monitoring
- **IP Blocking**: Automatic blocking of malicious IPs
- **Account Lockout**: Temporary lockouts after failed attempts
- **Security Logging**: Comprehensive security event tracking

### **Security Best Practices**
1. **Strong Passwords**: Enforce password complexity
2. **HTTPS Only**: All communications encrypted
3. **Regular Updates**: Keep dependencies updated
4. **Access Control**: Role-based permissions
5. **Audit Logging**: Track all security events

---

## 📊 **Analytics & Reports**

### **User Analytics**

#### **1. User Growth Metrics**
- **Total Users**: Cumulative user registration
- **New Users**: Daily/weekly/monthly registrations
- **Active Users**: Users with recent activity
- **User Retention**: Return visit rates

#### **2. User Behavior Analytics**
- **Session Duration**: Time spent on platform
- **Page Views**: Most visited pages
- **Feature Usage**: Which features are used most
- **Conversion Rates**: Preview to full plan conversion

#### **3. User Segmentation**
- **Geographic**: Users by location
- **Demographic**: Age, travel preferences
- **Behavioral**: Usage patterns and preferences
- **Value**: High-value vs. low-value users

### **Plan Analytics**

#### **1. Plan Creation Metrics**
- **Total Plans**: All generated plans
- **Plans by Destination**: Popular locations
- **Budget Distribution**: Average and range of budgets
- **Seasonal Trends**: Plans by time of year

#### **2. Plan Engagement**
- **Plan Views**: How often plans are viewed
- **Plan Sharing**: Social sharing statistics
- **Plan Downloads**: PDF download rates
- **Plan Completion**: Full plan vs. preview usage

### **Business Intelligence**

#### **1. Revenue Analytics**
- **Payment Processing**: Successful vs. failed payments
- **Revenue Trends**: Monthly/quarterly revenue
- **Average Order Value**: Revenue per plan
- **Payment Methods**: Preferred payment options

#### **2. Performance Metrics**
- **System Performance**: Response times and uptime
- **Error Rates**: Application error tracking
- **User Satisfaction**: Based on usage patterns
- **Growth Forecasting**: Predictive analytics

### **Report Generation**

#### **1. Automated Reports**
- **Daily Reports**: Key metrics summary
- **Weekly Reports**: Trend analysis
- **Monthly Reports**: Comprehensive business review
- **Custom Reports**: On-demand analytics

#### **2. Report Types**
- **User Reports**: User growth and behavior
- **Revenue Reports**: Financial performance
- **Technical Reports**: System health and performance
- **Marketing Reports**: Campaign effectiveness

### **Data Export**
```bash
# Export user data
curl -u "admin:password" \
  https://wayzo-backend-staging.onrender.com/api/admin/export/users

# Export plan data
curl -u "admin:password" \
  https://wayzo-backend-staging.onrender.com/api/admin/export/plans

# Export analytics
curl -u "admin:password" \
  https://wayzo-backend-staging.onrender.com/api/admin/export/analytics
```

---

## 🎯 **Quick Start Checklist**

### **For New Users**
- [ ] Visit `https://wayzo-trip-planner-staging.onrender.com`
- [ ] Try demo mode or create account
- [ ] Fill out trip planning form
- [ ] Generate preview plan
- [ ] Purchase full plan ($19)
- [ ] Download PDF or add to calendar

### **For Administrators**
- [ ] Access admin panel: `/admin`
- [ ] Review system statistics
- [ ] Check user management
- [ ] Monitor system logs
- [ ] Generate reports
- [ ] Configure email campaigns

### **For Developers**
- [ ] Set up local environment
- [ ] Configure environment variables
- [ ] Initialize database
- [ ] Run system tests
- [ ] Start development servers
- [ ] Test API endpoints

---

## 📞 **Support & Maintenance**

### **System Monitoring**
- **Health Checks**: Automatic monitoring of all services
- **Performance Alerts**: Notifications for performance issues
- **Error Tracking**: Comprehensive error logging and alerting
- **Uptime Monitoring**: 24/7 system availability tracking

### **Backup & Recovery**
- **Database Backups**: Daily automated backups
- **File Backups**: Regular backup of configuration files
- **Disaster Recovery**: Complete system recovery procedures
- **Data Retention**: Automated data cleanup and archiving

### **Maintenance Schedule**
- **Daily**: Health checks and error monitoring
- **Weekly**: Performance optimization and log rotation
- **Monthly**: Security updates and dependency updates
- **Quarterly**: Comprehensive system review and optimization

### **Contact Information**
- **Technical Support**: Check admin panel for system status
- **Bug Reports**: Use admin panel logging system
- **Feature Requests**: Document in project issues
- **Emergency**: Contact system administrator

---

## 🚀 **Future Enhancements**

### **Planned Features**
- **Real-time Notifications**: WebSocket-based notifications
- **Social Features**: Plan sharing and comments
- **Mobile App**: Native iOS and Android applications
- **Advanced AI**: More sophisticated trip planning
- **Multi-currency**: Support for all major currencies
- **Advanced Analytics**: Real-time business intelligence

### **Scalability Improvements**
- **PostgreSQL Migration**: Enterprise database
- **Redis Caching**: High-performance caching
- **Microservices**: Distributed architecture
- **Load Balancing**: Horizontal scaling
- **CDN Integration**: Global content delivery

### **Enterprise Features**
- **Multi-tenancy**: White-label solutions
- **Advanced Security**: Enterprise-grade security
- **API Rate Limiting**: Tiered API access
- **Custom Branding**: White-label customization
- **Advanced Reporting**: Custom report builder

---

**🎉 Congratulations!** You now have a complete understanding of the Wayzo travel planning system. This comprehensive platform includes everything needed to run a successful travel planning business with advanced analytics, security, and user management capabilities.

**Need Help?** Use the admin panel for system monitoring and check the troubleshooting section for common issues.