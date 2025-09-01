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

  static async logSystemAction(action, details = {}, req = null) {
    try {
      const logStmt = db.prepare(`
        INSERT INTO user_logs (id, user_id, action, details, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      logStmt.run(
        crypto.randomUUID(),
        null, // System action, no user
        action,
        JSON.stringify(details),
        req?.ip || null,
        req?.get('User-Agent') || null,
        new Date().toISOString()
      );
    } catch (error) {
      console.error('System logging error:', error);
    }
  }

  static async getUserActivity(userId, limit = 50, offset = 0) {
    const stmt = db.prepare(`
      SELECT action, details, created_at, ip_address
      FROM user_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    return stmt.all(userId, limit, offset);
  }

  static async getSystemStats() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_actions,
        COUNT(CASE WHEN action = 'plan_create' THEN 1 END) as plans_created,
        COUNT(CASE WHEN action = 'plan_view' THEN 1 END) as plans_viewed,
        COUNT(CASE WHEN action = 'login' THEN 1 END) as logins,
        COUNT(CASE WHEN action = 'register' THEN 1 END) as registrations
      FROM user_logs
      WHERE created_at >= datetime('now', '-7 days')
    `);
    
    return stmt.get();
  }

  static async getActionStats(action, days = 30) {
    const stmt = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM user_logs
      WHERE action = ? AND created_at >= datetime('now', '-${days} days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    return stmt.all(action);
  }

  static async getTopActions(limit = 10) {
    const stmt = db.prepare(`
      SELECT 
        action,
        COUNT(*) as count
      FROM user_logs
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY action
      ORDER BY count DESC
      LIMIT ?
    `);
    
    return stmt.all(limit);
  }

  static async getErrorLogs(limit = 50) {
    const stmt = db.prepare(`
      SELECT action, details, created_at, ip_address
      FROM user_logs
      WHERE action LIKE '%error%' OR action LIKE '%fail%'
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    return stmt.all(limit);
  }

  static async getPerformanceMetrics() {
    const stmt = db.prepare(`
      SELECT 
        action,
        COUNT(*) as total_requests,
        AVG(CAST(json_extract(details, '$.responseTime') AS REAL)) as avg_response_time,
        MAX(CAST(json_extract(details, '$.responseTime') AS REAL)) as max_response_time
      FROM user_logs
      WHERE json_extract(details, '$.responseTime') IS NOT NULL
      AND created_at >= datetime('now', '-7 days')
      GROUP BY action
      ORDER BY avg_response_time DESC
    `);
    
    return stmt.all();
  }

  static async cleanupOldLogs(daysToKeep = 90) {
    const stmt = db.prepare(`
      DELETE FROM user_logs
      WHERE created_at < datetime('now', '-${daysToKeep} days')
    `);
    
    const result = stmt.run();
    console.log(`Cleaned up ${result.changes} old log entries`);
    return result.changes;
  }

  static async getSecurityEvents(limit = 50) {
    const stmt = db.prepare(`
      SELECT action, details, created_at, ip_address, user_agent
      FROM user_logs
      WHERE action IN ('login_failed', 'password_reset', 'account_locked', 'suspicious_activity')
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    return stmt.all(limit);
  }

  static async getDailyStats(days = 7) {
    const stmt = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_actions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN action = 'plan_create' THEN 1 END) as plans_created,
        COUNT(CASE WHEN action = 'login' THEN 1 END) as logins
      FROM user_logs
      WHERE created_at >= datetime('now', '-${days} days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    return stmt.all();
  }
}