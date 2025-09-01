import { AnalyticsService } from './analytics.mjs';
import { emailService } from './email.mjs';
import { Logger } from './logger.mjs';
import db from './database.mjs';

export class AdminService {
  // System Overview
  static async getSystemOverview() {
    const [
      userStats,
      planStats,
      activityStats,
      emailStats,
      performanceStats
    ] = await Promise.all([
      this.getUserStatistics(),
      this.getPlanStatistics(),
      this.getActivityStatistics(),
      this.getEmailStatistics(),
      this.getPerformanceStatistics()
    ]);

    return {
      users: userStats,
      plans: planStats,
      activity: activityStats,
      email: emailStats,
      performance: performanceStats,
      timestamp: new Date().toISOString()
    };
  }

  // User Management
  static async getUserStatistics() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_users,
        COUNT(CASE WHEN email_verified = true THEN 1 END) as verified_users,
        COUNT(CASE WHEN last_login >= datetime('now', '-7 days') THEN 1 END) as weekly_active,
        COUNT(CASE WHEN last_login >= datetime('now', '-30 days') THEN 1 END) as monthly_active,
        COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as new_users_week,
        COUNT(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 END) as new_users_month
      FROM users
    `);
    
    return stmt.get();
  }

  static async getUsersList(limit = 50, offset = 0, filters = {}) {
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (filters.status) {
      whereClause += ' AND status = ?';
      params.push(filters.status);
    }
    
    if (filters.search) {
      whereClause += ' AND (email LIKE ? OR name LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }
    
    const stmt = db.prepare(`
      SELECT 
        id, email, name, created_at, last_login, status, email_verified,
        (SELECT COUNT(*) FROM plans WHERE user_id = users.id) as plan_count,
        (SELECT COUNT(*) FROM user_logs WHERE user_id = users.id) as action_count
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    return stmt.all(...params, limit, offset);
  }

  static async updateUserStatus(userId, status) {
    const stmt = db.prepare('UPDATE users SET status = ? WHERE id = ?');
    const result = stmt.run(status, userId);
    
    if (result.changes > 0) {
      await Logger.logSystemAction('user_status_updated', { userId, status });
    }
    
    return result.changes > 0;
  }

  static async deleteUser(userId) {
    // First, delete related data
    db.prepare('DELETE FROM plans WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM user_logs WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM user_analytics WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM email_logs WHERE user_id = ?').run(userId);
    
    // Then delete user
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    if (result.changes > 0) {
      await Logger.logSystemAction('user_deleted', { userId });
    }
    
    return result.changes > 0;
  }

  // Plan Management
  static async getPlanStatistics() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_plans,
        COUNT(CASE WHEN is_public = true THEN 1 END) as public_plans,
        COUNT(CASE WHEN is_public = false THEN 1 END) as private_plans,
        COUNT(DISTINCT user_id) as unique_creators,
        AVG(CAST(json_extract(payload, '$.data.budget') AS REAL)) as avg_budget,
        COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as new_plans_week,
        COUNT(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 END) as new_plans_month
      FROM plans
    `);
    
    return stmt.get();
  }

  static async getPlansList(limit = 50, offset = 0, filters = {}) {
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    if (filters.is_public !== undefined) {
      whereClause += ' AND p.is_public = ?';
      params.push(filters.is_public);
    }
    
    if (filters.destination) {
      whereClause += ' AND json_extract(p.payload, "$.data.destination") LIKE ?';
      params.push(`%${filters.destination}%`);
    }
    
    const stmt = db.prepare(`
      SELECT 
        p.id, p.created_at, p.is_public,
        json_extract(p.payload, '$.data.destination') as destination,
        json_extract(p.payload, '$.data.budget') as budget,
        json_extract(p.payload, '$.data.start') as start_date,
        json_extract(p.payload, '$.data.end') as end_date,
        u.email as creator_email,
        u.name as creator_name
      FROM plans p
      LEFT JOIN users u ON p.user_id = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    return stmt.all(...params, limit, offset);
  }

  static async deletePlan(planId) {
    const result = db.prepare('DELETE FROM plans WHERE id = ?').run(planId);
    
    if (result.changes > 0) {
      await Logger.logSystemAction('plan_deleted', { planId });
    }
    
    return result.changes > 0;
  }

  // Activity Monitoring
  static async getActivityStatistics() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_actions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as actions_week,
        COUNT(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 END) as actions_month,
        COUNT(CASE WHEN action = 'login' THEN 1 END) as logins,
        COUNT(CASE WHEN action = 'plan_create' THEN 1 END) as plan_creations,
        COUNT(CASE WHEN action = 'plan_view' THEN 1 END) as plan_views
      FROM user_logs
    `);
    
    return stmt.get();
  }

  static async getRecentActivity(limit = 100) {
    const stmt = db.prepare(`
      SELECT 
        l.action, l.details, l.created_at, l.ip_address,
        u.email as user_email,
        u.name as user_name
      FROM user_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT ?
    `);
    
    return stmt.all(limit);
  }

  // Email Management
  static async getEmailStatistics() {
    return await emailService.getEmailStats();
  }

  static async getEmailLogs(limit = 100) {
    const stmt = db.prepare(`
      SELECT 
        el.*,
        u.email as user_email,
        u.name as user_name
      FROM email_logs el
      LEFT JOIN users u ON el.user_id = u.id
      ORDER BY el.sent_at DESC
      LIMIT ?
    `);
    
    return stmt.all(limit);
  }

  static async sendBulkEmail(templateName, userIds, customData = {}) {
    const results = [];
    
    for (const userId of userIds) {
      try {
        const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (!user) continue;
        
        // Send email based on template
        let emailResult;
        switch (templateName) {
          case 'welcome':
            emailResult = await emailService.sendWelcomeEmail(user);
            break;
          case 'weekly_digest':
            emailResult = await emailService.sendWeeklyDigest(user, [], []);
            break;
          default:
            emailResult = await emailService.sendEmail(
              user.email,
              customData.subject || 'Message from TripMaster AI',
              customData.html || '<p>Hello from TripMaster AI!</p>'
            );
        }
        
        results.push({
          userId,
          email: user.email,
          success: true,
          messageId: emailResult?.messageId
        });
      } catch (error) {
        results.push({
          userId,
          email: user?.email,
          success: false,
          error: error.message
        });
      }
    }
    
    await Logger.logSystemAction('bulk_email_sent', {
      template: templateName,
      userCount: userIds.length,
      results
    });
    
    return results;
  }

  // Performance Monitoring
  static async getPerformanceStatistics() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_requests,
        AVG(CAST(json_extract(details, '$.responseTime') AS REAL)) as avg_response_time,
        MAX(CAST(json_extract(details, '$.responseTime') AS REAL)) as max_response_time,
        COUNT(CASE WHEN json_extract(details, '$.responseTime') > 1000 THEN 1 END) as slow_requests
      FROM user_logs
      WHERE json_extract(details, '$.responseTime') IS NOT NULL
      AND created_at >= datetime('now', '-7 days')
    `);
    
    return stmt.get();
  }

  static async getErrorLogs(limit = 100) {
    const stmt = db.prepare(`
      SELECT 
        action, details, created_at, ip_address, user_agent,
        u.email as user_email
      FROM user_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE action LIKE '%error%' OR action LIKE '%fail%'
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    return stmt.all(limit);
  }

  // System Maintenance
  static async cleanupOldData() {
    const results = {
      oldLogs: 0,
      oldSessions: 0,
      oldEmails: 0
    };
    
    // Clean up old logs (keep 90 days)
    const oldLogsResult = db.prepare(`
      DELETE FROM user_logs 
      WHERE created_at < datetime('now', '-90 days')
    `).run();
    results.oldLogs = oldLogsResult.changes;
    
    // Clean up old sessions (keep 30 days)
    const oldSessionsResult = db.prepare(`
      DELETE FROM user_sessions 
      WHERE created_at < datetime('now', '-30 days')
    `).run();
    results.oldSessions = oldSessionsResult.changes;
    
    // Clean up old email logs (keep 60 days)
    const oldEmailsResult = db.prepare(`
      DELETE FROM email_logs 
      WHERE sent_at < datetime('now', '-60 days')
    `).run();
    results.oldEmails = oldEmailsResult.changes;
    
    await Logger.logSystemAction('data_cleanup', results);
    
    return results;
  }

  static async getSystemHealth() {
    const health = {
      database: 'healthy',
      email: 'healthy',
      performance: 'healthy',
      issues: []
    };
    
    // Check database
    try {
      db.prepare('SELECT 1').get();
    } catch (error) {
      health.database = 'error';
      health.issues.push('Database connection failed');
    }
    
    // Check email service
    try {
      await emailService.transporter.verify();
    } catch (error) {
      health.email = 'error';
      health.issues.push('Email service unavailable');
    }
    
    // Check performance
    const performanceStats = await this.getPerformanceStatistics();
    if (performanceStats.avg_response_time > 2000) {
      health.performance = 'warning';
      health.issues.push('High response times detected');
    }
    
    return health;
  }

  // Analytics Integration
  static async getAnalyticsDashboard() {
    return await AnalyticsService.getDashboardSummary();
  }

  static async getAdvancedAnalytics() {
    const [
      userGrowth,
      userSegments,
      popularDestinations,
      budgetDistribution,
      engagementMetrics,
      churnPrediction
    ] = await Promise.all([
      AnalyticsService.getUserGrowth(30),
      AnalyticsService.getUserSegments(),
      AnalyticsService.getPopularDestinations(10),
      AnalyticsService.getBudgetDistribution(),
      AnalyticsService.getEngagementMetrics(30),
      AnalyticsService.getChurnPrediction()
    ]);

    return {
      userGrowth,
      userSegments,
      popularDestinations,
      budgetDistribution,
      engagementMetrics,
      churnPrediction,
      timestamp: new Date().toISOString()
    };
  }
}