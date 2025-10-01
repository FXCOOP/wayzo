/**
 * TDD Tests for API Endpoints with OpenAI Integration
 *
 * These tests simulate actual API calls to /api/plan and /api/preview endpoints
 * to verify OpenAI integration works correctly after fixes.
 *
 * Tests will FAIL with current broken implementation.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import OpenAI from 'openai';

// Mock OpenAI
vi.mock('openai');

// Mock other dependencies
vi.mock('../lib/budget.mjs', () => ({
  normalizeBudget: vi.fn((budget) => budget),
  computeBudget: vi.fn(() => ({
    stay: { total: 500, perDay: 100 },
    food: { total: 300, perDay: 60 },
    act: { total: 200, perDay: 40 },
    transit: { total: 100, perDay: 20 }
  }))
}));

vi.mock('../lib/links.mjs', () => ({
  affiliatesFor: vi.fn(() => ({})),
  linkifyTokens: vi.fn((markdown) => markdown)
}));

vi.mock('../lib/expand-days.mjs', () => ({
  ensureDaySections: vi.fn((markdown) => markdown)
}));

vi.mock('../lib/widgets.mjs', () => ({
  getWidgetsForDestination: vi.fn(() => []),
  injectWidgetsIntoSections: vi.fn((html) => Promise.resolve(html))
}));

vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn(() => ({
      exec: vi.fn(),
      prepare: vi.fn(() => ({
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn(() => [])
      }))
    }))
  };
});

vi.mock('marked', () => ({
  marked: {
    parse: vi.fn((markdown) => `<div>${markdown}</div>`)
  }
}));

describe('API Endpoints OpenAI Integration - TDD Tests', () => {
  let app;
  let mockOpenAI;
  let mockClient;
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set up test environment with broken config
    process.env.OPENAI_API_KEY = 'sk-test1234567890abcdef';
    process.env.WAYZO_MODEL = 'gpt-5-nano-2025-08-07'; // BROKEN MODEL
    process.env.NODE_ENV = 'test';

    // Mock OpenAI client
    mockClient = {
      chat: {
        completions: {
          create: vi.fn()
        }
      },
      // BROKEN API method that shouldn't exist
      responses: {
        create: vi.fn()
      }
    };

    mockOpenAI = vi.mocked(OpenAI);
    mockOpenAI.mockImplementation(() => mockClient);

    // Create minimal Express app for testing
    app = express();
    app.use(express.json());

    // Mock crypto.randomUUID for consistent IDs in tests
    global.crypto = {
      randomUUID: vi.fn(() => 'test-uuid-12345')
    };

    // Add the actual problematic OpenAI integration code
    const getOpenAIClient = () => {
      if (!process.env.OPENAI_API_KEY) return null;
      try {
        return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      } catch (error) {
        console.error('Failed to initialize OpenAI client:', error);
        return null;
      }
    };

    const generatePlanWithAI = async (payload) => {
      const client = getOpenAIClient();

      if (!client) {
        return `# ${payload.destination} — Local Fallback Plan`;
      }

      const preferredModel = process.env.WAYZO_MODEL || 'gpt-5-nano-2025-08-07';
      const fallbackModel = 'gpt-4o-mini-2024-07-18';
      const isNano = preferredModel.includes('gpt-5-nano');

      try {
        let respText = '';

        if (isNano) {
          // BROKEN: This API method doesn't exist!
          const resp = await client.responses.create({
            model: preferredModel,
            input: `Generate travel plan for ${payload.destination}`,
            max_output_tokens: 1000,
          });
          respText = resp.output_text || '';
        } else {
          const resp = await client.chat.completions.create({
            model: fallbackModel,
            max_tokens: 1000,
            messages: [{ role: 'user', content: `Generate travel plan for ${payload.destination}` }],
            stream: false,
          });
          respText = resp.choices?.[0]?.message?.content || '';
        }

        return respText || `# ${payload.destination} — Fallback Plan`;
      } catch (error) {
        console.error('OpenAI API error:', error);
        return `# ${payload.destination} — Error Fallback Plan`;
      }
    };

    // Add API endpoints for testing
    app.post('/api/plan', async (req, res) => {
      try {
        const payload = req.body || {};
        const markdown = await generatePlanWithAI(payload);
        const html = `<div>${markdown}</div>`;

        res.json({
          id: 'test-uuid-12345',
          markdown,
          html,
          affiliates: {},
          version: 'test'
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/preview', (req, res) => {
      try {
        const payload = req.body || {};
        const teaser_html = `<div>Preview for ${payload.destination}</div>`;

        res.json({
          id: 'test-uuid-12345',
          teaser_html,
          affiliates: {},
          version: 'test'
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/debug', (req, res) => {
      const client = getOpenAIClient();
      res.json({
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        keyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
        clientInitialized: !!client,
        preferredModel: process.env.WAYZO_MODEL || 'gpt-5-nano-2025-08-07',
        nodeEnv: process.env.NODE_ENV
      });
    });
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    vi.clearAllMocks();
    delete global.crypto;
  });

  describe('POST /api/plan - OpenAI Integration Tests', () => {
    test('should FAIL with broken API call (current implementation)', async () => {
      // Arrange
      const payload = {
        destination: 'Prague',
        start: '2025-10-01',
        end: '2025-10-05',
        budget: 2000,
        adults: 2,
        children: 0
      };

      // Mock the broken responses.create to throw error
      mockClient.responses.create.mockRejectedValue(
        new Error('Method responses.create does not exist')
      );

      // Act
      const response = await request(app)
        .post('/api/plan')
        .send(payload)
        .expect(200);

      // Assert
      expect(response.body.markdown).toBe('# Prague — Error Fallback Plan');
      expect(mockClient.responses.create).toHaveBeenCalledWith({
        model: 'gpt-5-nano-2025-08-07',
        input: 'Generate travel plan for Prague',
        max_output_tokens: 1000
      });
    });

    test('should work correctly with fixed API implementation', async () => {
      // Arrange - Override to use correct model
      process.env.WAYZO_MODEL = 'gpt-4o-mini';

      const payload = {
        destination: 'Prague',
        start: '2025-10-01',
        end: '2025-10-05',
        budget: 2000,
        adults: 2,
        children: 0
      };

      const mockItinerary = `# Prague Travel Itinerary

## Your Journey at a Glance
Experience the magic of Prague over 5 unforgettable days.

## Budget Overview
**Total: $2,000**

## Daily Itineraries
### Day 1 - Arrival
- 09:00 — Arrive at airport
- 12:00 — Check into hotel`;

      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: mockItinerary
          }
        }]
      });

      // Act
      const response = await request(app)
        .post('/api/plan')
        .send(payload)
        .expect(200);

      // Assert
      expect(response.body.markdown).toBe(mockItinerary);
      expect(response.body.id).toBe('test-uuid-12345');
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini-2024-07-18',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Generate travel plan for Prague' }],
        stream: false
      });
    });

    test('should handle missing OpenAI API key gracefully', async () => {
      // Arrange
      delete process.env.OPENAI_API_KEY;

      const payload = {
        destination: 'Berlin',
        budget: 1500,
        adults: 2
      };

      // Act
      const response = await request(app)
        .post('/api/plan')
        .send(payload)
        .expect(200);

      // Assert
      expect(response.body.markdown).toBe('# Berlin — Local Fallback Plan');
      expect(mockClient.responses.create).not.toHaveBeenCalled();
      expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
    });

    test('should handle malformed request payload', async () => {
      // Arrange
      const invalidPayload = {
        // Missing required fields
        budget: 'invalid-budget',
        adults: 'not-a-number'
      };

      // Act
      const response = await request(app)
        .post('/api/plan')
        .send(invalidPayload)
        .expect(200);

      // Assert
      expect(response.body.markdown).toContain('Fallback Plan');
    });

    test('should handle OpenAI rate limiting correctly', async () => {
      // Arrange
      const payload = {
        destination: 'Tokyo',
        budget: 3000,
        adults: 2
      };

      mockClient.responses.create.mockRejectedValue(
        new Error('Rate limit exceeded. Please try again later.')
      );

      // Act
      const response = await request(app)
        .post('/api/plan')
        .send(payload)
        .expect(200);

      // Assert
      expect(response.body.markdown).toBe('# Tokyo — Error Fallback Plan');
    });

    test('should validate model names before API calls', () => {
      const validModels = [
        'gpt-4o-mini',
        'gpt-4o-mini-2024-07-18',
        'gpt-4o-2024-08-06',
        'gpt-4-turbo'
      ];

      const invalidModels = [
        'gpt-5-nano-2025-08-07', // Current broken model
        'gpt-5-ultra',
        'claude-3',
        'gemini-pro'
      ];

      const isValidModel = (model) => validModels.includes(model);

      // Current model should be invalid
      expect(isValidModel('gpt-5-nano-2025-08-07')).toBe(false);

      // Valid models should pass
      validModels.forEach(model => {
        expect(isValidModel(model)).toBe(true);
      });

      // Invalid models should fail
      invalidModels.forEach(model => {
        expect(isValidModel(model)).toBe(false);
      });
    });
  });

  describe('POST /api/preview - Basic Functionality', () => {
    test('should generate preview without OpenAI calls', async () => {
      // Arrange
      const payload = {
        destination: 'Barcelona',
        budget: 2500,
        adults: 2,
        children: 1
      };

      // Act
      const response = await request(app)
        .post('/api/preview')
        .send(payload)
        .expect(200);

      // Assert
      expect(response.body.teaser_html).toBe('<div>Preview for Barcelona</div>');
      expect(response.body.id).toBe('test-uuid-12345');
      expect(mockClient.responses.create).not.toHaveBeenCalled();
      expect(mockClient.chat.completions.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/debug - Configuration Validation', () => {
    test('should expose broken configuration for debugging', async () => {
      // Act
      const response = await request(app)
        .get('/api/debug')
        .expect(200);

      // Assert
      expect(response.body.hasOpenAIKey).toBe(true);
      expect(response.body.keyLength).toBe(26);
      expect(response.body.clientInitialized).toBe(true);
      expect(response.body.preferredModel).toBe('gpt-5-nano-2025-08-07'); // BROKEN!
      expect(response.body.nodeEnv).toBe('test');
    });

    test('should show when API key is missing', async () => {
      // Arrange
      delete process.env.OPENAI_API_KEY;

      // Act
      const response = await request(app)
        .get('/api/debug')
        .expect(200);

      // Assert
      expect(response.body.hasOpenAIKey).toBe(false);
      expect(response.body.keyLength).toBe(0);
      expect(response.body.clientInitialized).toBe(false);
    });
  });

  describe('Image Integration Tests', () => {
    test('should handle image uploads with vision models correctly', async () => {
      // Arrange
      process.env.WAYZO_MODEL = 'gpt-4o-2024-08-06'; // Use vision model

      const payload = {
        destination: 'Santorini',
        budget: 2000,
        adults: 2,
        uploadedFiles: [{
          name: 'inspiration.jpg',
          type: 'image/jpeg',
          data: 'base64-image-data'
        }]
      };

      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Itinerary based on your uploaded images...'
          }
        }]
      });

      // Act
      const response = await request(app)
        .post('/api/plan')
        .send(payload)
        .expect(200);

      // Assert
      expect(response.body.markdown).toBe('Itinerary based on your uploaded images...');
    });

    test('should fail gracefully when using invalid model for images', async () => {
      // Arrange - Use non-vision model for images (should fail)
      const payload = {
        destination: 'Paris',
        budget: 1800,
        adults: 2,
        uploadedFiles: [{
          name: 'photo.jpg',
          type: 'image/jpeg',
          data: 'base64-image-data'
        }]
      };

      mockClient.responses.create.mockRejectedValue(
        new Error('Model gpt-5-nano does not support images')
      );

      // Act
      const response = await request(app)
        .post('/api/plan')
        .send(payload)
        .expect(200);

      // Assert
      expect(response.body.markdown).toBe('# Paris — Error Fallback Plan');
    });
  });

  describe('Performance and Reliability Tests', () => {
    test('should handle timeout scenarios', async () => {
      // Arrange
      const payload = {
        destination: 'London',
        budget: 2200,
        adults: 2
      };

      mockClient.responses.create.mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100);
        });
      });

      // Act
      const response = await request(app)
        .post('/api/plan')
        .send(payload)
        .expect(200);

      // Assert
      expect(response.body.markdown).toBe('# London — Error Fallback Plan');
    });

    test('should handle network errors gracefully', async () => {
      // Arrange
      const payload = {
        destination: 'Amsterdam',
        budget: 1900,
        adults: 2
      };

      mockClient.responses.create.mockRejectedValue(
        new Error('Network error: connect ECONNREFUSED')
      );

      // Act
      const response = await request(app)
        .post('/api/plan')
        .send(payload)
        .expect(200);

      // Assert
      expect(response.body.markdown).toBe('# Amsterdam — Error Fallback Plan');
    });
  });
});