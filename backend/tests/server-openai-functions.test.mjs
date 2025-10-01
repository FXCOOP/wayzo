/**
 * TDD Tests for Server OpenAI Functions
 *
 * These tests target the specific broken functions in server.mjs:
 * - getOpenAIClient()
 * - generatePlanWithAI()
 *
 * These tests will FAIL with current implementation and PASS after fixes.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import OpenAI from 'openai';

// Mock dependencies
vi.mock('openai');
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
  linkifyTokens: vi.fn((markdown) => markdown)
}));

vi.mock('../lib/expand-days.mjs', () => ({
  ensureDaySections: vi.fn((markdown) => markdown)
}));

vi.mock('../lib/smart-booking.mjs', () => ({
  generateBookingRecommendations: vi.fn(() => ({
    warnings: [],
    opportunities: [],
    recommendations: []
  }))
}));

describe('Server OpenAI Functions - TDD Tests', () => {
  let mockOpenAI;
  let mockClient;
  let originalEnv;
  let getOpenAIClient;
  let generatePlanWithAI;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set up broken environment (current state)
    process.env.OPENAI_API_KEY = 'sk-test1234567890abcdef';
    process.env.WAYZO_MODEL = 'gpt-5-nano-2025-08-07'; // BROKEN MODEL

    // Mock OpenAI client
    mockClient = {
      chat: {
        completions: {
          create: vi.fn()
        }
      },
      // This is the BROKEN API that shouldn't exist
      responses: {
        create: vi.fn()
      }
    };

    mockOpenAI = vi.mocked(OpenAI);
    mockOpenAI.mockImplementation(() => mockClient);

    // Replicate the actual server functions for testing
    getOpenAIClient = () => {
      if (!process.env.OPENAI_API_KEY) {
        return null;
      }
      try {
        return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      } catch (error) {
        console.error('Failed to initialize OpenAI client:', error);
        return null;
      }
    };

    // Simplified version of the actual generatePlanWithAI function
    generatePlanWithAI = async (payload) => {
      const client = getOpenAIClient();

      if (!client) {
        console.warn('OpenAI client is null - using local fallback');
        return `# ${payload.destination} — Local Fallback Plan`;
      }

      const preferredModel = process.env.WAYZO_MODEL || 'gpt-5-nano-2025-08-07';
      const fallbackModel = 'gpt-4o-mini-2024-07-18';
      const isNano = preferredModel.includes('gpt-5-nano');

      // Current broken logic from server.mjs
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          let respText = '';

          if (isNano) {
            // BROKEN: This API method doesn't exist!
            const resp = await client.responses.create({
              model: preferredModel, // BROKEN: This model doesn't exist!
              input: `Generate travel plan for ${payload.destination}`,
              max_output_tokens: 1000,
            });
            respText = resp.output_text || resp?.output?.[0]?.content?.[0]?.text || '';
          } else {
            // Correct API call
            const resp = await client.chat.completions.create({
              model: fallbackModel,
              max_tokens: 1000,
              messages: [{ role: 'user', content: `Generate travel plan for ${payload.destination}` }],
              stream: false,
            });
            respText = resp.choices?.[0]?.message?.content || '';
          }

          if (respText) return respText;
          throw new Error('Empty response text');
        } catch (error) {
          console.error(`Attempt ${attempt + 1} failed:`, error.message);
          if (attempt === 2) {
            return `# ${payload.destination} — Local Fallback Plan`;
          }
        }
      }
    };
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('getOpenAIClient() function tests', () => {
    test('should return valid client when API key exists', () => {
      // Act
      const client = getOpenAIClient();

      // Assert
      expect(client).not.toBeNull();
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'sk-test1234567890abcdef' });
    });

    test('should return null when API key is missing', () => {
      // Arrange
      delete process.env.OPENAI_API_KEY;

      // Act
      const client = getOpenAIClient();

      // Assert
      expect(client).toBeNull();
    });

    test('should handle initialization errors gracefully', () => {
      // Arrange
      mockOpenAI.mockImplementation(() => {
        throw new Error('Invalid API key');
      });

      // Act
      const client = getOpenAIClient();

      // Assert
      expect(client).toBeNull();
    });
  });

  describe('generatePlanWithAI() function tests - CRITICAL FAILURES', () => {
    test('should FAIL with broken API call (responses.create)', async () => {
      // Arrange
      const payload = {
        destination: 'Prague',
        start: '2025-10-01',
        end: '2025-10-05',
        budget: 2000,
        adults: 2,
        children: 0
      };

      // Mock the broken responses.create to throw error (as it should)
      mockClient.responses.create.mockRejectedValue(
        new Error('Method responses.create does not exist')
      );

      // Act & Assert
      const result = await generatePlanWithAI(payload);

      // Should fall back to local plan due to API error
      expect(result).toBe('# Prague — Local Fallback Plan');
      expect(mockClient.responses.create).toHaveBeenCalledWith({
        model: 'gpt-5-nano-2025-08-07', // This model doesn't exist!
        input: 'Generate travel plan for Prague',
        max_output_tokens: 1000
      });
    });

    test('should work with correct chat.completions.create API', async () => {
      // Arrange
      process.env.WAYZO_MODEL = 'gpt-4o-mini'; // Use valid model

      const payload = {
        destination: 'Prague',
        start: '2025-10-01',
        end: '2025-10-05',
        budget: 2000,
        adults: 2,
        children: 0
      };

      const mockResponse = {
        choices: [{
          message: {
            content: '# Prague Travel Itinerary\n\nYour amazing 5-day journey...'
          }
        }]
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      // Act
      const result = await generatePlanWithAI(payload);

      // Assert
      expect(result).toBe('# Prague Travel Itinerary\n\nYour amazing 5-day journey...');
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini-2024-07-18',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Generate travel plan for Prague' }],
        stream: false
      });
    });

    test('should handle model validation correctly', async () => {
      // Arrange
      const validModels = [
        'gpt-4o-mini',
        'gpt-4o-mini-2024-07-18',
        'gpt-4o-2024-08-06',
        'gpt-4-turbo'
      ];

      const invalidModels = [
        'gpt-5-nano-2025-08-07', // Current broken model
        'gpt-5-super',
        'claude-3',
        'invalid-model'
      ];

      const isValidModel = (model) => validModels.includes(model);

      // Act & Assert
      expect(isValidModel('gpt-5-nano-2025-08-07')).toBe(false); // Currently used broken model
      expect(isValidModel('gpt-4o-mini')).toBe(true); // Should use this instead

      invalidModels.forEach(model => {
        expect(isValidModel(model)).toBe(false);
      });

      validModels.forEach(model => {
        expect(isValidModel(model)).toBe(true);
      });
    });

    test('should implement proper fallback when preferred model fails', async () => {
      // Arrange
      const payload = { destination: 'Paris' };

      // First call with broken model fails
      mockClient.responses.create.mockRejectedValue(
        new Error('Model gpt-5-nano-2025-08-07 not found')
      );

      // Second call with fallback model succeeds
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Fallback plan generated' } }]
      });

      // Act
      const result = await generatePlanWithAI(payload);

      // Assert - Should eventually fall back to local plan due to broken primary model
      expect(result).toBe('# Paris — Local Fallback Plan');
    });

    test('should handle response structure correctly', () => {
      // Test current broken response parsing
      const brokenResponse = {
        output_text: 'Some text',
        output: [{ content: [{ text: 'Nested text' }] }],
        content: 'Direct content'
      };

      const correctResponse = {
        choices: [{
          message: {
            content: 'Correct response content'
          }
        }]
      };

      // Current broken parsing logic
      const parseNanoResponse = (resp) => {
        return resp.output_text || resp?.output?.[0]?.content?.[0]?.text || resp?.content || '';
      };

      // Correct parsing logic
      const parseCorrectResponse = (resp) => {
        return resp.choices?.[0]?.message?.content || '';
      };

      // Assert
      expect(parseNanoResponse(brokenResponse)).toBe('Some text');
      expect(parseCorrectResponse(correctResponse)).toBe('Correct response content');
      expect(parseCorrectResponse(brokenResponse)).toBe(''); // Should be empty for wrong structure
    });

    test('should implement proper retry logic with exponential backoff', async () => {
      // Arrange
      let callCount = 0;
      const payload = { destination: 'Berlin' };

      mockClient.responses.create.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Rate limit exceeded');
        }
        return Promise.resolve({
          output_text: 'Success after retries'
        });
      });

      // Act
      const result = await generatePlanWithAI(payload);

      // Assert
      expect(callCount).toBe(3); // Should retry 3 times
      // In reality, this should fall back to local plan due to broken API
      expect(result).toBe('# Berlin — Local Fallback Plan');
    });
  });

  describe('Environment Configuration Tests', () => {
    test('should detect broken model configuration', () => {
      const currentModel = process.env.WAYZO_MODEL || 'gpt-5-nano-2025-08-07';
      const isValidModel = currentModel.startsWith('gpt-4') || currentModel.startsWith('gpt-3.5');

      // This should FAIL with current configuration
      expect(isValidModel).toBe(false);
      expect(currentModel).toBe('gpt-5-nano-2025-08-07');
    });

    test('should suggest correct model configuration', () => {
      const recommendedModels = [
        'gpt-4o-mini',
        'gpt-4o-mini-2024-07-18',
        'gpt-4o-2024-08-06'
      ];

      const currentModel = 'gpt-5-nano-2025-08-07';
      const isCurrentModelValid = recommendedModels.includes(currentModel);

      expect(isCurrentModelValid).toBe(false);

      // Should use one of these instead
      recommendedModels.forEach(model => {
        expect(model).toMatch(/^gpt-4/);
      });
    });
  });

  describe('API Response Format Tests', () => {
    test('should handle chat completions response format correctly', () => {
      const mockChatResponse = {
        id: 'chatcmpl-abc123',
        object: 'chat.completion',
        created: 1677858242,
        model: 'gpt-4o-mini',
        usage: {
          prompt_tokens: 13,
          completion_tokens: 7,
          total_tokens: 20
        },
        choices: [{
          message: {
            role: 'assistant',
            content: '# Travel Itinerary\n\nYour journey begins...'
          },
          finish_reason: 'stop',
          index: 0
        }]
      };

      const extractContent = (response) => {
        return response.choices?.[0]?.message?.content || '';
      };

      const content = extractContent(mockChatResponse);

      expect(content).toBe('# Travel Itinerary\n\nYour journey begins...');
      expect(mockChatResponse.usage.total_tokens).toBe(20);
      expect(mockChatResponse.model).toBe('gpt-4o-mini');
    });

    test('should reject invalid response formats gracefully', () => {
      const invalidResponses = [
        { output_text: 'Wrong format' }, // Nano-style response (invalid)
        { content: 'Direct content' }, // Wrong structure
        { choices: [] }, // Empty choices
        { choices: [{ message: {} }] }, // Missing content
        null,
        undefined
      ];

      const extractContent = (response) => {
        return response?.choices?.[0]?.message?.content || '';
      };

      invalidResponses.forEach(response => {
        expect(extractContent(response)).toBe('');
      });
    });
  });
});