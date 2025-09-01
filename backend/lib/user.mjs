import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './database.mjs';

export class UserModel {
  static async createUser(email, password, name = '', preferences = {}) {
    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO users (id, email, password_hash, name, created_at, preferences)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    try {
      stmt.run(id, email.toLowerCase(), passwordHash, name, now, JSON.stringify(preferences));
      
      // Log user creation
      await this.logUserAction(id, 'user_created', { email, name });
      
      return { id, email, name, created_at: now };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Email already exists');
      }
      throw error;
    }
  }

  static async findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ? AND status = "active"');
    return stmt.get(email.toLowerCase());
  }

  static async findById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ? AND status = "active"');
    return stmt.get(id);
  }

  static async verifyPassword(user, password) {
    return bcrypt.compare(password, user.password_hash);
  }

  static generateToken(userId, type = 'access') {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    const expiresIn = type === 'access' ? '7d' : '1h';
    
    return jwt.sign(
      { userId, type },
      secret,
      { expiresIn }
    );
  }

  static verifyToken(token) {
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key';
      return jwt.verify(token, secret);
    } catch (error) {
      return null;
    }
  }

  static async updateLastLogin(userId) {
    const stmt = db.prepare('UPDATE users SET last_login = ? WHERE id = ?');
    stmt.run(new Date().toISOString(), userId);
  }

  static async updateProfile(userId, updates) {
    const allowedFields = ['name', 'profile_image', 'preferences'];
    const validUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        validUpdates[key] = value;
      }
    }
    
    if (Object.keys(validUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }
    
    const fields = Object.keys(validUpdates).map(field => `${field} = ?`).join(', ');
    const values = Object.values(validUpdates);
    values.push(userId);
    
    const stmt = db.prepare(`UPDATE users SET ${fields} WHERE id = ?`);
    stmt.run(...values);
    
    // Log profile update
    await this.logUserAction(userId, 'profile_updated', validUpdates);
    
    return true;
  }

  static async changePassword(userId, currentPassword, newPassword) {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const isValidPassword = await this.verifyPassword(user, currentPassword);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }
    
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    stmt.run(newPasswordHash, userId);
    
    // Log password change
    await this.logUserAction(userId, 'password_changed', {});
    
    return true;
  }

  static async createPasswordResetToken(email) {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    
    const resetToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour
    
    const stmt = db.prepare(`
      UPDATE users 
      SET reset_token = ?, reset_token_expires = ? 
      WHERE id = ?
    `);
    stmt.run(resetToken, expiresAt.toISOString(), user.id);
    
    return { resetToken, expiresAt };
  }

  static async resetPassword(resetToken, newPassword) {
    const stmt = db.prepare(`
      SELECT id FROM users 
      WHERE reset_token = ? AND reset_token_expires > ? AND status = "active"
    `);
    const user = stmt.get(resetToken, new Date().toISOString());
    
    if (!user) {
      throw new Error('Invalid or expired reset token');
    }
    
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    const clearStmt = db.prepare(`
      UPDATE users 
      SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL 
      WHERE id = ?
    `);
    clearStmt.run(newPasswordHash, user.id);
    
    // Log password reset
    await this.logUserAction(user.id, 'password_reset', {});
    
    return true;
  }

  static async logUserAction(userId, action, details = {}) {
    try {
      const stmt = db.prepare(`
        INSERT INTO user_logs (id, user_id, action, details, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        crypto.randomUUID(),
        userId,
        action,
        JSON.stringify(details),
        new Date().toISOString()
      );
    } catch (error) {
      console.error('Failed to log user action:', error);
    }
  }

  static async getUserStats(userId) {
    const statsStmt = db.prepare(`
      SELECT 
        COUNT(*) as total_plans,
        COUNT(CASE WHEN is_public = true THEN 1 END) as public_plans,
        COUNT(CASE WHEN is_public = false THEN 1 END) as private_plans
      FROM plans 
      WHERE user_id = ?
    `);
    
    const planStats = statsStmt.get(userId);
    
    const activityStmt = db.prepare(`
      SELECT 
        COUNT(*) as total_actions,
        COUNT(CASE WHEN action = 'plan_create' THEN 1 END) as plans_created,
        COUNT(CASE WHEN action = 'plan_view' THEN 1 END) as plans_viewed,
        COUNT(CASE WHEN action = 'login' THEN 1 END) as logins
      FROM user_logs
      WHERE user_id = ? AND created_at >= datetime('now', '-30 days')
    `);
    
    const activityStats = activityStmt.get(userId);
    
    return {
      plans: planStats,
      activity: activityStats
    };
  }

  static async getPopularDestinations(userId) {
    const stmt = db.prepare(`
      SELECT 
        json_extract(payload, '$.data.destination') as destination,
        COUNT(*) as count
      FROM plans 
      WHERE user_id = ?
      GROUP BY destination
      ORDER BY count DESC
      LIMIT 5
    `);
    
    return stmt.all(userId);
  }
}