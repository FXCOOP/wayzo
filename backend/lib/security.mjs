import db from './database.mjs';
import { Logger } from './logger.mjs';
import { UserModel } from './user.mjs';

export class SecurityService {
  // Rate limiting and brute force protection
  static failedLoginAttempts = new Map();
  static blockedIPs = new Map();
  
  static async checkLoginAttempts(email, ip) {
    const key = `${email}:${ip}`;
    const attempts = this.failedLoginAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
    
    // Reset if more than 15 minutes have passed
    if (Date.now() - attempts.firstAttempt > 15 * 60 * 1000) {
      attempts.count = 0;
      attempts.firstAttempt = Date.now();
    }
    
    if (attempts.count >= 5) {
      await Logger.logSystemAction('account_locked', { email, ip, reason: 'too_many_failed_attempts' });
      return { blocked: true, reason: 'Too many failed login attempts. Try again in 15 minutes.' };
    }
    
    return { blocked: false };
  }
  
  static async recordFailedLogin(email, ip) {
    const key = `${email}:${ip}`;
    const attempts = this.failedLoginAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
    attempts.count++;
    this.failedLoginAttempts.set(key, attempts);
    
    await Logger.logSystemAction('login_failed', { email, ip, attemptCount: attempts.count });
  }
  
  static async recordSuccessfulLogin(email, ip) {
    const key = `${email}:${ip}`;
    this.failedLoginAttempts.delete(key);
  }
  
  // IP blocking
  static async checkIPBlock(ip) {
    if (this.blockedIPs.has(ip)) {
      const blockInfo = this.blockedIPs.get(ip);
      if (Date.now() < blockInfo.until) {
        return { blocked: true, reason: blockInfo.reason };
      } else {
        this.blockedIPs.delete(ip);
      }
    }
    return { blocked: false };
  }
  
  static async blockIP(ip, reason, durationMinutes = 60) {
    this.blockedIPs.set(ip, {
      reason,
      until: Date.now() + (durationMinutes * 60 * 1000)
    });
    
    await Logger.logSystemAction('ip_blocked', { ip, reason, durationMinutes });
  }
  
  // Suspicious activity detection
  static async detectSuspiciousActivity(userId, action, details) {
    const suspiciousPatterns = [
      { pattern: 'multiple_logins', check: () => this.checkMultipleLogins(userId) },
      { pattern: 'unusual_location', check: () => this.checkUnusualLocation(userId, details) },
      { pattern: 'rapid_actions', check: () => this.checkRapidActions(userId, action) },
      { pattern: 'unusual_behavior', check: () => this.checkUnusualBehavior(userId, action) }
    ];
    
    const alerts = [];
    
    for (const pattern of suspiciousPatterns) {
      const result = await pattern.check();
      if (result.suspicious) {
        alerts.push({
          pattern: pattern.pattern,
          reason: result.reason,
          severity: result.severity
        });
      }
    }
    
    if (alerts.length > 0) {
      await Logger.logSystemAction('suspicious_activity', {
        userId,
        action,
        alerts,
        details
      });
    }
    
    return alerts;
  }
  
  static async checkMultipleLogins(userId) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as login_count
      FROM user_logs
      WHERE user_id = ? AND action = 'login'
      AND created_at >= datetime('now', '-1 hour')
    `);
    
    const result = stmt.get(userId);
    
    if (result.login_count > 3) {
      return {
        suspicious: true,
        reason: `Multiple logins detected: ${result.login_count} in the last hour`,
        severity: 'medium'
      };
    }
    
    return { suspicious: false };
  }
  
  static async checkUnusualLocation(userId, details) {
    // This would integrate with IP geolocation service
    // For now, return false
    return { suspicious: false };
  }
  
  static async checkRapidActions(userId, action) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as action_count
      FROM user_logs
      WHERE user_id = ? AND action = ?
      AND created_at >= datetime('now', '-1 minute')
    `);
    
    const result = stmt.get(userId, action);
    
    if (result.action_count > 10) {
      return {
        suspicious: true,
        reason: `Rapid ${action} actions detected: ${result.action_count} in the last minute`,
        severity: 'high'
      };
    }
    
    return { suspicious: false };
  }
  
  static async checkUnusualBehavior(userId, action) {
    // Check if user is performing actions they don't normally do
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_actions,
        COUNT(CASE WHEN action = ? THEN 1 END) as specific_actions
      FROM user_logs
      WHERE user_id = ?
      AND created_at >= datetime('now', '-7 days')
    `);
    
    const result = stmt.get(action, userId);
    
    if (result.total_actions > 0) {
      const percentage = (result.specific_actions / result.total_actions) * 100;
      if (percentage > 80) {
        return {
          suspicious: true,
          reason: `Unusual behavior: ${percentage.toFixed(1)}% of actions are ${action}`,
          severity: 'low'
        };
      }
    }
    
    return { suspicious: false };
  }
  
  // Account security
  static async lockAccount(userId, reason) {
    const stmt = db.prepare('UPDATE users SET status = ? WHERE id = ?');
    const result = stmt.run('locked', userId);
    
    if (result.changes > 0) {
      await Logger.logSystemAction('account_locked', { userId, reason });
    }
    
    return result.changes > 0;
  }
  
  static async unlockAccount(userId) {
    const stmt = db.prepare('UPDATE users SET status = ? WHERE id = ?');
    const result = stmt.run('active', userId);
    
    if (result.changes > 0) {
      await Logger.logSystemAction('account_unlocked', { userId });
    }
    
    return result.changes > 0;
  }
  
  static async requirePasswordChange(userId) {
    // Set a flag to require password change on next login
    const stmt = db.prepare('UPDATE users SET reset_token = ? WHERE id = ?');
    const result = stmt.run('REQUIRED_CHANGE', userId);
    
    if (result.changes > 0) {
      await Logger.logSystemAction('password_change_required', { userId });
    }
    
    return result.changes > 0;
  }
  
  // Security monitoring
  static async getSecurityEvents(limit = 100) {
    const stmt = db.prepare(`
      SELECT 
        action, details, created_at, ip_address, user_agent,
        u.email as user_email,
        u.name as user_name
      FROM user_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE action IN ('login_failed', 'account_locked', 'suspicious_activity', 'ip_blocked', 'password_reset')
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    return stmt.all(limit);
  }
  
  static async getSecurityStats() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(CASE WHEN action = 'login_failed' THEN 1 END) as failed_logins,
        COUNT(CASE WHEN action = 'account_locked' THEN 1 END) as locked_accounts,
        COUNT(CASE WHEN action = 'suspicious_activity' THEN 1 END) as suspicious_events,
        COUNT(CASE WHEN action = 'ip_blocked' THEN 1 END) as blocked_ips
      FROM user_logs
      WHERE created_at >= datetime('now', '-7 days')
      AND action IN ('login_failed', 'account_locked', 'suspicious_activity', 'ip_blocked')
    `);
    
    return stmt.get();
  }
  
  // Data protection
  static async anonymizeUserData(userId) {
    const anonymizedEmail = `user_${userId}@anonymized.com`;
    const anonymizedName = 'Anonymous User';
    
    const stmt = db.prepare(`
      UPDATE users 
      SET email = ?, name = ?, profile_image = NULL, preferences = NULL
      WHERE id = ?
    `);
    
    const result = stmt.run(anonymizedEmail, anonymizedName, userId);
    
    if (result.changes > 0) {
      await Logger.logSystemAction('user_data_anonymized', { userId });
    }
    
    return result.changes > 0;
  }
  
  static async exportUserData(userId) {
    const userStmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const plansStmt = db.prepare('SELECT * FROM plans WHERE user_id = ?');
    const logsStmt = db.prepare('SELECT * FROM user_logs WHERE user_id = ?');
    
    const user = userStmt.get(userId);
    const plans = plansStmt.all(userId);
    const logs = logsStmt.all(userId);
    
    return {
      user,
      plans,
      logs,
      exported_at: new Date().toISOString()
    };
  }
  
  // Security audit
  static async generateSecurityReport() {
    const [
      securityStats,
      recentEvents,
      blockedIPs,
      lockedAccounts
    ] = await Promise.all([
      this.getSecurityStats(),
      this.getSecurityEvents(50),
      this.getBlockedIPs(),
      this.getLockedAccounts()
    ]);
    
    return {
      stats: securityStats,
      recentEvents,
      blockedIPs,
      lockedAccounts,
      generated_at: new Date().toISOString()
    };
  }
  
  static async getBlockedIPs() {
    const blocked = [];
    for (const [ip, info] of this.blockedIPs.entries()) {
      if (Date.now() < info.until) {
        blocked.push({
          ip,
          reason: info.reason,
          blocked_until: new Date(info.until).toISOString()
        });
      }
    }
    return blocked;
  }
  
  static async getLockedAccounts() {
    const stmt = db.prepare(`
      SELECT id, email, name, created_at, last_login
      FROM users
      WHERE status = 'locked'
      ORDER BY last_login DESC
    `);
    
    return stmt.all();
  }
  
  // Cleanup expired security data
  static async cleanupSecurityData() {
    // Clean up expired IP blocks
    for (const [ip, info] of this.blockedIPs.entries()) {
      if (Date.now() >= info.until) {
        this.blockedIPs.delete(ip);
      }
    }
    
    // Clean up expired login attempts
    for (const [key, attempts] of this.failedLoginAttempts.entries()) {
      if (Date.now() - attempts.firstAttempt > 15 * 60 * 1000) {
        this.failedLoginAttempts.delete(key);
      }
    }
  }
}