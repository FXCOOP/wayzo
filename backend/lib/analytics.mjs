import db from './database.mjs';
import { Logger } from './logger.mjs';

export class AnalyticsService {
  // User Analytics
  static async getUserGrowth(days = 30) {
    const stmt = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_users,
        COUNT(CASE WHEN last_login >= datetime('now', '-7 days') THEN 1 END) as active_users
      FROM users
      WHERE created_at >= datetime('now', '-${days} days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    return stmt.all();
  }

  static async getUserRetention() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN last_login >= datetime('now', '-7 days') THEN 1 END) as weekly_active,
        COUNT(CASE WHEN last_login >= datetime('now', '-30 days') THEN 1 END) as monthly_active,
        COUNT(CASE WHEN last_login IS NULL THEN 1 END) as never_logged_in
      FROM users
      WHERE status = 'active'
    `);
    
    return stmt.get();
  }

  static async getUserSegments() {
    const stmt = db.prepare(`
      SELECT 
        CASE 
          WHEN plan_count = 0 THEN 'New Users'
          WHEN plan_count BETWEEN 1 AND 3 THEN 'Casual Users'
          WHEN plan_count BETWEEN 4 AND 10 THEN 'Active Users'
          ELSE 'Power Users'
        END as segment,
        COUNT(*) as user_count,
        AVG(plan_count) as avg_plans_per_user
      FROM (
        SELECT u.id, COUNT(p.id) as plan_count
        FROM users u
        LEFT JOIN plans p ON u.id = p.user_id
        WHERE u.status = 'active'
        GROUP BY u.id
      )
      GROUP BY segment
      ORDER BY user_count DESC
    `);
    
    return stmt.all();
  }

  // Plan Analytics
  static async getPlanMetrics(days = 30) {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_plans,
        COUNT(CASE WHEN is_public = true THEN 1 END) as public_plans,
        COUNT(CASE WHEN is_public = false THEN 1 END) as private_plans,
        COUNT(DISTINCT user_id) as unique_creators,
        AVG(CAST(json_extract(payload, '$.data.budget') AS REAL)) as avg_budget
      FROM plans
      WHERE created_at >= datetime('now', '-${days} days')
    `);
    
    return stmt.get();
  }

  static async getPopularDestinations(limit = 10) {
    const stmt = db.prepare(`
      SELECT 
        json_extract(payload, '$.data.destination') as destination,
        COUNT(*) as plan_count,
        AVG(CAST(json_extract(payload, '$.data.budget') AS REAL)) as avg_budget,
        COUNT(CASE WHEN is_public = true THEN 1 END) as public_count
      FROM plans
      WHERE json_extract(payload, '$.data.destination') IS NOT NULL
      GROUP BY destination
      ORDER BY plan_count DESC
      LIMIT ?
    `);
    
    return stmt.all(limit);
  }

  static async getBudgetDistribution() {
    const stmt = db.prepare(`
      SELECT 
        CASE 
          WHEN budget < 1000 THEN 'Budget (<$1000)'
          WHEN budget BETWEEN 1000 AND 3000 THEN 'Mid-range ($1000-$3000)'
          WHEN budget BETWEEN 3000 AND 7000 THEN 'Premium ($3000-$7000)'
          ELSE 'Luxury (>$7000)'
        END as budget_range,
        COUNT(*) as plan_count,
        AVG(budget) as avg_budget
      FROM (
        SELECT CAST(json_extract(payload, '$.data.budget') AS REAL) as budget
        FROM plans
        WHERE json_extract(payload, '$.data.budget') IS NOT NULL
      )
      GROUP BY budget_range
      ORDER BY avg_budget
    `);
    
    return stmt.all();
  }

  // Engagement Analytics
  static async getEngagementMetrics(days = 30) {
    const stmt = db.prepare(`
      SELECT 
        action,
        COUNT(*) as total_actions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) * 100.0 / (SELECT COUNT(*) FROM user_logs WHERE created_at >= datetime('now', '-${days} days')) as percentage
      FROM user_logs
      WHERE created_at >= datetime('now', '-${days} days')
      GROUP BY action
      ORDER BY total_actions DESC
    `);
    
    return stmt.all();
  }

  static async getDailyActivity(days = 7) {
    const stmt = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_actions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN action = 'plan_create' THEN 1 END) as plans_created,
        COUNT(CASE WHEN action = 'plan_view' THEN 1 END) as plans_viewed,
        COUNT(CASE WHEN action = 'login' THEN 1 END) as logins
      FROM user_logs
      WHERE created_at >= datetime('now', '-${days} days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    return stmt.all();
  }

  static async getSessionMetrics() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_sessions,
        AVG(CAST((julianday(expires_at) - julianday(created_at)) * 24 * 60 AS REAL)) as avg_session_duration_minutes
      FROM user_sessions
      WHERE created_at >= datetime('now', '-7 days')
    `);
    
    return stmt.get();
  }

  // Revenue Analytics (if monetized)
  static async getRevenueMetrics() {
    // This would integrate with payment processing
    // For now, return placeholder data
    return {
      total_revenue: 0,
      monthly_revenue: 0,
      conversion_rate: 0,
      avg_order_value: 0
    };
  }

  // Performance Analytics
  static async getPerformanceMetrics() {
    const stmt = db.prepare(`
      SELECT 
        action,
        COUNT(*) as total_requests,
        AVG(CAST(json_extract(details, '$.responseTime') AS REAL)) as avg_response_time,
        MAX(CAST(json_extract(details, '$.responseTime') AS REAL)) as max_response_time,
        MIN(CAST(json_extract(details, '$.responseTime') AS REAL)) as min_response_time
      FROM user_logs
      WHERE json_extract(details, '$.responseTime') IS NOT NULL
      AND created_at >= datetime('now', '-7 days')
      GROUP BY action
      ORDER BY avg_response_time DESC
    `);
    
    return stmt.all();
  }

  static async getErrorMetrics() {
    const stmt = db.prepare(`
      SELECT 
        action,
        COUNT(*) as error_count,
        COUNT(*) * 100.0 / (
          SELECT COUNT(*) 
          FROM user_logs 
          WHERE created_at >= datetime('now', '-7 days')
        ) as error_percentage
      FROM user_logs
      WHERE (action LIKE '%error%' OR action LIKE '%fail%')
      AND created_at >= datetime('now', '-7 days')
      GROUP BY action
      ORDER BY error_count DESC
    `);
    
    return stmt.all();
  }

  // Geographic Analytics
  static async getGeographicDistribution() {
    // This would require IP geolocation data
    // For now, return placeholder
    return [
      { country: 'United States', user_count: 0, percentage: 0 },
      { country: 'United Kingdom', user_count: 0, percentage: 0 },
      { country: 'Canada', user_count: 0, percentage: 0 }
    ];
  }

  // Predictive Analytics
  static async getChurnPrediction() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as at_risk_users
      FROM users
      WHERE last_login < datetime('now', '-30 days')
      AND status = 'active'
      AND created_at < datetime('now', '-30 days')
    `);
    
    return stmt.get();
  }

  static async getGrowthPrediction() {
    // Simple linear growth prediction based on recent data
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as recent_users,
        COUNT(*) * 30.0 / 7 as predicted_monthly_growth
      FROM users
      WHERE created_at >= datetime('now', '-7 days')
    `);
    
    return stmt.get();
  }

  // Real-time Analytics
  static async getRealTimeMetrics() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as active_users_last_hour,
        COUNT(CASE WHEN action = 'plan_create' THEN 1 END) as plans_created_last_hour,
        COUNT(CASE WHEN action = 'login' THEN 1 END) as logins_last_hour
      FROM user_logs
      WHERE created_at >= ?
    `);
    
    return stmt.get(oneHourAgo.toISOString());
  }

  // Export Analytics Data
  static async exportAnalyticsData(startDate, endDate) {
    const stmt = db.prepare(`
      SELECT 
        u.email,
        u.name,
        u.created_at,
        u.last_login,
        COUNT(p.id) as plan_count,
        COUNT(CASE WHEN p.is_public = true THEN 1 END) as public_plans,
        COUNT(l.id) as total_actions
      FROM users u
      LEFT JOIN plans p ON u.id = p.user_id
      LEFT JOIN user_logs l ON u.id = l.user_id
      WHERE u.created_at BETWEEN ? AND ?
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    
    return stmt.all(startDate, endDate);
  }

  // Dashboard Summary
  static async getDashboardSummary() {
    const [
      userGrowth,
      userRetention,
      planMetrics,
      engagementMetrics,
      realTimeMetrics
    ] = await Promise.all([
      this.getUserGrowth(7),
      this.getUserRetention(),
      this.getPlanMetrics(7),
      this.getEngagementMetrics(7),
      this.getRealTimeMetrics()
    ]);

    return {
      users: {
        growth: userGrowth,
        retention: userRetention
      },
      plans: planMetrics,
      engagement: engagementMetrics,
      realTime: realTimeMetrics,
      timestamp: new Date().toISOString()
    };
  }
}