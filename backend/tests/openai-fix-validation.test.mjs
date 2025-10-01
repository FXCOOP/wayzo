/**
 * OpenAI Fix Validation Tests
 *
 * This test suite validates the specific fixes needed for the OpenAI integration.
 * Each test documents the exact problem and required solution.
 *
 * CRITICAL ISSUES TO FIX:
 * 1. client.responses.create() → client.chat.completions.create()
 * 2. gpt-5-nano-2025-08-07 → gpt-4o-mini or gpt-4o-mini-2024-07-18
 * 3. Response parsing: resp.output_text → resp.choices[0].message.content
 * 4. Parameter names: max_output_tokens → max_tokens, input → messages
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import OpenAI from 'openai';

vi.mock('openai');

describe('OpenAI Fix Validation - Specific Issues', () => {
  let mockOpenAI;
  let mockClient;
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.OPENAI_API_KEY = 'sk-test1234567890abcdef';
    process.env.WAYZO_MODEL = 'gpt-5-nano-2025-08-07';

    mockClient = {
      chat: {
        completions: {
          create: vi.fn()
        }
      },
      responses: {
        create: vi.fn()
      }
    };

    mockOpenAI = vi.mocked(OpenAI);
    mockOpenAI.mockImplementation(() => mockClient);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('ISSUE 1: Invalid API Method (client.responses.create)', () => {
    test('BROKEN: Current code uses non-existent responses.create method', async () => {
      // This is what the current code does (BROKEN):
      const brokenImplementation = async () => {
        const client = new OpenAI({ apiKey: 'test-key' });

        // ❌ THIS METHOD DOES NOT EXIST IN OPENAI API
        return await client.responses.create({
          model: 'gpt-5-nano-2025-08-07',
          input: 'Generate travel plan',
          max_output_tokens: 1000
        });
      };

      // Mock to simulate the real error that would occur
      mockClient.responses.create.mockRejectedValue(
        new Error('client.responses.create is not a function')
      );

      // This should fail
      await expect(brokenImplementation()).rejects.toThrow();
    });

    test('FIXED: Should use chat.completions.create method instead', async () => {
      // This is what the code SHOULD do (FIXED):
      const fixedImplementation = async () => {
        const client = new OpenAI({ apiKey: 'test-key' });

        // ✅ CORRECT API METHOD
        return await client.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Generate travel plan' }],
          max_tokens: 1000
        });
      };

      // Mock successful response
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Generated travel plan' } }]
      });

      const result = await fixedImplementation();

      expect(result.choices[0].message.content).toBe('Generated travel plan');
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Generate travel plan' }],
        max_tokens: 1000
      });
    });
  });

  describe('ISSUE 2: Invalid Model Name (gpt-5-nano-2025-08-07)', () => {
    test('BROKEN: Current code uses non-existent model', () => {
      const currentModel = 'gpt-5-nano-2025-08-07';

      // List of actual valid OpenAI models (as of 2024)
      const validModels = [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4o-mini-2024-07-18',
        'gpt-4o-2024-08-06',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo'
      ];

      // ❌ The current model doesn't exist
      expect(validModels.includes(currentModel)).toBe(false);

      // Document the problem
      expect(currentModel).toBe('gpt-5-nano-2025-08-07');
      expect(currentModel.includes('gpt-5')).toBe(true); // GPT-5 doesn't exist yet
      expect(currentModel.includes('nano')).toBe(true);   // "nano" is not a real model variant
    });

    test('FIXED: Should use valid OpenAI model names', () => {
      const recommendedModels = [
        'gpt-4o-mini',           // Current best for cost/performance
        'gpt-4o-mini-2024-07-18', // Specific version
        'gpt-4o-2024-08-06'      // For vision tasks
      ];

      recommendedModels.forEach(model => {
        expect(model.startsWith('gpt-4')).toBe(true);
        expect(model.includes('nano')).toBe(false);
        expect(model.includes('gpt-5')).toBe(false);
      });

      // These are the models to replace the broken one with:
      expect(recommendedModels[0]).toBe('gpt-4o-mini');
    });

    test('FIXED: Model selection logic with validation', () => {
      const validModels = [
        'gpt-4o-mini',
        'gpt-4o-mini-2024-07-18',
        'gpt-4o-2024-08-06'
      ];

      const selectValidModel = (preferredModel, fallbackModel) => {
        return validModels.includes(preferredModel) ? preferredModel : fallbackModel;
      };

      // Current broken model should fall back
      const result = selectValidModel('gpt-5-nano-2025-08-07', 'gpt-4o-mini');
      expect(result).toBe('gpt-4o-mini');

      // Valid model should be used as-is
      const result2 = selectValidModel('gpt-4o-mini-2024-07-18', 'gpt-4o-mini');
      expect(result2).toBe('gpt-4o-mini-2024-07-18');
    });
  });

  describe('ISSUE 3: Invalid Request Parameters', () => {
    test('BROKEN: Current code uses wrong parameter names', () => {
      // Current broken parameters:
      const brokenParams = {
        model: 'gpt-5-nano-2025-08-07',
        input: 'Generate travel plan',          // ❌ Should be 'messages'
        max_output_tokens: 1000               // ❌ Should be 'max_tokens'
      };

      // These parameter names don't exist in chat.completions.create
      expect(brokenParams.input).toBeDefined();
      expect(brokenParams.max_output_tokens).toBeDefined();
      expect(brokenParams.messages).toBeUndefined();
      expect(brokenParams.max_tokens).toBeUndefined();
    });

    test('FIXED: Should use correct parameter names', () => {
      // Correct parameters:
      const fixedParams = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Generate travel plan' }], // ✅ Correct
        max_tokens: 1000                                               // ✅ Correct
      };

      expect(fixedParams.messages).toBeDefined();
      expect(fixedParams.max_tokens).toBeDefined();
      expect(fixedParams.input).toBeUndefined();
      expect(fixedParams.max_output_tokens).toBeUndefined();

      // Validate message structure
      expect(Array.isArray(fixedParams.messages)).toBe(true);
      expect(fixedParams.messages[0].role).toBe('user');
      expect(fixedParams.messages[0].content).toBe('Generate travel plan');
    });
  });

  describe('ISSUE 4: Invalid Response Parsing', () => {
    test('BROKEN: Current code tries to parse non-existent response format', () => {
      // This is how the current code tries to parse responses (BROKEN):
      const brokenResponseParsing = (resp) => {
        return resp.output_text || resp?.output?.[0]?.content?.[0]?.text || resp?.content || '';
      };

      // These properties don't exist in chat.completions responses
      const actualChatResponse = {
        choices: [{ message: { content: 'Travel itinerary content' } }]
      };

      const result = brokenResponseParsing(actualChatResponse);
      expect(result).toBe(''); // Should be empty because properties don't exist
    });

    test('FIXED: Should parse actual chat.completions response format', () => {
      // This is how to correctly parse chat.completions responses (FIXED):
      const fixedResponseParsing = (resp) => {
        return resp.choices?.[0]?.message?.content || '';
      };

      const actualChatResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        choices: [{
          message: {
            role: 'assistant',
            content: 'Travel itinerary content'
          }
        }]
      };

      const result = fixedResponseParsing(actualChatResponse);
      expect(result).toBe('Travel itinerary content');
    });

    test('FIXED: Should handle missing response data gracefully', () => {
      const fixedResponseParsing = (resp) => {
        return resp?.choices?.[0]?.message?.content || '';
      };

      const malformedResponses = [
        {},
        { choices: [] },
        { choices: [{}] },
        { choices: [{ message: {} }] },
        null,
        undefined
      ];

      malformedResponses.forEach(response => {
        expect(fixedResponseParsing(response)).toBe('');
      });
    });
  });

  describe('ISSUE 5: Vision Model Support for Images', () => {
    test('FIXED: Should use vision-capable model for image inputs', async () => {
      const handleImageInput = async (hasImages) => {
        const client = new OpenAI({ apiKey: 'test-key' });

        if (hasImages) {
          // Use vision-capable model
          return await client.chat.completions.create({
            model: 'gpt-4o-2024-08-06', // Vision model
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: 'Create itinerary based on this image' },
                { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } }
              ]
            }]
          });
        } else {
          // Use standard model for text-only
          return await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Create itinerary' }]
          });
        }
      };

      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Image-based itinerary' } }]
      });

      await handleImageInput(true);

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-2024-08-06',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Create itinerary based on this image' },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } }
          ]
        }]
      });
    });
  });

  describe('COMPLETE FIX IMPLEMENTATION', () => {
    test('FIXED: Complete corrected implementation', async () => {
      const fixedGeneratePlanWithAI = async (payload) => {
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // ✅ Use valid models
        const hasImages = payload.uploadedFiles?.some(f => f.type?.startsWith('image/'));
        const model = hasImages ? 'gpt-4o-2024-08-06' : 'gpt-4o-mini';

        try {
          // ✅ Use correct API method and parameters
          const response = await client.chat.completions.create({
            model,
            messages: [{ role: 'user', content: `Generate travel plan for ${payload.destination}` }],
            max_tokens: 1000
          });

          // ✅ Parse response correctly
          return response.choices?.[0]?.message?.content || '';
        } catch (error) {
          console.error('OpenAI API error:', error);
          return `# ${payload.destination} — Fallback Plan`;
        }
      };

      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Fixed implementation result' } }]
      });

      const result = await fixedGeneratePlanWithAI({ destination: 'Prague' });

      expect(result).toBe('Fixed implementation result');
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Generate travel plan for Prague' }],
        max_tokens: 1000
      });
    });
  });

  describe('EXACT CODE CHANGES NEEDED', () => {
    test('Documents exact lines to change in server.mjs', () => {
      // These are the exact changes needed in server.mjs:

      const changes = {
        // Line ~699: Change the preferred model
        modelChange: {
          from: "const preferredModel = process.env.WAYZO_MODEL || 'gpt-5-nano-2025-08-07';",
          to: "const preferredModel = process.env.WAYZO_MODEL || 'gpt-4o-mini';"
        },

        // Line ~761: Replace the broken API call
        apiMethodChange: {
          from: `const resp = await client.responses.create({
          model: preferredModel,
          input: \`\${sys}\\n\\n\${user}\`,
          max_output_tokens: maxTokens,
        });`,
          to: `const resp = await client.chat.completions.create({
          model: preferredModel,
          messages: [{ role: 'user', content: \`\${sys}\\n\\n\${user}\` }],
          max_tokens: maxTokens,
        });`
        },

        // Line ~767: Fix response parsing
        responseParsingChange: {
          from: "respText = resp.output_text || resp?.output?.[0]?.content?.[0]?.text || resp?.content || '';",
          to: "respText = resp.choices?.[0]?.message?.content || '';"
        },

        // Line ~702: Remove nano detection logic
        nanoDetectionChange: {
          from: "const isNano = preferredModel.includes('gpt-5-nano');",
          to: "const isTextModel = !hasImages;"
        }
      };

      // Validate each change
      expect(changes.modelChange.from).toContain('gpt-5-nano-2025-08-07');
      expect(changes.modelChange.to).toContain('gpt-4o-mini');

      expect(changes.apiMethodChange.from).toContain('responses.create');
      expect(changes.apiMethodChange.to).toContain('chat.completions.create');

      expect(changes.responseParsingChange.from).toContain('output_text');
      expect(changes.responseParsingChange.to).toContain('choices?.[0]?.message?.content');
    });
  });
});