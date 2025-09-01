# TripMaster AI - Backend Implementation Guide
## Complete Step-by-Step Plan for Solo Developer with Limited Budget

**Version**: 1.0  
**Target**: Solo developer, minimal budget, production-ready system  
**Timeline**: 3 weeks to MVP, 6 weeks to full system  

---

## 📋 Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Week 1: User Authentication System](#week-1-user-authentication-system)
3. [Week 2: User-Plan Integration](#week-2-user-plan-integration)
4. [Week 3: Logging & Analytics](#week-3-logging--analytics)
5. [Week 4-6: Advanced Features](#week-4-6-advanced-features)
6. [Security Checklist](#security-checklist)
7. [Deployment Guide](#deployment-guide)
8. [Budget Breakdown](#budget-breakdown)
9. [Troubleshooting](#troubleshooting)

---

## 🔍 Current State Analysis

### What You Have (✅)
- Express.js server with SQLite database
- Plan creation and storage system
- OpenAI integration for travel planning
- Basic security (helmet, rate limiting)
- File upload functionality
- PDF generation capability
- ICS calendar export

### What You Need (❌)
- User registration and authentication
- User-specific plan management
- Basic logging and analytics
- Email notifications
- Enhanced security

### Technology Stack (Minimal Budget)
- **Backend**: Node.js + Express.js (existing)
- **Database**: SQLite (existing) → PostgreSQL (when needed)
- **Authentication**: JWT + bcrypt
- **Email**: Nodemailer + Gmail (free tier)
- **Hosting**: Render/Railway (free tier) → VPS ($5-10/month)
- **Monitoring**: Basic logging + simple dashboard

---

## 🚀 Week 1: User Authentication System

### Day 1: Database Schema Setup

#### Step 1.1: Install Required Dependencies
```bash
cd backend
npm install bcryptjs jsonwebtoken express-validator
```

#### Step 1.2: Create Database Schema
Create file: `backend/lib/database.mjs`

```javascript
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '..', 'wayzo.sqlite'));

// Initialize database schema
export function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TEXT NOT NULL,
      last_login TEXT,
      status TEXT DEFAULT 'active',
      email_verified BOOLEAN DEFAULT false,
      verification_token TEXT
    )
  `);

  // Update plans table to link with users
  db.exec(`
    ALTER TABLE plans ADD COLUMN user_id TEXT REFERENCES users(id);
  `);
  
  db.exec(`
    ALTER TABLE plans ADD COLUMN is_public BOOLEAN DEFAULT false;
  `);

  // User sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT
    )
  `);

  console.log('Database schema initialized');
}

export default db;
```

#### Step 1.3: Update Main Server File
Add to `backend/server.mjs`:

```javascript
import { initializeDatabase } from './lib/database.mjs';

// Initialize database after imports
initializeDatabase();
```

### Day 2: User Registration System

#### Step 2.1: Create User Model
Create file: `backend/lib/user.mjs`

```javascript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './database.mjs';

export class UserModel {
  static async createUser(email, password, name = '') {
    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, name, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    try {
      stmt.run(id, email.toLowerCase(), passwordHash, name, now);
      return { id, email, name };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Email already exists');
      }
      throw error;
    }
  }

  static async findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email.toLowerCase());
  }

  static async findById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  }

  static async verifyPassword(user, password) {
    return bcrypt.compare(password, user.password_hash);
  }

  static generateToken(userId) {
    return jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return null;
    }
  }
}
```

#### Step 2.2: Create Authentication Middleware
Create file: `backend/lib/auth.mjs`

```javascript
import { UserModel } from './user.mjs';

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const decoded = UserModel.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.userId = decoded.userId;
  next();
}

export function optionalAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    const decoded = UserModel.verifyToken(token);
    if (decoded) {
      req.userId = decoded.userId;
    }
  }
  
  next();
}
```

#### Step 2.3: Add Registration Endpoint
Add to `backend/server.mjs`:

```javascript
import { body, validationResult } from 'express-validator';
import { UserModel } from './lib/user.mjs';

// Registration endpoint
app.post('/api/auth/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').optional().trim().isLength({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password, name } = req.body;
    const user = await UserModel.createUser(email, password, name);
    const token = UserModel.generateToken(user.id);
    
    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});
```

### Day 3: User Login System

#### Step 3.1: Add Login Endpoint
Add to `backend/server.mjs`:

```javascript
// Login endpoint
app.post('/api/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    const user = await UserModel.findByEmail(email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await UserModel.verifyPassword(user, password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    const updateStmt = db.prepare('UPDATE users SET last_login = ? WHERE id = ?');
    updateStmt.run(new Date().toISOString(), user.id);

    const token = UserModel.generateToken(user.id);
    
    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});
```

### Day 4: Protected Routes

#### Step 4.1: Add Authentication to Existing Endpoints
Update your existing endpoints in `backend/server.mjs`:

```javascript
import { authMiddleware, optionalAuthMiddleware } from './lib/auth.mjs';

// Make plan creation require authentication
app.post('/api/plan', authMiddleware, async (req, res) => {
  // ... existing code ...
  const payload = req.body || {};
  payload.budget = normalizeBudget(payload.budget, payload.currency);
  const id = uid();
  const markdown = await generatePlanWithAI(payload);
  const html = marked.parse(markdown);
  const aff = affiliatesFor(payload.destination);
  
  // Save plan with user ID
  savePlan.run(id, nowIso(), JSON.stringify({ 
    id, 
    type: 'plan', 
    data: payload, 
    markdown,
    user_id: req.userId 
  }));
  
  res.json({ id, markdown, html, affiliates: aff, version: VERSION });
});

// Allow public access to plan viewing but track user if authenticated
app.get('/api/plan/:id', optionalAuthMiddleware, (req, res) => {
  const { id } = req.params;
  const row = getPlan.get(id);
  if (!row) return res.status(404).json({ error: 'Plan not found' });
  
  const saved = JSON.parse(row.payload || '{}');
  
  // Log access if user is authenticated
  if (req.userId) {
    const logStmt = db.prepare(`
      INSERT INTO user_logs (id, user_id, action, details, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    logStmt.run(
      crypto.randomUUID(),
      req.userId,
      'plan_view',
      JSON.stringify({ plan_id: id }),
      req.ip,
      req.get('User-Agent'),
      new Date().toISOString()
    );
  }
  
  res.json(saved);
});
```

### Day 5: User Profile Management

#### Step 5.1: Add Profile Endpoints
Add to `backend/server.mjs`:

```javascript
// Get user profile
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
      last_login: user.last_login
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
app.put('/api/user/profile', authMiddleware, [
  body('name').optional().trim().isLength({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name } = req.body;
    const updateStmt = db.prepare('UPDATE users SET name = ? WHERE id = ?');
    updateStmt.run(name, req.userId);
    
    res.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});
```

### Day 6-7: Testing & Security

#### Step 6.1: Add Environment Variables
Update your `.env` file:

```env
# Add these to your existing .env file
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
```

#### Step 6.2: Add Basic Security Headers
Update your helmet configuration in `backend/server.mjs`:

```javascript
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## 🔗 Week 2: User-Plan Integration

### Day 1-2: Plan Management System

#### Step 2.1: Create Plan Management Endpoints
Add to `backend/server.mjs`:

```javascript
// Get user's plans
app.get('/api/user/plans', authMiddleware, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT id, created_at, payload 
      FROM plans 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `);
    
    const plans = stmt.all(req.userId).map(row => {
      const data = JSON.parse(row.payload);
      return {
        id: row.id,
        created_at: row.created_at,
        destination: data.data?.destination,
        start_date: data.data?.start,
        end_date: data.data?.end,
        budget: data.data?.budget,
        travelers: data.data?.adults + (data.data?.children || 0)
      };
    });
    
    res.json({ plans });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

// Delete user's plan
app.delete('/api/user/plans/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify plan belongs to user
    const plan = getPlan.get(id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const planData = JSON.parse(plan.payload);
    if (planData.user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const deleteStmt = db.prepare('DELETE FROM plans WHERE id = ?');
    deleteStmt.run(id);
    
    res.json({ success: true, message: 'Plan deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete plan' });
  }
});
```

### Day 3-4: Plan Sharing & Privacy

#### Step 3.1: Add Plan Sharing Functionality
Add to `backend/server.mjs`:

```javascript
// Make plan public/private
app.put('/api/user/plans/:id/visibility', authMiddleware, [
  body('is_public').isBoolean()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { id } = req.params;
    const { is_public } = req.body;
    
    // Verify plan belongs to user
    const plan = getPlan.get(id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    const planData = JSON.parse(plan.payload);
    if (planData.user_id !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const updateStmt = db.prepare('UPDATE plans SET is_public = ? WHERE id = ?');
    updateStmt.run(is_public, id);
    
    res.json({ success: true, message: `Plan made ${is_public ? 'public' : 'private'}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update plan visibility' });
  }
});

// Get public plans (for discovery)
app.get('/api/plans/public', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT p.id, p.created_at, p.payload, u.name as creator_name
      FROM plans p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_public = true
      ORDER BY p.created_at DESC
      LIMIT 20
    `);
    
    const plans = stmt.all().map(row => {
      const data = JSON.parse(row.payload);
      return {
        id: row.id,
        created_at: row.created_at,
        destination: data.data?.destination,
        start_date: data.data?.start,
        end_date: data.data?.end,
        budget: data.data?.budget,
        travelers: data.data?.adults + (data.data?.children || 0),
        creator_name: row.creator_name
      };
    });
    
    res.json({ plans });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get public plans' });
  }
});
```

### Day 5-7: Enhanced Plan Features

#### Step 5.1: Add Plan Analytics
Add to `backend/server.mjs`:

```javascript
// Get plan statistics
app.get('/api/user/plans/stats', authMiddleware, (req, res) => {
  try {
    const statsStmt = db.prepare(`
      SELECT 
        COUNT(*) as total_plans,
        COUNT(CASE WHEN is_public = true THEN 1 END) as public_plans,
        COUNT(CASE WHEN is_public = false THEN 1 END) as private_plans
      FROM plans 
      WHERE user_id = ?
    `);
    
    const stats = statsStmt.get(req.userId);
    
    // Get most popular destinations
    const destStmt = db.prepare(`
      SELECT 
        json_extract(payload, '$.data.destination') as destination,
        COUNT(*) as count
      FROM plans 
      WHERE user_id = ?
      GROUP BY destination
      ORDER BY count DESC
      LIMIT 5
    `);
    
    const destinations = destStmt.all(req.userId);
    
    res.json({ stats, destinations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});
```

---

## 📊 Week 3: Logging & Analytics

### Day 1-2: Basic Logging System

#### Step 3.1: Create Logging System
Create file: `backend/lib/logger.mjs`

```javascript
import db from './database.mjs';

export class Logger {
  static async log(userId, action, details = {}, req = null) {
    try {
      const logStmt = db.prepare(`
        INSERT INTO user_logs (id, user_id, action, details, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      logStmt.run(
        crypto.randomUUID(),
        userId,
        action,
        JSON.stringify(details),
        req?.ip || null,
        req?.get('User-Agent') || null,
        new Date().toISOString()
      );
    } catch (error) {
      console.error('Logging error:', error);
    }
  }

  static async getUserActivity(userId, limit = 50) {
    const stmt = db.prepare(`
      SELECT action, details, created_at, ip_address
      FROM user_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    return stmt.all(userId, limit);
  }

  static async getSystemStats() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_actions,
        COUNT(CASE WHEN action = 'plan_create' THEN 1 END) as plans_created,
        COUNT(CASE WHEN action = 'plan_view' THEN 1 END) as plans_viewed
      FROM user_logs
      WHERE created_at >= datetime('now', '-7 days')
    `);
    
    return stmt.get();
  }
}
```

#### Step 3.2: Add Logging to Existing Endpoints
Update your endpoints to include logging:

```javascript
import { Logger } from './lib/logger.mjs';

// Update plan creation endpoint
app.post('/api/plan', authMiddleware, async (req, res) => {
  try {
    // ... existing plan creation code ...
    
    // Log the action
    await Logger.log(req.userId, 'plan_create', {
      plan_id: id,
      destination: payload.destination,
      budget: payload.budget
    }, req);
    
    res.json({ id, markdown, html, affiliates: aff, version: VERSION });
  } catch (error) {
    console.error('Plan generation error:', error);
    res.status(500).json({ error: 'Failed to generate plan' });
  }
});

// Add user activity endpoint
app.get('/api/user/activity', authMiddleware, async (req, res) => {
  try {
    const activity = await Logger.getUserActivity(req.userId);
    res.json({ activity });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get activity' });
  }
});
```

### Day 3-4: Simple Analytics Dashboard

#### Step 3.1: Create Admin Endpoints
Add to `backend/server.mjs`:

```javascript
// Simple admin dashboard (basic stats)
app.get('/api/admin/stats', (req, res) => {
  try {
    // Get basic system stats
    const userCountStmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const planCountStmt = db.prepare('SELECT COUNT(*) as count FROM plans');
    const recentUsersStmt = db.prepare(`
      SELECT id, email, name, created_at, last_login
      FROM users
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    const userCount = userCountStmt.get().count;
    const planCount = planCountStmt.get().count;
    const recentUsers = recentUsersStmt.all();
    
    // Get activity stats
    const activityStats = await Logger.getSystemStats();
    
    res.json({
      users: {
        total: userCount,
        recent: recentUsers
      },
      plans: {
        total: planCount
      },
      activity: activityStats
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});
```

### Day 5-7: Email Notifications

#### Step 5.1: Add Email System
Install nodemailer:
```bash
npm install nodemailer
```

Create file: `backend/lib/email.mjs`

```javascript
import nodemailer from 'nodemailer';

export class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // Use app password for Gmail
      }
    });
  }

  async sendWelcomeEmail(user) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Welcome to TripMaster AI!',
      html: `
        <h1>Welcome to TripMaster AI!</h1>
        <p>Hi ${user.name || 'there'},</p>
        <p>Thank you for joining TripMaster AI. Start creating your perfect travel plans today!</p>
        <p>Best regards,<br>The TripMaster AI Team</p>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Welcome email sent to:', user.email);
    } catch (error) {
      console.error('Email error:', error);
    }
  }

  async sendPlanCreatedEmail(user, planId, destination) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: `Your ${destination} Travel Plan is Ready!`,
      html: `
        <h1>Your Travel Plan is Ready!</h1>
        <p>Hi ${user.name || 'there'},</p>
        <p>Your travel plan for ${destination} has been created successfully.</p>
        <p>You can view your plan at: ${process.env.BASE_URL}/plan/${planId}</p>
        <p>Happy travels!<br>The TripMaster AI Team</p>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Plan created email sent to:', user.email);
    } catch (error) {
      console.error('Email error:', error);
    }
  }
}

export const emailService = new EmailService();
```

#### Step 5.2: Add Email Notifications to Registration
Update registration endpoint:

```javascript
import { emailService } from './lib/email.mjs';

// Update registration endpoint
app.post('/api/auth/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').optional().trim().isLength({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password, name } = req.body;
    const user = await UserModel.createUser(email, password, name);
    const token = UserModel.generateToken(user.id);
    
    // Send welcome email
    await emailService.sendWelcomeEmail(user);
    
    res.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});
```

---

## 🔮 Week 4-6: Advanced Features

### Week 4: Enhanced Security & Performance

#### Day 1-2: Rate Limiting & Security
```javascript
// Enhanced rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // 5 attempts per window
  message: 'Too many login attempts, try again later'
});

app.post('/api/auth/login', authLimiter, [
  // ... existing validation
], async (req, res) => {
  // ... existing login logic
});
```

#### Day 3-4: Password Reset System
```javascript
// Password reset request
app.post('/api/auth/forgot-password', async (req, res) => {
  // Implementation for password reset
});

// Password reset confirmation
app.post('/api/auth/reset-password', async (req, res) => {
  // Implementation for password reset confirmation
});
```

#### Day 5-7: Data Export & Backup
```javascript
// Export user data (GDPR compliance)
app.get('/api/user/export', authMiddleware, async (req, res) => {
  // Implementation for data export
});
```

### Week 5: Advanced Analytics

#### Day 1-3: Enhanced Analytics Dashboard
- User engagement metrics
- Plan popularity tracking
- Revenue analytics (if monetized)
- Geographic distribution of users

#### Day 4-7: A/B Testing Framework
- Feature flag system
- User behavior tracking
- Conversion optimization

### Week 6: Production Optimization

#### Day 1-3: Performance Optimization
- Database indexing
- Query optimization
- Caching implementation
- CDN integration

#### Day 4-7: Monitoring & Alerting
- Health check endpoints
- Error tracking
- Performance monitoring
- Automated alerts

---

## 🔒 Security Checklist

### Essential Security Measures
- [ ] JWT tokens with proper expiration
- [ ] Password hashing with bcrypt
- [ ] Input validation and sanitization
- [ ] Rate limiting on sensitive endpoints
- [ ] HTTPS enforcement
- [ ] Security headers (helmet)
- [ ] SQL injection prevention
- [ ] XSS protection

### Advanced Security (Week 4+)
- [ ] Two-factor authentication
- [ ] Account lockout after failed attempts
- [ ] Session management
- [ ] Audit logging
- [ ] Data encryption at rest
- [ ] Regular security audits

---

## 🚀 Deployment Guide

### Development Environment
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Run development server
npm run dev
```

### Production Deployment

#### Option 1: Render (Free Tier)
1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically

#### Option 2: Railway (Free Tier)
1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically

#### Option 3: VPS ($5-10/month)
1. Set up Ubuntu server
2. Install Node.js and PM2
3. Configure Nginx reverse proxy
4. Set up SSL with Let's Encrypt

### Environment Variables for Production
```env
NODE_ENV=production
JWT_SECRET=your-super-secret-production-key
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
BASE_URL=https://your-domain.com
```

---

## 💰 Budget Breakdown

### Development Phase (Free)
- **Development Tools**: VS Code, Git (free)
- **Database**: SQLite (free)
- **Testing**: Local development (free)
- **Version Control**: GitHub (free)

### Production Phase (Minimal Cost)
- **Hosting**: Render/Railway free tier → VPS $5-10/month
- **Domain**: $10-15/year
- **SSL Certificate**: Let's Encrypt (free)
- **Email**: Gmail (free) → SendGrid $15/month (when needed)
- **Monitoring**: Basic logging (free) → Sentry $26/month (when needed)

### Total Monthly Cost (Production)
- **Minimum**: $5-10/month (VPS hosting)
- **Recommended**: $20-30/month (VPS + domain + email service)
- **Scaled**: $50-100/month (when you have significant users)

---

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check if SQLite file exists
ls -la backend/wayzo.sqlite

# Reset database (development only)
rm backend/wayzo.sqlite
npm run dev
```

#### Authentication Issues
```bash
# Check JWT secret
echo $JWT_SECRET

# Test JWT token
node -e "console.log(require('jsonwebtoken').sign({test: 'data'}, 'your-secret'))"
```

#### Email Issues
```bash
# Test email configuration
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: { user: 'your-email', pass: 'your-app-password' }
});
transporter.verify().then(console.log).catch(console.error);
"
```

### Performance Issues
- Check database query performance
- Monitor memory usage
- Optimize image uploads
- Implement caching

### Security Issues
- Regularly update dependencies
- Monitor for suspicious activity
- Implement proper error handling
- Use security scanning tools

---

## 📈 Success Metrics

### Week 1 Goals
- [ ] Users can register and login
- [ ] Authentication works securely
- [ ] Basic user profiles functional

### Week 2 Goals
- [ ] Plans linked to users
- [ ] Plan management working
- [ ] Sharing functionality operational

### Week 3 Goals
- [ ] Logging system active
- [ ] Basic analytics available
- [ ] Email notifications working

### Week 4-6 Goals
- [ ] Enhanced security implemented
- [ ] Performance optimized
- [ ] Production deployment ready

---

## 🎯 Next Steps After MVP

1. **User Feedback**: Collect user feedback and iterate
2. **Feature Expansion**: Add more travel planning features
3. **Monetization**: Implement premium features
4. **Scaling**: Move to PostgreSQL, add caching
5. **Mobile App**: Develop mobile application
6. **AI Enhancement**: Improve AI travel recommendations

---

**This guide provides everything you need to build a production-ready backend system with minimal budget and resources. Start with Week 1 and progress systematically through each phase.**