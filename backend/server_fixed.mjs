/* eslint-disable no-console */
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { marked } from 'marked';

// Global error handling to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('🚨 Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);
  // Don't exit immediately - let the process handle it gracefully
  setTimeout(() => {
    console.error('🚨 Exiting due to uncaught exception');
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Log but don't exit for unhandled rejections
});

process.on('SIGTERM', () => {
  console.log('🚨 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🚨 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Configure marked to allow JavaScript event handlers for interactive checkboxes
marked.setOptions({
  sanitize: false, // Allow HTML and JavaScript event handlers
  breaks: true,    // Convert line breaks to <br>
  gfm: true        // GitHub Flavored Markdown
});

import puppeteer from 'puppeteer';
// Derive a locale string from destination (very lightweight mapping)
function getLocaleForDestination(dest = '') {
  const d = (dest || '').toLowerCase();
  if (d.includes('germany') || d.includes('berlin')) return 'de-DE';
  if (d.includes('austria') || d.includes('tyrol') || d.includes('tirol') || d.includes('innsbruck')) return 'de-AT';
  if (d.includes('italy') || d.includes('venice') || d.includes('venezia')) return 'it-IT';
  if (d.includes('greece') || d.includes('santorini') || d.includes('athens')) return 'el-GR';
  if (d.includes('spain') || d.includes('madrid') || d.includes('barcelona')) return 'es-ES';
  if (d.includes('france') || d.includes('paris')) return 'fr-FR';
  if (d.includes('portugal') || d.includes('lisbon') || d.includes('porto')) return 'pt-PT';
  if (d.includes('czech') || d.includes('prague')) return 'cs-CZ';
  return 'en-US';
}
import OpenAI from 'openai';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import pino from 'pino';
import { normalizeBudget, computeBudget } from './lib/budget.mjs';
import { ensureDaySections } from './lib/expand-days.mjs';
import { affiliatesFor, linkifyTokens } from './lib/links.mjs';
import { buildIcs } from './lib/ics.mjs';
import { getWidgetsForDestination, generateWidgetHTML } from './lib/widgets.mjs';
import { WIDGET_CONFIG, getGYGWidget, injectWidgetsIntoSections } from './lib/widget-config.mjs';
import { storePlan, getPlan, getAllPlans, storeRequest, getRequestStats } from './lib/db.mjs';
const VERSION = 'staging-v76-fixed';

// Initialize structured logging with Pino (FIXED - prevent crashes)
let logger;
try {
  // In production, use simple JSON logging without pino-pretty
  if (process.env.NODE_ENV === 'production') {
    logger = pino({
      level: 'info',
      formatters: {
        level: (label) => ({ level: label })
      }
    });
  } else {
    // In development, use console fallback to prevent crashes
    logger = {
      info: (obj, msg) => console.log(`[INFO] ${msg}`, obj || ''),
      warn: (obj, msg) => console.warn(`[WARN] ${msg}`, obj || ''),
      error: (obj, msg) => console.error(`[ERROR] ${msg}`, obj || ''),
      debug: (obj, msg) => console.debug(`[DEBUG] ${msg}`, obj || '')
    };
  }
  logger.info({ version: VERSION }, 'Wayzo server starting (fixed version)');
} catch (error) {
  console.error('Failed to initialize logger:', error);
  // Fallback to console logging
  logger = {
    info: (obj, msg) => console.log(`[INFO] ${msg}`, obj || ''),
    warn: (obj, msg) => console.warn(`[WARN] ${msg}`, obj || ''),
    error: (obj, msg) => console.error(`[ERROR] ${msg}`, obj || ''),
    debug: (obj, msg) => console.debug(`[DEBUG] ${msg}`, obj || '')
  };
  logger.info({ version: VERSION }, 'Wayzo server starting (console fallback)');
}
if (process.env.NODE_ENV !== 'production') {
  try {
    const { config } = await import('dotenv');
    config();
  } catch (e) {
    console.error('Failed to load .env:', e);
  }
}
/* Paths */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;
const FRONTEND = path.join(__dirname, '..', 'frontend');
const DOCS = path.join(ROOT, 'docs');
const UPLOADS = path.join(ROOT, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });
let INDEX = path.join(FRONTEND, 'index.backend.html');
/* App */
const app = express();
const PORT = Number(process.env.PORT || 10000);
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
app.use(compression());
app.use(morgan('combined')); // Detailed logging
app.use(cors());
app.use(rateLimit({ windowMs: 60_000, limit: 200 }));
app.use(express.json({ limit: '5mb' }));

// Global safety nets to avoid process crashes -> convert to 500 responses
process.on('unhandledRejection', (reason) => {
  try {
    logger?.error({ reason }, 'Unhandled Promise Rejection');
  } catch (_) { /* noop */ }
});
process.on('uncaughtException', (err) => {
  try {
    logger?.error({ err: err?.message, stack: err?.stack }, 'Uncaught Exception');
  } catch (_) { /* noop */ }
});

// Enhanced health check endpoint
app.get('/debug/ping', (req, res) => {
  const health = {
    ok: true,
    time: new Date().toISOString(),
    version: VERSION,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    aiQueue: aiQueue.length,
    isProcessingAI: isProcessingAI,
    openaiConfigured: !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-openai-api-key-here'
  };
  
  console.log('🏥 Health check:', { 
    uptime: Math.round(health.uptime), 
    memory: Math.round(health.memory.heapUsed / 1024 / 1024) + 'MB',
    aiQueue: health.aiQueue 
  });
  
  res.json(health);
});

// Keep-alive endpoint for Render free tier
app.get('/keep-alive', (req, res) => {
  console.log('🔄 Keep-alive ping received');
  res.json({ 
    ok: true, 
    time: new Date().toISOString(),
    message: 'Server is alive and warm'
  });
});

// Test AI endpoint
app.get('/debug/test-ai', async (req, res) => {
  try {
    console.log('Debug AI endpoint called');
    
    if (!client || !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-your-openai-api-key-here') {
      console.log('OpenAI not properly configured');
      return res.json({ 
        error: 'OpenAI not properly configured',
        apiKeyConfigured: !!process.env.OPENAI_API_KEY,
        apiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
        apiKeyIsPlaceholder: process.env.OPENAI_API_KEY === 'sk-your-openai-api-key-here',
        suggestion: 'Please set a valid OPENAI_API_KEY in your environment variables'
      });
    }
    
    console.log('OpenAI client exists, making API call...');
    
    // FIXED: Reduced timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI call timed out after 8 seconds')), 8000);
    });
    
    const aiCallPromise = client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 100,
      messages: [{ role: "user", content: "Say hello" }]
    });
    
    const response = await Promise.race([aiCallPromise, timeoutPromise]);
    
    console.log('AI response received:', response?.choices?.[0]?.message?.content?.substring(0, 50));
    
    res.json({ 
      ok: true, 
      message: 'OpenAI is working correctly',
      response: response?.choices?.[0]?.message?.content || 'No content'
    });
    
  } catch (error) {
    console.error('Test AI endpoint error:', error);
    res.status(500).json({ 
      error: error.message,
      apiKeyConfigured: !!process.env.OPENAI_API_KEY,
      apiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
      apiKeyIsPlaceholder: process.env.OPENAI_API_KEY === 'sk-your-openai-api-key-here',
      suggestion: error.message.includes('timeout') ? 'AI call timed out - check API key validity' : 'Check OpenAI API configuration'
    });
  }
});
/* Admin basic auth middleware */
const auth = (req, res, next) => {
  const credentials = Buffer.from((req.headers.authorization || '').split(' ')[1] || '', 'base64').toString('ascii').split(':');
  if (credentials[0] === 'admin' && credentials[1] === (process.env.ADMIN_PASSWORD || 'admin123')) return next();
  res.set('WWW-Authenticate', 'Basic realm="Admin"').status(401).send('Unauthorized');
};

/* Static files */
app.use('/frontend', express.static(FRONTEND));
app.use('/docs', express.static(DOCS));
app.use(express.static(FRONTEND));

/* Proxy for location detection */
app.get('/api/geo', async (_req, res) => {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const r = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(`ipapi HTTP ${r.status}`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    console.warn('geo api failed:', e.message);
    res.json({ city: 'Unknown', country_name: 'Unknown' });
  }
});

/* Healthz endpoint for Render */
app.get('/healthz', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(), 
    version: VERSION,
    uptime: process.uptime(),
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
  });
});

/* Root endpoint */
app.get('/', (req, res) => {
  try {
    const html = fs.readFileSync(INDEX, 'utf8');
    res.send(html);
  } catch (err) {
    console.error('Error serving index:', err);
    res.status(500).send('Server Error');
  }
});

// FIXED: Simple generic content validation
function validateAndFixGenericContent(markdown, destination) {
  if (!markdown || !destination) return markdown;
  
  const genericPatterns = [
    /\bLocal Restaurant\b/gi,
    /\bHistoric Old Town\b/gi,
    /\bPopular Attraction\b/gi,
    /\bTraditional Market\b/gi,
    /\bCity Center\b/gi,
    /\bMain Square\b/gi
  ];
  
  let hasGeneric = false;
  for (const pattern of genericPatterns) {
    if (pattern.test(markdown)) {
      hasGeneric = true;
      break;
    }
  }
  
  if (hasGeneric) {
    console.warn('⚠️ Generic content detected, will use fallback');
    return null; // Return null to trigger fallback
  }
  
  return markdown;
}

// FIXED: Enhanced local fallback with destination-specific content
function generateFallbackPlan(payload, mode = 'preview') {
  const { destination = 'Your Destination', adults = 2, children = 0, budget = 2000, currency = 'USD' } = payload || {};
  
  console.log(`🔄 Generating ${mode} fallback for:`, destination);
  
  // Destination-specific fallbacks
  const destinationData = {
    'Munich': {
      highlights: 'Marienplatz, Neuschwanstein Castle, Oktoberfest grounds, English Garden',
      cuisine: 'Bavarian beer halls, traditional German cuisine, pretzels and sausages',
      transport: 'Excellent public transport with S-Bahn and U-Bahn systems',
      culture: 'Rich Bavarian culture, world-famous beer gardens, Alpine traditions'
    },
    'Paris': {
      highlights: 'Eiffel Tower, Louvre Museum, Notre-Dame, Champs-Élysées',
      cuisine: 'French bistros, patisseries, wine bars, Michelin-starred restaurants',
      transport: 'Metro system, walking-friendly city center, bike rentals',
      culture: 'Art, fashion, romance, café culture, world-class museums'
    },
    'Berlin': {
      highlights: 'Brandenburg Gate, Museum Island, Berlin Wall, Checkpoint Charlie',
      cuisine: 'Currywurst, döner kebab, craft beer scene, international food markets',
      transport: 'Comprehensive U-Bahn and S-Bahn network, bike-friendly',
      culture: 'Rich history, vibrant nightlife, street art, alternative culture'
    }
  };
  
  // Find matching destination data
  let destInfo = null;
  for (const [key, data] of Object.entries(destinationData)) {
    if (destination.toLowerCase().includes(key.toLowerCase())) {
      destInfo = data;
      break;
    }
  }
  
  // Use generic fallback if no specific data found
  if (!destInfo) {
    destInfo = {
      highlights: 'Top attractions and landmarks',
      cuisine: 'Local restaurants and traditional dishes',
      transport: 'Public transportation and walking options',
      culture: 'Local customs and cultural experiences'
    };
  }
  
  const budgetPerPerson = Math.round(budget / (adults + children * 0.5));
  const totalDays = 5; // Default trip length
  
  const fallbackMarkdown = `## 🎯 Trip Overview

Welcome to your ${totalDays}-day adventure in ${destination}! This trip is designed for ${adults} adult${adults > 1 ? 's' : ''}${children > 0 ? ` and ${children} child${children > 1 ? 'ren' : ''}` : ''} with a budget of ${currency} ${budget.toLocaleString()}.

**Key Highlights:**
- ${destInfo.highlights}
- ${destInfo.culture}
- Perfect for families and culture enthusiasts

![overview](unsplash://${destination} cityscape)

## 💰 Budget Breakdown

| Category | Amount (${currency}) | Status |
|----------|------|--------|
| ☐ Accommodation | ${Math.round(budget * 0.35).toLocaleString()} | Pending |
| ☐ Food & Dining | ${Math.round(budget * 0.25).toLocaleString()} | Pending |
| ☐ Transportation | ${Math.round(budget * 0.15).toLocaleString()} | Pending |
| ☐ Activities | ${Math.round(budget * 0.20).toLocaleString()} | Pending |
| ☐ Miscellaneous | ${Math.round(budget * 0.05).toLocaleString()} | Pending |
| **Total** | **${budget.toLocaleString()}** | **Planning** |

![budget](unsplash://money travel planning)

## 🗺️ Getting Around

${destInfo.transport}

**Transportation Tips:**
- Purchase day passes for public transport
- Walking is often the best way to explore city centers
- Consider bike rentals for longer distances
- Taxi/rideshare apps are widely available

[Map](map:${destination} transportation)

![transport](unsplash://${destination} public transport)

## 🏨 Accommodation

**Recommended Areas:**
- City Center: Close to main attractions
- Historic District: Cultural immersion
- Business District: Modern amenities

**Booking Tips:**
- Book early for better rates
- Check cancellation policies
- Read recent reviews
- Consider location vs. price

[Book](book:${destination} hotels)

![accommodation](unsplash://${destination} hotels)

## 🎫 Must-See Attractions

**Top Attractions:**
1. **Main Historic Site** - Central landmark with rich history
2. **Cultural Museum** - Local art and heritage
3. **Scenic Viewpoint** - Best city panoramas
4. **Religious Monument** - Architectural marvel
5. **Local Market** - Authentic shopping experience

[Tickets](tickets:${destination} attractions)

![attractions](unsplash://${destination} landmarks)

## 🍽️ Dining Guide

${destInfo.cuisine}

**Must-Try Dishes:**
- Local specialty #1
- Traditional main course
- Famous dessert
- Regional beverage

**Dining Tips:**
- Make reservations for dinner
- Try local markets for lunch
- Ask locals for recommendations

[Reviews](reviews:${destination} restaurants)

![dining](unsplash://${destination} food)

## 🎭 Daily Itineraries

**Day 1: Arrival & Orientation**
- Morning: Arrival and check-in
- Afternoon: Walking tour of city center
- Evening: Welcome dinner at local restaurant

**Day 2: Cultural Exploration**
- Morning: Main museum visit
- Afternoon: Historic district walking tour
- Evening: Traditional cultural show

**Day 3: Local Experiences**
- Morning: Local market visit
- Afternoon: Hands-on cultural activity
- Evening: Sunset viewpoint

[Map](map:${destination} itinerary)

![itinerary](unsplash://${destination} activities)

## 🧳 Don't Forget List

☐ Valid passport/ID
☐ Travel insurance documents
☐ Local currency/cards
☐ Weather-appropriate clothing
☐ Comfortable walking shoes
☐ Phone charger/adapter
☐ Camera/phone for photos
☐ Any required medications

![packing](unsplash://travel packing)

## 🛡️ Travel Tips

**Local Customs:**
- Respect local traditions
- Learn basic greetings
- Tip according to local customs
- Dress appropriately for religious sites

**Safety Tips:**
- Keep copies of important documents
- Stay aware of your surroundings
- Use official transportation
- Keep emergency contacts handy

![tips](unsplash://travel safety)

## 📱 Useful Apps

- **Maps & Navigation**: Google Maps, local transit apps
- **Translation**: Google Translate, local language apps
- **Transportation**: Local taxi/rideshare apps
- **Food**: Restaurant discovery and delivery apps
- **Weather**: Local weather apps

![apps](unsplash://smartphone travel)

## 🚨 Emergency Info

**Emergency Numbers:**
- Police: Check local emergency number
- Medical: Check local emergency number
- Tourist Hotline: Available at hotels

**Important Contacts:**
- Embassy/Consulate information
- Travel insurance contact
- Hotel contact information
- Local emergency services

![emergency](unsplash://emergency services)`;

  return {
    markdown: fallbackMarkdown,
    source: 'fallback',
    destination,
    timestamp: new Date().toISOString()
  };
}

// FIXED: Image token processing (simplified)
function processImageTokens(markdown, destination = '') {
  if (!markdown) return markdown;
  
  // Convert ![token](unsplash://query) to proper Unsplash URLs
  return markdown.replace(/!\[([^\]]*)\]\(unsplash:\/\/([^)]+)\)/g, (match, alt, query) => {
    // Make query destination-specific if not already
    let finalQuery = query.trim();
    if (destination && !finalQuery.toLowerCase().includes(destination.toLowerCase())) {
      finalQuery = `${destination} ${finalQuery}`;
    }
    
    const encodedQuery = encodeURIComponent(finalQuery);
    const unsplashUrl = `https://source.unsplash.com/600x400/?${encodedQuery}`;
    
    return `<img src="${unsplashUrl}" alt="${alt || finalQuery}" loading="lazy" style="width: 100%; max-width: 600px; height: auto; border-radius: 8px; margin: 16px 0;" />`;
  });
}

// FIXED: Widget injection (non-duplicative)
function injectWidgets(markdown, destination) {
  if (!markdown || !destination) return markdown;
  
  // Simple GYG widget injection - only under Must-See Attractions
  const gygWidget = getGYGWidget(destination);
  
  // Inject only once, under the Must-See Attractions section
  const injected = markdown.replace(
    /(## 🎫 Must-See Attractions[^\n]*\n)/,
    `$1\n${gygWidget}\n`
  );
  
  return injected;
}

/* Database setup */
const db = new Database(path.join(ROOT, 'wayzo.db'));
db.pragma('journal_mode = WAL');

/* OpenAI setup */
console.log('OPENAI_API_KEY preview:', process.env.OPENAI_API_KEY?.substring(0, 20) + '...');

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
console.log('OpenAI client created:', !!client);
console.log('Client type:', typeof client);

// FIXED: AI Call Queue to prevent rate limits (reduced delay)
let aiQueue = [];
let isProcessingAI = false;

async function queueAICall(aiFunction) {
  return new Promise((resolve, reject) => {
    aiQueue.push({ aiFunction, resolve, reject });
    processAIQueue();
  });
}

async function processAIQueue() {
  if (isProcessingAI || aiQueue.length === 0) return;
  
  isProcessingAI = true;
  const { aiFunction, resolve, reject } = aiQueue.shift();
  
  try {
    console.log('🔄 Processing AI call from queue');
    const result = await aiFunction();
    resolve(result);
  } catch (error) {
    console.error('❌ Queued AI call failed:', error);
    reject(error);
  } finally {
    isProcessingAI = false;
    // FIXED: Reduced delay for faster processing
    if (aiQueue.length > 0) {
      setTimeout(processAIQueue, 1000); // 1s delay between calls (reduced from 2s)
    }
  }
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

/* Multer for file uploads */
const storage = multer.diskStorage({
  destination: UPLOADS,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Invalid file type'));
  }
});

async function generatePlanWithAI(payload, mode = 'preview') {
  const { destination, adults = 2, children = 0, budget = 2000, currency = 'USD', start, end } = payload || {};
  const nDays = payload.duration || 5;
  
  console.log('Step 2: Preparing AI generation for', destination, 'mode:', mode);
  console.log('- Client exists:', !!client);
  console.log('- API Key exists:', !!process.env.OPENAI_API_KEY);
  console.log('- API Key length:', process.env.OPENAI_API_KEY?.length || 0);
  console.log('- API Key is placeholder:', process.env.OPENAI_API_KEY === 'sk-your-openai-api-key-here');
  
  if (!client || !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-your-openai-api-key-here') {
    console.log('❌ OpenAI not properly configured - using fallback content');
    return generateFallbackPlan(payload, mode);
  }
  
  // Use queued AI call to prevent rate limits
  const result = await queueAICall(async () => {
    return await generateAIContent(payload, nDays, destination, budget, adults, children, mode);
  });
  
  return result;
}

// FIXED: Simplified AI content generation with proper timeouts
async function generateAIContent(payload, nDays, destination, budget, adults, children, mode = 'preview') {
  console.log('Step 3: Generating AI plan for', destination, 'in', mode, 'mode');
  
  // Extract start and end dates from payload
  const { start = '', end = '' } = payload || {};
  
  // FIXED: Reduced timeouts to prevent hanging (September 6 golden period settings)
  const timeoutMs = mode === 'full' ? 20000 : 15000; // 20s for full, 15s for preview
  const maxTokens = mode === 'full' ? 4000 : 1500; // 4000 for full, 1500 for preview
  
  try {
    // Use AbortController for hard timeout enforcement
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ AI call timeout (${timeoutMs}ms) - aborting request for ${mode} mode`);
      controller.abort();
    }, timeoutMs);
    
    // FIXED: Load simplified system prompt from file
    const systemPromptPath = path.join(__dirname, '..', 'prompts', 'wayzo_system_fixed.txt');
    let systemPrompt;
    try {
      systemPrompt = fs.readFileSync(systemPromptPath, 'utf8');
    } catch (err) {
      console.warn('Could not read system prompt file, using fallback');
      systemPrompt = `You are Wayzo Planner Pro, the world's most meticulous travel planner.

Create RICH, DETAILED trip plans with SPECIFIC, REAL places only.

MANDATORY SECTIONS (ALL MUST BE INCLUDED):
1. ## 🎯 Trip Overview
2. ## 💰 Budget Breakdown  
3. ## 🗺️ Getting Around
4. ## 🏨 Accommodation
5. ## 🎫 Must-See Attractions
6. ## 🍽️ Dining Guide
7. ## 🎭 Daily Itineraries
8. ## 🧳 Don't Forget List
9. ## 🛡️ Travel Tips
10. ## 📱 Useful Apps
11. ## 🚨 Emergency Info

Use REAL places only (e.g., Munich: Marienplatz [48.1371,11.5755], Hofbräuhaus).
NO generic content like "Local Restaurant", "Historic Old Town".
Include 1 image per section: ![token](unsplash://query)
Return both Markdown and JSON.`;
    }
    
    // FIXED: Simplified user prompt
    const userPromptPath = path.join(__dirname, '..', 'prompts', 'wayzo_user_fixed.txt');
    let userPromptTemplate;
    try {
      userPromptTemplate = fs.readFileSync(userPromptPath, 'utf8');
    } catch (err) {
      console.warn('Could not read user prompt file, using fallback');
      userPromptTemplate = `Please plan a trip to {{destination}} for {{adults}} adults${children > 0 ? ` and ${children} children` : ''} with a budget of {{currency}} {{budget_total}}.${start ? ` Dates: ${start} to ${end}.` : ''} Create detailed, specific content with real places only.`;
    }
    
    // Replace template variables
    const userPrompt = userPromptTemplate
      .replace(/\{\{destination\}\}/g, destination || 'Unknown')
      .replace(/\{\{adults\}\}/g, adults || 2)
      .replace(/\{\{children\}\}/g, children || 0)
      .replace(/\{\{children_suffix\}\}/g, children > 0 ? ` and ${children} children` : '')
      .replace(/\{\{currency\}\}/g, payload.currency || 'USD')
      .replace(/\{\{budget_total\}\}/g, budget || 2000)
      .replace(/\{\{start\}\}/g, start || 'flexible dates')
      .replace(/\{\{end\}\}/g, end || '')
      .replace(/\{\{style\}\}/g, payload.level || 'balanced')
      .replace(/\{\{dietary\}\}/g, payload.dietary || 'none')
      .replace(/\{\{prefs\}\}/g, payload.interests || 'general sightseeing')
      .replace(/\{\{flex_enabled\}\}/g, payload.dateMode === 'flexible' ? 'yes' : 'no');

    console.log(`🤖 Making OpenAI API call for ${mode} mode (timeout: ${timeoutMs}ms, maxTokens: ${maxTokens})`);
    
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // FIXED: Use cost-effective model
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);
    const aiContent = completion.choices?.[0]?.message?.content?.trim() || "";
    
    console.log(`🔍 AI response preview for ${mode} mode:`, aiContent.substring(0, 200));
    
    if (!aiContent) {
      console.warn('⚠️ Empty AI response, using fallback');
      return generateFallbackPlan(payload, mode);
    }
    
    // FIXED: Validate content for generic patterns
    const validatedContent = validateAndFixGenericContent(aiContent, destination);
    if (!validatedContent) {
      console.warn('⚠️ Generic content detected, using fallback');
      return generateFallbackPlan(payload, mode);
    }
    
    return {
      markdown: validatedContent,
      source: 'ai',
      model: 'gpt-4o-mini',
      mode,
      timestamp: new Date().toISOString()
    };
    
  } catch (aiError) {
    if (aiError.name === 'AbortError') {
      console.error(`⏰ AI call aborted due to timeout in ${mode} mode`);
      return generateFallbackPlan(payload, mode);
    }
    console.error(`❌ AI generation failed for ${mode} mode:`, aiError.message);
    return generateFallbackPlan(payload, mode);
  }
}

/* API Routes */

// FIXED: Preview endpoint with proper timeout handling
app.post('/api/preview', async (req, res) => {
  const debug = req.query.debug === '1';
  
  try {
    console.log('📝 Preview request received');
    
    const payload = req.body || {};
    if (!payload.destination) {
      return res.status(400).json({ error: 'Missing destination' });
    }

    // Normalize budget
    payload.budget = normalizeBudget(payload.budget, payload.currency);

    const id = uid();

    // FIXED: Reduced timeout for preview to prevent hanging
    const withTimeout = (promise, ms) => {
      let timeoutId;
      const timeoutPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`AI call timed out after ${ms}ms`)), ms);
      });
      return Promise.race([
        promise.finally(() => { if (timeoutId) clearTimeout(timeoutId); }),
        timeoutPromise
      ]);
    };

    // Try once, retry once on failure with brief backoff
    if (debug) console.debug('[PREVIEW] openai_call_start');
    let markdown;
    try {
      markdown = await withTimeout(generatePlanWithAI(payload, 'preview'), 20000); // FIXED: 20s timeout
    } catch (firstErr) {
      if (debug) console.debug('[PREVIEW] openai first attempt failed:', firstErr?.message);
      await new Promise(r => setTimeout(r, 1500));
      markdown = await withTimeout(generatePlanWithAI(payload, 'preview'), 20000); // FIXED: 20s timeout
    }
    if (debug) console.debug('[PREVIEW] openai_call_success mdLen=', markdown?.length || 0);

    // Process the markdown
    let processedMarkdown;
    if (typeof markdown === 'object' && markdown.markdown) {
      processedMarkdown = markdown.markdown;
    } else {
      processedMarkdown = markdown || '';
    }

    // FIXED: Apply all processing steps
    processedMarkdown = linkifyTokens(processedMarkdown, payload.destination);
    processedMarkdown = processImageTokens(processedMarkdown, payload.destination);
    processedMarkdown = injectWidgets(processedMarkdown, payload.destination);

    const html = marked(processedMarkdown);

    if (debug) console.debug('[PREVIEW] final_html_len=', html?.length || 0);

    res.json({
      id,
      teaser_html: html,
      source: markdown?.source || 'unknown',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Preview generation failed:', error);
    res.status(500).json({ 
      error: 'Failed to generate preview', 
      details: error.message 
    });
  }
});

// FIXED: Full plan endpoint with proper timeout handling
app.post('/api/plan', async (req, res) => {
  try {
    console.log('📋 Full plan request received');
    
    const payload = req.body || {};
    if (!payload.destination) {
      return res.status(400).json({ error: 'Missing destination' });
    }

    // Normalize budget
    payload.budget = normalizeBudget(payload.budget, payload.currency);
    const id = uid();

    // FIXED: Reduced timeout to avoid Render 502s
    const withTimeout = (promise, ms) => {
      let timeoutId;
      const timeoutPromise = new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          console.warn(`AI call timed out after ${ms}ms, rejecting promise`);
          reject(new Error(`AI call timed out after ${ms}ms`));
        }, ms);
      });
      
      return Promise.race([
        promise.finally(() => {
          if (timeoutId) clearTimeout(timeoutId);
        }),
        timeoutPromise
      ]);
    };

    console.log('🚀 About to call generatePlanWithAI for:', payload.destination, 'in full mode');
    const markdown = await withTimeout(generatePlanWithAI(payload, 'full'), 25000); // FIXED: 25s timeout
    console.log('✅ generatePlanWithAI completed, markdown length:', markdown?.length || 0);
    
    // Process the markdown
    let processedMarkdown;
    if (typeof markdown === 'object' && markdown.markdown) {
      processedMarkdown = markdown.markdown;
    } else {
      processedMarkdown = markdown || '';
    }

    // FIXED: Apply all processing steps
    processedMarkdown = linkifyTokens(processedMarkdown, payload.destination);
    processedMarkdown = processImageTokens(processedMarkdown, payload.destination);
    processedMarkdown = injectWidgets(processedMarkdown, payload.destination);

    const html = marked(processedMarkdown);
    
    // Store plan in database with permalink
    const permalink = `/plan/${id}`;
    try {
      storePlan(id, payload.destination, html, payload);
      console.log('💾 Plan stored with permalink:', permalink);
    } catch (dbError) {
      console.warn('⚠️ Failed to store plan in database:', dbError.message);
    }

    res.json({
      id,
      html,
      permalink,
      source: markdown?.source || 'unknown',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Full plan generation failed:', error);
    res.status(500).json({ 
      error: 'Failed to generate plan', 
      details: error.message 
    });
  }
});

// Plan permalink endpoint
app.get('/plan/:id', (req, res) => {
  try {
    const plan = getPlan(req.params.id);
    if (!plan) {
      return res.status(404).send('Plan not found');
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trip Plan: ${plan.destination}</title>
    <link rel="stylesheet" href="/style.css">
    <style>
        body { max-width: 800px; margin: 0 auto; padding: 20px; }
        .plan-header { text-align: center; margin-bottom: 30px; }
        .plan-meta { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="plan-header">
        <h1>🗺️ Trip Plan: ${plan.destination}</h1>
        <div class="plan-meta">
            Generated on ${new Date(plan.created_at).toLocaleDateString()}
        </div>
    </div>
    <div class="plan-content">
        ${plan.html}
    </div>
    <script src="/app.js"></script>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error('Error serving plan:', error);
    res.status(500).send('Server Error');
  }
});

// FIXED: PDF generation with proper error handling
app.post('/api/plan.pdf', async (req, res) => {
  let browser;
  try {
    console.log('📄 PDF generation request received');
    
    const payload = req.body || {};
    if (!payload.destination) {
      return res.status(400).json({ error: 'Missing destination for PDF generation' });
    }

    // Generate plan first
    const planResult = await generatePlanWithAI(payload, 'full');
    let processedMarkdown;
    if (typeof planResult === 'object' && planResult.markdown) {
      processedMarkdown = planResult.markdown;
    } else {
      processedMarkdown = planResult || '';
    }

    // Process the markdown
    processedMarkdown = linkifyTokens(processedMarkdown, payload.destination);
    processedMarkdown = processImageTokens(processedMarkdown, payload.destination);
    
    const html = marked(processedMarkdown);

    // Launch Puppeteer with minimal config for Render
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    });

    const page = await browser.newPage();
    
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Trip Plan: ${payload.destination}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        h1, h2, h3 { color: #333; }
        img { max-width: 100%; height: auto; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .header { text-align: center; margin-bottom: 30px; }
        @media print { body { margin: 0; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>🗺️ Trip Plan: ${payload.destination}</h1>
        <p>Generated by Wayzo on ${new Date().toLocaleDateString()}</p>
    </div>
    ${html}
</body>
</html>`;

    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 20000 });
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
      printBackground: true
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="wayzo-${payload.destination.replace(/[^a-zA-Z0-9]/g, '-')}.pdf"`);
    res.send(pdf);

  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    res.status(500).json({ error: 'PDF generation failed', details: error.message });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.warn('Warning: Failed to close browser:', closeError.message);
      }
    }
  }
});

// ICS calendar export
app.post('/api/plan.ics', async (req, res) => {
  try {
    const { destination, start, end, adults = 2, children = 0 } = req.body || {};
    
    if (!destination || !start || !end) {
      return res.status(400).json({ error: 'Missing required fields: destination, start, end' });
    }

    const icsContent = buildIcs(destination, start, end, adults, children);
    
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="trip-${destination.replace(/[^a-zA-Z0-9]/g, '-')}.ics"`);
    res.send(icsContent);
    
  } catch (error) {
    console.error('❌ ICS generation failed:', error);
    res.status(500).json({ error: 'ICS generation failed', details: error.message });
  }
});

// Admin panel
app.get('/admin', auth, (req, res) => {
  try {
    const plans = getAllPlans(50); // Get last 50 plans
    const stats = getRequestStats();
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Wayzo Admin Panel</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; flex: 1; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
    </style>
</head>
<body>
    <h1>🚀 Wayzo Admin Panel</h1>
    <p>Server Version: ${VERSION}</p>
    
    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${stats.totalPlans || 0}</div>
            <div>Total Plans</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.plansToday || 0}</div>
            <div>Plans Today</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${aiQueue.length}</div>
            <div>AI Queue</div>
        </div>
    </div>
    
    <h2>Recent Plans</h2>
    <table>
        <thead>
            <tr>
                <th>ID</th>
                <th>Destination</th>
                <th>Created</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            ${plans.map(plan => `
                <tr>
                    <td>${plan.id}</td>
                    <td>${plan.destination}</td>
                    <td>${new Date(plan.created_at).toLocaleString()}</td>
                    <td><a href="/plan/${plan.id}" target="_blank">View</a></td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    console.error('Admin panel error:', error);
    res.status(500).send('Admin panel error');
  }
});

/* Start server */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Wayzo server (${VERSION}) running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Admin panel: http://0.0.0.0:${PORT}/admin (admin:${process.env.ADMIN_PASSWORD || 'admin123'})`);
  console.log(`🏥 Health check: http://0.0.0.0:${PORT}/debug/ping`);
  console.log(`🤖 AI test: http://0.0.0.0:${PORT}/debug/test-ai`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 OpenAI configured: ${!!client}`);
});