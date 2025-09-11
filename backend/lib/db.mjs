import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.dirname(__dirname);
const DB_PATH = path.join(ROOT, 'wayzo.db');

// Initialize database with error handling
const db = (() => {
  try {
    console.log('Initializing SQLite database at:', DB_PATH);
    const database = new Database(DB_PATH);
    
    // Create plans table with proper schema
    database.exec(`
      CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Database initialized successfully');
    return database;
  } catch (e) {
    console.error('DB init error:', e);
    throw new Error(`Failed to initialize database: ${e.message}`);
  }
})();

export function storePlan(input, output) {
  try {
    const stmt = db.prepare('INSERT INTO plans (input, output) VALUES (?, ?)');
    const result = stmt.run(JSON.stringify(input), output);
    console.log(`Stored plan with ID: ${result.lastInsertRowid}`);
    return result.lastInsertRowid;
  } catch (e) {
    console.error('Store plan error:', e);
    throw new Error(`Failed to store plan: ${e.message}`);
  }
}

export function getPlan(id) {
  try {
    const stmt = db.prepare('SELECT * FROM plans WHERE id = ?');
    const result = stmt.get(id);
    if (result) {
      console.log(`Retrieved plan ID: ${id}`);
    } else {
      console.log(`Plan not found: ${id}`);
    }
    return result;
  } catch (e) {
    console.error('Get plan error:', e);
    throw new Error(`Failed to get plan: ${e.message}`);
  }
}

export function getAllPlans() {
  try {
    const stmt = db.prepare('SELECT * FROM plans ORDER BY timestamp DESC LIMIT 100');
    return stmt.all();
  } catch (e) {
    console.error('Get all plans error:', e);
    throw new Error(`Failed to get plans: ${e.message}`);
  }
}