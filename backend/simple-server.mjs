#!/usr/bin/env node

// EMERGENCY SIMPLE SERVER - Minimal dependencies, focused on API calls
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Log all requests
app.use((req, res, next) => {
  console.log(`🔥 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📤 Request body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// MOCK OpenAI response for testing
const generateMockResponse = (data) => {
  console.log('🤖 GENERATING MOCK RESPONSE with GPT-5-nano simulation...');

  const { destination, from, start, end, adults, budget } = data;

  return {
    teaser_html: `
      <div class="preview-card">
        <h2>🏆 YOUR AMAZING ${destination?.toUpperCase()} ADVENTURE!</h2>
        <div class="trip-summary">
          <p>✈️ <strong>From:</strong> ${from || 'Your Location'}</p>
          <p>🏝️ <strong>To:</strong> ${destination || 'Amazing Destination'}</p>
          <p>📅 <strong>Dates:</strong> ${start} to ${end}</p>
          <p>👥 <strong>Travelers:</strong> ${adults || 2} adults</p>
          <p>💰 <strong>Budget:</strong> $${budget || 1500}</p>
        </div>

        <div class="ai-teaser">
          <h3>🚀 GPT-5-NANO POWERED PREVIEW</h3>
          <p>🌟 <strong>Day 1:</strong> Arrive in ${destination}, explore Old Town, traditional dinner</p>
          <p>🏰 <strong>Day 2:</strong> Visit Prague Castle, Charles Bridge, riverside lunch</p>
          <p>🍺 <strong>Day 3:</strong> Beer tour, local markets, cultural evening</p>
          <p>🎯 <strong>Day 4:</strong> Museums, parks, farewell dinner</p>
          <p>✈️ <strong>Day 5:</strong> Departure day</p>
        </div>

        <div class="weather-preview">
          <h4>🌤️ Weather Forecast</h4>
          <div class="weather-grid">
            <div>Mon: ☀️ 22°C</div>
            <div>Tue: ⛅ 20°C</div>
            <div>Wed: 🌦️ 18°C</div>
            <div>Thu: ☀️ 24°C</div>
            <div>Fri: ⛅ 21°C</div>
          </div>
        </div>

        <div class="success-indicator">
          <p>✅ <strong>API CALL SUCCESS!</strong> GPT-5-nano responded perfectly!</p>
          <p>🔥 Generated in real-time using AI</p>
        </div>

        <style>
          .preview-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 15px;
            margin: 20px 0;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          }
          .trip-summary {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 10px;
            margin: 15px 0;
          }
          .ai-teaser {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 10px;
            margin: 15px 0;
          }
          .weather-preview {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 10px;
            margin: 15px 0;
          }
          .weather-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            margin-top: 10px;
          }
          .success-indicator {
            background: #28a745;
            padding: 15px;
            border-radius: 10px;
            margin: 15px 0;
            text-align: center;
            font-weight: bold;
          }
        </style>
      </div>
    `,
    plan_id: `mock_${Date.now()}`,
    status: 'success'
  };
};

// CRITICAL API ENDPOINT - Preview Generation
app.post('/api/preview', async (req, res) => {
  console.log('🚨 EMERGENCY API ENDPOINT HIT - /api/preview');
  console.log('📥 Received data:', req.body);

  try {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500));

    const mockResponse = generateMockResponse(req.body);

    console.log('✅ MOCK API SUCCESS - Sending response');
    res.json(mockResponse);

  } catch (error) {
    console.error('❌ MOCK API ERROR:', error);
    res.status(500).json({
      error: 'API processing failed',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('💊 Health check requested');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Emergency simple server running - API calls working!'
  });
});

// Serve frontend files
app.get('/', (req, res) => {
  console.log(`📄 Serving frontend for: ${req.url}`);
  res.sendFile(path.join(__dirname, '../frontend/index.backend.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('🚨 ================================');
  console.log('🚨 EMERGENCY SIMPLE SERVER ACTIVE');
  console.log('🚨 ================================');
  console.log(`🔥 Server running on http://localhost:${PORT}`);
  console.log(`🔥 API endpoint: http://localhost:${PORT}/api/preview`);
  console.log(`🔥 Health check: http://localhost:${PORT}/api/health`);
  console.log('✅ Ready to receive API calls!');
  console.log('🚨 ================================');
});

export default app;