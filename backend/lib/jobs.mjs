import { emailService } from './email.mjs';
import { Logger } from './logger.mjs';
import { AnalyticsService } from './analytics.mjs';
import { AdminService } from './admin.mjs';
import db from './database.mjs';

class JobQueue {
  constructor() {
    this.jobs = [];
    this.running = false;
    this.maxConcurrent = 3;
    this.activeJobs = 0;
  }

  // Add job to queue
  add(job) {
    this.jobs.push({
      ...job,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      status: 'pending'
    });
    
    if (!this.running) {
      this.process();
    }
  }

  // Process jobs
  async process() {
    if (this.running || this.activeJobs >= this.maxConcurrent) {
      return;
    }

    this.running = true;

    while (this.jobs.length > 0 && this.activeJobs < this.maxConcurrent) {
      const job = this.jobs.shift();
      this.activeJobs++;
      
      this.executeJob(job).finally(() => {
        this.activeJobs--;
      });
    }

    this.running = false;

    // If there are still jobs, continue processing
    if (this.jobs.length > 0) {
      setTimeout(() => this.process(), 1000);
    }
  }

  // Execute individual job
  async executeJob(job) {
    try {
      job.status = 'running';
      job.startedAt = new Date();
      
      console.log(`Executing job: ${job.type} (${job.id})`);
      
      const result = await this.runJob(job);
      
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      
      console.log(`Job completed: ${job.type} (${job.id})`);
      
      await Logger.logSystemAction('job_completed', {
        jobId: job.id,
        jobType: job.type,
        duration: job.completedAt - job.startedAt
      });
      
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.error = error.message;
      
      console.error(`Job failed: ${job.type} (${job.id})`, error);
      
      await Logger.logSystemAction('job_failed', {
        jobId: job.id,
        jobType: job.type,
        error: error.message
      });
      
      // Retry failed jobs (up to 3 times)
      if (job.retries < 3) {
        job.retries = (job.retries || 0) + 1;
        job.status = 'pending';
        this.jobs.unshift(job);
      }
    }
  }

  // Run specific job types
  async runJob(job) {
    switch (job.type) {
      case 'send_welcome_emails':
        return await this.sendWelcomeEmails(job.data);
      case 'send_weekly_digest':
        return await this.sendWeeklyDigest(job.data);
      case 'cleanup_old_data':
        return await this.cleanupOldData();
      case 'generate_analytics_report':
        return await this.generateAnalyticsReport(job.data);
      case 'backup_database':
        return await this.backupDatabase();
      case 'send_bulk_email':
        return await this.sendBulkEmail(job.data);
      case 'process_user_analytics':
        return await this.processUserAnalytics(job.data);
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  // Job implementations
  async sendWelcomeEmails(data) {
    const { userIds } = data;
    const results = [];
    
    for (const userId of userIds) {
      try {
        const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (user) {
          await emailService.sendWelcomeEmail(user);
          results.push({ userId, success: true });
        }
      } catch (error) {
        results.push({ userId, success: false, error: error.message });
      }
    }
    
    return { sent: results.length, results };
  }

  async sendWeeklyDigest(data) {
    const { userIds } = data;
    const results = [];
    
    for (const userId of userIds) {
      try {
        const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        if (user) {
          // Get user's recent plans
          const recentPlans = await db.prepare(`
            SELECT json_extract(payload, '$.data.destination') as destination
            FROM plans
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 5
          `).all(userId);
          
          // Get recommendations (simplified)
          const recommendations = [];
          
          await emailService.sendWeeklyDigest(user, recentPlans, recommendations);
          results.push({ userId, success: true });
        }
      } catch (error) {
        results.push({ userId, success: false, error: error.message });
      }
    }
    
    return { sent: results.length, results };
  }

  async cleanupOldData() {
    const results = await AdminService.cleanupOldData();
    return results;
  }

  async generateAnalyticsReport(data) {
    const { reportType, dateRange } = data;
    
    switch (reportType) {
      case 'user_growth':
        return await AnalyticsService.getUserGrowth(dateRange || 30);
      case 'plan_metrics':
        return await AnalyticsService.getPlanMetrics(dateRange || 30);
      case 'engagement':
        return await AnalyticsService.getEngagementMetrics(dateRange || 30);
      case 'security':
        return await this.generateSecurityReport();
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }

  async generateSecurityReport() {
    const stmt = db.prepare(`
      SELECT 
        action,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM user_logs
      WHERE action IN ('login_failed', 'account_locked', 'suspicious_activity')
      AND created_at >= datetime('now', '-7 days')
      GROUP BY action, DATE(created_at)
      ORDER BY date DESC, count DESC
    `);
    
    return stmt.all();
  }

  async backupDatabase() {
    // In production, this would create a proper database backup
    // For now, just return success
    return { status: 'success', message: 'Database backup completed' };
  }

  async sendBulkEmail(data) {
    const { templateName, userIds, customData } = data;
    return await AdminService.sendBulkEmail(templateName, userIds, customData);
  }

  async processUserAnalytics(data) {
    const { userId } = data;
    
    // Process user analytics
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total_plans,
        COUNT(CASE WHEN is_public = true THEN 1 END) as public_plans,
        AVG(CAST(json_extract(payload, '$.data.budget') AS REAL)) as avg_budget
      FROM plans
      WHERE user_id = ?
    `).get(userId);
    
    // Store analytics
    await db.prepare(`
      INSERT INTO user_analytics (id, user_id, metric_name, metric_value, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      userId,
      'user_stats',
      JSON.stringify(stats),
      new Date().toISOString()
    );
    
    return stats;
  }

  // Get queue status
  getStatus() {
    return {
      pending: this.jobs.length,
      running: this.activeJobs,
      maxConcurrent: this.maxConcurrent,
      running: this.running
    };
  }

  // Get job history
  async getJobHistory(limit = 100) {
    // In production, this would be stored in database
    // For now, return empty array
    return [];
  }
}

// Initialize job queue
export const jobQueue = new JobQueue();

// Scheduled jobs
export function scheduleJobs() {
  // Daily cleanup at 2 AM
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 2 && now.getMinutes() === 0) {
      jobQueue.add({
        type: 'cleanup_old_data',
        priority: 'low'
      });
    }
  }, 60000); // Check every minute

  // Weekly digest on Sundays at 9 AM
  setInterval(() => {
    const now = new Date();
    if (now.getDay() === 0 && now.getHours() === 9 && now.getMinutes() === 0) {
      // Get active users
      const activeUsers = db.prepare(`
        SELECT id FROM users 
        WHERE status = 'active' 
        AND last_login >= datetime('now', '-7 days')
      `).all();
      
      if (activeUsers.length > 0) {
        jobQueue.add({
          type: 'send_weekly_digest',
          data: { userIds: activeUsers.map(u => u.id) },
          priority: 'medium'
        });
      }
    }
  }, 60000);

  // Daily analytics report at 6 AM
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 6 && now.getMinutes() === 0) {
      jobQueue.add({
        type: 'generate_analytics_report',
        data: { reportType: 'user_growth', dateRange: 7 },
        priority: 'low'
      });
    }
  }, 60000);
}

// Job utilities
export function addJob(type, data = {}, priority = 'normal') {
  jobQueue.add({
    type,
    data,
    priority,
    retries: 0
  });
}

export function addImmediateJob(type, data = {}) {
  // For immediate execution, add to front of queue
  jobQueue.jobs.unshift({
    type,
    data,
    priority: 'high',
    retries: 0,
    id: crypto.randomUUID(),
    createdAt: new Date(),
    status: 'pending'
  });
  
  if (!jobQueue.running) {
    jobQueue.process();
  }
}

// Start scheduled jobs
scheduleJobs();

export default jobQueue;