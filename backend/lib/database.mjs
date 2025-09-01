import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '..', 'wayzo.sqlite'));

// Initialize database schema
export function initializeDatabase() {
  console.log('Initializing database schema...');
  
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
      verification_token TEXT,
      reset_token TEXT,
      reset_token_expires TEXT,
      profile_image TEXT,
      preferences TEXT,
      subscription_tier TEXT DEFAULT 'free',
      subscription_expires TEXT
    )
  `);

  // Update plans table to link with users
  try {
    db.exec(`ALTER TABLE plans ADD COLUMN user_id TEXT REFERENCES users(id)`);
  } catch (error) {
    // Column might already exist
    console.log('user_id column may already exist in plans table');
  }
  
  try {
    db.exec(`ALTER TABLE plans ADD COLUMN is_public BOOLEAN DEFAULT false`);
  } catch (error) {
    // Column might already exist
    console.log('is_public column may already exist in plans table');
  }

  // User sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      is_active BOOLEAN DEFAULT true
    )
  `);

  // User logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      session_id TEXT
    )
  `);

  // User analytics table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_analytics (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      metric_name TEXT NOT NULL,
      metric_value TEXT,
      created_at TEXT NOT NULL,
      metadata TEXT
    )
  `);

  // Email templates table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      subject TEXT NOT NULL,
      html_content TEXT NOT NULL,
      text_content TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true
    )
  `);

  // Email logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      template_name TEXT NOT NULL,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      error_message TEXT,
      metadata TEXT
    )
  `);

  // Create indexes for better performance
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_plans_public ON plans(is_public)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_user_id ON user_logs(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_action ON user_logs(action)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_created_at ON user_logs(created_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON user_analytics(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_analytics_metric ON user_analytics(metric_name)`);

  console.log('Database schema initialized successfully');
}

export default db;