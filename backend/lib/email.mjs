import nodemailer from 'nodemailer';
import db from './database.mjs';

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

  async sendEmail(to, subject, htmlContent, textContent = '') {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      html: htmlContent,
      text: textContent
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      
      // Log email
      await this.logEmail(to, subject, 'sent', null, { messageId: result.messageId });
      
      console.log('Email sent successfully:', result.messageId);
      return result;
    } catch (error) {
      console.error('Email error:', error);
      
      // Log failed email
      await this.logEmail(to, subject, 'failed', error.message);
      
      throw error;
    }
  }

  async sendWelcomeEmail(user) {
    const subject = 'Welcome to TripMaster AI!';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6366f1;">Welcome to TripMaster AI!</h1>
        <p>Hi ${user.name || 'there'},</p>
        <p>Thank you for joining TripMaster AI. We're excited to help you create amazing travel plans!</p>
        <p>Here's what you can do with your account:</p>
        <ul>
          <li>Create personalized travel plans</li>
          <li>Save and organize your trips</li>
          <li>Share plans with friends and family</li>
          <li>Get AI-powered recommendations</li>
        </ul>
        <p>Start planning your next adventure today!</p>
        <p>Best regards,<br>The TripMaster AI Team</p>
      </div>
    `;

    return this.sendEmail(user.email, subject, htmlContent);
  }

  async sendPlanCreatedEmail(user, planId, destination) {
    const subject = `Your ${destination} Travel Plan is Ready!`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6366f1;">Your Travel Plan is Ready!</h1>
        <p>Hi ${user.name || 'there'},</p>
        <p>Your travel plan for <strong>${destination}</strong> has been created successfully.</p>
        <p>You can view your plan at: <a href="${process.env.BASE_URL}/plan/${planId}">View Plan</a></p>
        <p>Features of your plan:</p>
        <ul>
          <li>Day-by-day itinerary</li>
          <li>Budget breakdown</li>
          <li>Activity recommendations</li>
          <li>Downloadable PDF</li>
        </ul>
        <p>Happy travels!<br>The TripMaster AI Team</p>
      </div>
    `;

    return this.sendEmail(user.email, subject, htmlContent);
  }

  async sendPasswordResetEmail(user, resetToken) {
    const subject = 'Reset Your TripMaster AI Password';
    const resetUrl = `${process.env.BASE_URL}/reset-password?token=${resetToken}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6366f1;">Reset Your Password</h1>
        <p>Hi ${user.name || 'there'},</p>
        <p>You requested a password reset for your TripMaster AI account.</p>
        <p>Click the button below to reset your password:</p>
        <a href="${resetUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
        <p>Best regards,<br>The TripMaster AI Team</p>
      </div>
    `;

    return this.sendEmail(user.email, subject, htmlContent);
  }

  async sendEmailVerificationEmail(user, verificationToken) {
    const subject = 'Verify Your TripMaster AI Email';
    const verifyUrl = `${process.env.BASE_URL}/verify-email?token=${verificationToken}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6366f1;">Verify Your Email</h1>
        <p>Hi ${user.name || 'there'},</p>
        <p>Please verify your email address to complete your TripMaster AI registration.</p>
        <a href="${verifyUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email</a>
        <p>Best regards,<br>The TripMaster AI Team</p>
      </div>
    `;

    return this.sendEmail(user.email, subject, htmlContent);
  }

  async sendWeeklyDigest(user, recentPlans, recommendations) {
    const subject = 'Your Weekly TripMaster AI Digest';
    
    const plansHtml = recentPlans.length > 0 
      ? `<h3>Your Recent Plans:</h3><ul>${recentPlans.map(plan => `<li>${plan.destination}</li>`).join('')}</ul>`
      : '<p>No recent plans this week.</p>';
    
    const recommendationsHtml = recommendations.length > 0
      ? `<h3>Recommended Destinations:</h3><ul>${recommendations.map(rec => `<li>${rec.destination} - ${rec.reason}</li>`).join('')}</ul>`
      : '';
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6366f1;">Weekly Digest</h1>
        <p>Hi ${user.name || 'there'},</p>
        <p>Here's your weekly summary from TripMaster AI:</p>
        ${plansHtml}
        ${recommendationsHtml}
        <p>Ready to plan your next adventure?</p>
        <p>Best regards,<br>The TripMaster AI Team</p>
      </div>
    `;

    return this.sendEmail(user.email, subject, htmlContent);
  }

  async logEmail(toEmail, subject, status, errorMessage = null, metadata = {}) {
    try {
      const stmt = db.prepare(`
        INSERT INTO email_logs (id, template_name, to_email, subject, status, sent_at, error_message, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        crypto.randomUUID(),
        'custom',
        toEmail,
        subject,
        status,
        new Date().toISOString(),
        errorMessage,
        JSON.stringify(metadata)
      );
    } catch (error) {
      console.error('Failed to log email:', error);
    }
  }

  async getEmailStats() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_emails,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_emails,
        COUNT(CASE WHEN sent_at >= datetime('now', '-7 days') THEN 1 END) as emails_this_week
      FROM email_logs
    `);
    
    return stmt.get();
  }
}

export const emailService = new EmailService();