const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const sqlite3 = require('sqlite3').verbose();
const WebSocket = require('ws');
const cron = require('node-cron');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend/build')));

// Database setup
const db = new sqlite3.Database('./trading_signals.db');

// Initialize database tables
db.serialize(() => {
  // Articles table
  db.run(`CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    category TEXT,
    sentiment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Trading signals table
  db.run(`CREATE TABLE IF NOT EXISTS trading_signals (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    entry_price REAL,
    target_price REAL,
    stop_loss REAL,
    confidence REAL,
    analysis TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Economic indicators table
  db.run(`CREATE TABLE IF NOT EXISTS economic_indicators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    value TEXT,
    previous_value TEXT,
    change REAL,
    impact TEXT,
    date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ port: 3002 });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    console.log('Received:', message);
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Broadcast function for WebSocket
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// AI-powered article generation (simulated)
async function generateDailyArticle() {
  const categories = ['Market Analysis', 'Economic Review', 'Sector Focus', 'Global Markets'];
  const category = categories[Math.floor(Math.random() * categories.length)];
  
  const article = {
    id: uuidv4(),
    title: `Daily ${category} - ${moment().format('MMMM Do, YYYY')}`,
    content: generateArticleContent(category),
    summary: `Comprehensive ${category.toLowerCase()} for today's trading session`,
    category: category,
    sentiment: Math.random() > 0.5 ? 'bullish' : 'bearish',
    created_at: moment().toISOString()
  };

  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO articles (id, title, content, summary, category, sentiment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [article.id, article.title, article.content, article.summary, article.category, article.sentiment, article.created_at],
      function(err) {
        if (err) reject(err);
        else resolve(article);
      }
    );
  });
}

// AI-powered trading signal generation (simulated)
async function generateTradingSignals() {
  const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'NFLX'];
  const signalTypes = ['BUY', 'SELL', 'HOLD'];
  
  const signals = [];
  
  for (let i = 0; i < 3; i++) {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const signalType = signalTypes[Math.floor(Math.random() * signalTypes.length)];
    
    const signal = {
      id: uuidv4(),
      symbol: symbol,
      signal_type: signalType,
      entry_price: (Math.random() * 1000 + 100).toFixed(2),
      target_price: (Math.random() * 1200 + 150).toFixed(2),
      stop_loss: (Math.random() * 800 + 50).toFixed(2),
      confidence: (Math.random() * 0.4 + 0.6).toFixed(2),
      analysis: generateSignalAnalysis(symbol, signalType),
      status: 'active',
      created_at: moment().toISOString()
    };
    
    signals.push(signal);
  }
  
  return signals;
}

// Helper functions for content generation
function generateArticleContent(category) {
  const templates = {
    'Market Analysis': `Today's market session opened with mixed signals as investors digest the latest economic data. The ${category.toLowerCase()} reveals key insights into market dynamics and potential opportunities. Technical indicators suggest a consolidation phase, while fundamental analysis points to underlying strength in several sectors.`,
    'Economic Review': `Economic indicators released today show ${Math.random() > 0.5 ? 'positive' : 'mixed'} trends across key metrics. Employment data, inflation figures, and consumer sentiment all contribute to the current market narrative. Central bank policies continue to influence market direction.`,
    'Sector Focus': `The technology sector leads today's gains, with particular strength in ${['AI', 'cloud computing', 'cybersecurity', 'fintech'][Math.floor(Math.random() * 4)]}. Energy and healthcare sectors show mixed performance, while financials remain stable.`,
    'Global Markets': `International markets display varied performance, with Asian markets showing ${Math.random() > 0.5 ? 'strength' : 'weakness'} and European indices trading mixed. Currency movements and geopolitical developments continue to impact global trading sentiment.`
  };
  
  return templates[category] || templates['Market Analysis'];
}

function generateSignalAnalysis(symbol, signalType) {
  const analyses = {
    'BUY': `Strong technical breakout above resistance levels. Volume confirmation supports bullish momentum. Fundamental analysis shows positive earnings growth and market position.`,
    'SELL': `Technical indicators suggest overbought conditions. Resistance at key levels may limit upside potential. Consider profit-taking or position reduction.`,
    'HOLD': `Price action shows consolidation within established range. Wait for clearer directional signal. Monitor support and resistance levels for breakout opportunities.`
  };
  
  return analyses[signalType] || analyses['HOLD'];
}

// Schedule daily content generation
cron.schedule('0 6 * * *', async () => {
  try {
    console.log('Generating daily content...');
    
    // Generate daily article
    const article = await generateDailyArticle();
    console.log('Generated article:', article.title);
    
    // Generate trading signals
    const signals = await generateTradingSignals();
    for (const signal of signals) {
      db.run(
        'INSERT INTO trading_signals (id, symbol, signal_type, entry_price, target_price, stop_loss, confidence, analysis, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [signal.id, signal.symbol, signal.signal_type, signal.entry_price, signal.target_price, signal.stop_loss, signal.confidence, signal.analysis, signal.created_at]
      );
    }
    console.log('Generated trading signals:', signals.length);
    
    // Broadcast updates via WebSocket
    broadcast({
      type: 'daily_update',
      article: article,
      signals: signals
    });
    
  } catch (error) {
    console.error('Error generating daily content:', error);
  }
});

// API Routes
app.get('/api/articles', (req, res) => {
  db.all('SELECT * FROM articles ORDER BY created_at DESC LIMIT 50', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/signals', (req, res) => {
  db.all('SELECT * FROM trading_signals WHERE status = "active" ORDER BY created_at DESC LIMIT 20', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/indicators', (req, res) => {
  db.all('SELECT * FROM economic_indicators ORDER BY date DESC LIMIT 10', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/signals/:id/update', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  db.run('UPDATE trading_signals SET status = ?, updated_at = ? WHERE id = ?', 
    [status, moment().toISOString(), id], 
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true, message: 'Signal updated' });
    }
  );
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AI Trading Signals Server running on port ${PORT}`);
  console.log(`📡 WebSocket server running on port 3002`);
  console.log(`🤖 Daily content generation scheduled for 6:00 AM`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  db.close();
  wss.close();
  process.exit(0);
});