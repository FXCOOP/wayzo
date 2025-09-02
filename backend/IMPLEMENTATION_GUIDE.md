# TripMaster AI Backend - Implementation Guide

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Navigate to backend directory
cd backend

# Copy environment file
cp .env.example .env

# Edit environment variables
nano .env
```

### 2. Configure Environment Variables

Edit `.env` file with your values:

```env
# Environment
NODE_ENV=development
PORT=10000

# JWT Configuration (CHANGE THIS!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password

# Database Configuration
DATABASE_URL=./wayzo.sqlite

# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:10000
```

### 3. Initialize Database

```bash
# Initialize database schema
node -e "import('./lib/database.mjs').then(db => db.initializeDatabase())"
```

### 4. Test System

```bash
# Run system tests
node test-system.mjs
```

### 5. Start Server

```bash
# Start the new server
node server-new.mjs
```

## 🔧 Configuration Details

### Email Setup (Gmail)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use the generated password in `EMAIL_PASS`

### Database Setup

The system uses SQLite by default. Tables are created automatically:
- `users` - User accounts and profiles
- `plans` - Travel plans with user association
- `user_sessions` - Active user sessions
- `user_logs` - Activity logging
- `user_analytics` - User behavior analytics
- `email_templates` - Email templates
- `email_logs` - Email delivery tracking

## 🧪 Testing the System

### API Testing

```bash
# Test health endpoint
curl http://localhost:10000/healthz

# Test user registration
curl -X POST http://localhost:10000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Test user login
curl -X POST http://localhost:10000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Using the Test Script

```bash
# Run comprehensive tests
node test-system.mjs
```

## 📊 Available Features

### User Management
- ✅ User registration and login
- ✅ Password reset functionality
- ✅ Profile management
- ✅ Account status management

### Plan Management
- ✅ Create AI-powered travel plans
- ✅ User-specific plan storage
- ✅ Plan privacy controls
- ✅ Plan sharing and discovery

### Security Features
- ✅ JWT authentication
- ✅ Rate limiting
- ✅ Password hashing
- ✅ Input validation

### Analytics & Monitoring
- ✅ User activity tracking
- ✅ System performance monitoring
- ✅ Business intelligence
- ✅ Security monitoring

### Email System
- ✅ Welcome emails
- ✅ Password reset emails
- ✅ Plan notifications
- ✅ Weekly digests

### Admin Dashboard
- ✅ User management
- ✅ System statistics
- ✅ Security monitoring
- ✅ Email campaigns

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `PUT /api/user/change-password` - Change password
- `GET /api/user/activity` - Get user activity
- `GET /api/user/stats` - Get user statistics

### Plan Management
- `GET /api/user/plans` - Get user's plans
- `DELETE /api/user/plans/:id` - Delete plan
- `PUT /api/user/plans/:id/visibility` - Update plan visibility
- `GET /api/plans/public` - Get public plans
- `POST /api/plan` - Create new plan
- `GET /api/plan/:id` - Get plan by ID

### Admin Functions
- `GET /api/admin/stats` - System statistics
- `GET /api/admin/logs` - System logs
- `GET /api/admin/security` - Security events

### System
- `GET /healthz` - Health check
- `GET /version` - System version
- `GET /api-docs` - API documentation

## 🚀 Deployment

### Development
```bash
# Start development server
node server-new.mjs
```

### Production
```bash
# Set NODE_ENV=production
export NODE_ENV=production

# Start production server
node server-new.mjs
```

### Environment Variables for Production
```env
NODE_ENV=production
JWT_SECRET=your-production-jwt-secret
EMAIL_USER=your-production-email
EMAIL_PASS=your-production-email-password
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://api.your-domain.com
```

## 🔒 Security Checklist

- [ ] Change default JWT secret
- [ ] Configure secure email credentials
- [ ] Set up HTTPS in production
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable security headers
- [ ] Configure database backups
- [ ] Set up monitoring and alerts

## 📈 Monitoring

### Health Check
```bash
curl http://localhost:10000/healthz
```

### System Stats
```bash
curl http://localhost:10000/api/admin/stats
```

### Logs
```bash
curl http://localhost:10000/api/admin/logs
```

## 🛠️ Troubleshooting

### Common Issues

1. **Email not sending**
   - Check Gmail app password
   - Verify email credentials in .env
   - Check email service logs

2. **Database errors**
   - Run database initialization
   - Check file permissions
   - Verify database path

3. **Authentication issues**
   - Check JWT secret
   - Verify token expiration
   - Check user status

4. **Server not starting**
   - Check port availability
   - Verify environment variables
   - Check for missing dependencies

### Debug Mode

```bash
# Enable debug logging
export DEBUG=*
node server-new.mjs
```

## 📚 Documentation

- API Documentation: `http://localhost:10000/api-docs`
- Implementation Guide: `docs/COMPLETE_BACKEND_IMPLEMENTATION.md`
- Architecture Overview: `docs/ARCHITECTURE.md`

## 🎯 Next Steps

1. **Test all features** thoroughly
2. **Configure email service** for notifications
3. **Set up monitoring** and alerts
4. **Deploy to staging** environment
5. **Test with frontend** integration
6. **Deploy to production** when ready

---

**🎉 Your TripMaster AI backend system is now ready to use!**