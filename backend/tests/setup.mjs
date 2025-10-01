/**
 * Test Setup File for Wayzo Backend OpenAI Integration Tests
 *
 * This file sets up the testing environment and mocks for all tests.
 */

import { vi } from 'vitest';

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();

  // Set up console mocking to reduce noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  // Mock crypto.randomUUID for consistent test IDs
  global.crypto = {
    randomUUID: vi.fn(() => 'test-uuid-12345')
  };

  // Mock Date for consistent timestamps
  const mockDate = new Date('2025-10-01T10:00:00Z');
  vi.setSystemTime(mockDate);
});

afterEach(() => {
  // Restore mocks after each test
  vi.restoreAllMocks();

  // Clean up global mocks
  delete global.crypto;
  vi.useRealTimers();
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export test utilities
export const createMockOpenAIClient = () => {
  return {
    chat: {
      completions: {
        create: vi.fn()
      }
    },
    // This is the broken API that shouldn't exist
    responses: {
      create: vi.fn()
    }
  };
};

export const createMockItineraryResponse = (destination = 'Test Destination') => {
  return `# ${destination} Travel Itinerary

## 🎯 Your Journey at a Glance
Experience the magic of ${destination} over 5 unforgettable days.

## 💰 Budget Overview
**Total Budget: $2,000** ($200/person/day)

## 🗺️ Getting Around
Local transportation options and tips.

## 🏨 Where to Stay
Excellent hotel recommendations.

## 🎫 Must-See Attractions
Top attractions and booking information.

## 🍽️ Dining Guide
Best restaurants by area.

## 🎭 Daily Itineraries
### Day 1 - Arrival & Exploration
- 09:00 — Arrive at airport
- 12:00 — Check into hotel
- 14:00 — Walking tour of city center
- 18:00 — Welcome dinner

### Day 2 - Cultural Discovery
- 09:00 — Museum visit
- 12:00 — Local lunch
- 14:00 — Historical sites
- 17:00 — Scenic viewpoint
- 19:00 — Traditional dinner

## 🧳 Don't Forget List
Essential packing items.

## 🛡️ Travel Tips
Important local information.

## 📱 Useful Apps
Recommended mobile apps.

## 🚨 Emergency Info
Emergency contacts and information.

## ⚠️ Disclaimer
Prices and availability subject to change.`;
};

export const createValidChatCompletionResponse = (content) => {
  return {
    id: 'chatcmpl-test123',
    object: 'chat.completion',
    created: 1677858242,
    model: 'gpt-4o-mini',
    usage: {
      prompt_tokens: 100,
      completion_tokens: 500,
      total_tokens: 600
    },
    choices: [{
      message: {
        role: 'assistant',
        content: content
      },
      finish_reason: 'stop',
      index: 0
    }]
  };
};

export const createInvalidNanoResponse = (content) => {
  // This is the broken response format that doesn't exist
  return {
    output_text: content,
    output: [{
      content: [{
        text: content
      }]
    }],
    content: content
  };
};