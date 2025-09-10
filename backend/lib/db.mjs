import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Create database file in backend directory
const dbPath = path.join(process.cwd(), 'wayzo.db');
let db;

try {
  db = new Database(dbPath);
  console.log('Database initialized at:', dbPath);
} catch (error) {
  console.error('Failed to initialize database:', error);
  // Fallback to in-memory database for testing
  db = new Database(':memory:');
  console.log('Using in-memory database as fallback');
}

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input TEXT,
    output TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT,
    destination TEXT,
    success BOOLEAN,
    error TEXT,
    response_time INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Plan storage functions
export function storePlan(input, output) {
  try {
    const stmt = db.prepare('INSERT INTO plans (input, output) VALUES (?, ?)');
    const result = stmt.run(JSON.stringify(input), output);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Failed to store plan:', error);
    return null;
  }
}

export function getPlan(id) {
  try {
    const stmt = db.prepare('SELECT * FROM plans WHERE id = ?');
    return stmt.get(id);
  } catch (error) {
    console.error('Failed to get plan:', error);
    return null;
  }
}

export function getAllPlans(limit = 50) {
  try {
    const stmt = db.prepare('SELECT * FROM plans ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(limit);
  } catch (error) {
    console.error('Failed to get all plans:', error);
    return [];
  }
}

// Request tracking functions
export function storeRequest(endpoint, destination, success, error = null, responseTime = null) {
  try {
    const stmt = db.prepare('INSERT INTO requests (endpoint, destination, success, error, response_time) VALUES (?, ?, ?, ?, ?)');
    return stmt.run(endpoint, destination, success, error, responseTime).lastInsertRowid;
  } catch (err) {
    console.error('Failed to store request:', err);
    return null;
  }
}

export function getRequestStats() {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM requests').get().count;
    const successful = db.prepare('SELECT COUNT(*) as count FROM requests WHERE success = 1').get().count;
    const errors = db.prepare('SELECT COUNT(*) as count FROM requests WHERE success = 0').get().count;
    const avgResponseTime = db.prepare('SELECT AVG(response_time) as avg FROM requests WHERE response_time IS NOT NULL').get().avg || 0;
    
    return {
      total,
      successful,
      errors,
      avgResponseTime: Math.round(avgResponseTime)
    };
  } catch (error) {
    console.error('Failed to get request stats:', error);
    return { total: 0, successful: 0, errors: 0, avgResponseTime: 0 };
  }
}

// Cleanup function for old data
export function cleanupOldData(daysToKeep = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const plansStmt = db.prepare('DELETE FROM plans WHERE timestamp < ?');
    const requestsStmt = db.prepare('DELETE FROM requests WHERE timestamp < ?');
    
    const plansDeleted = plansStmt.run(cutoffDate.toISOString()).changes;
    const requestsDeleted = requestsStmt.run(cutoffDate.toISOString()).changes;
    
    return { plansDeleted, requestsDeleted };
  } catch (error) {
    console.error('Failed to cleanup old data:', error);
    return { plansDeleted: 0, requestsDeleted: 0 };
  }
}

console.log('Database initialized at:', dbPath);