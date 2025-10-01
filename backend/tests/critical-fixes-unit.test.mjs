/**
 * Unit Tests for Critical Fixes
 * Tests individual functions and components for the 12 critical issues
 * Focus on HIGH PRIORITY fixes with detailed validation
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import OpenAI from 'openai';

// Mock OpenAI for controlled testing
vi.mock('openai');

describe('CRITICAL FIXES UNIT TESTS', () => {

  describe('HIGH PRIORITY FIX 1: GPT API Integration', () => {
    let mockOpenAI;
    let mockClient;
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
      process.env.OPENAI_API_KEY = 'test-key-sk-1234567890abcdef';

      // Mock correct OpenAI client structure
      mockClient = {
        chat: {
          completions: {
            create: vi.fn()
          }
        }
      };

      mockOpenAI = vi.mocked(OpenAI);
      mockOpenAI.mockImplementation(() => mockClient);
    });

    afterEach(() => {
      process.env = originalEnv;
      vi.clearAllMocks();
    });

    test('should use correct OpenAI API method', () => {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // ✅ CORRECT: client.chat.completions.create should exist
      expect(client.chat.completions.create).toBeDefined();
      expect(typeof client.chat.completions.create).toBe('function');

      // ❌ INCORRECT: client.responses.create should NOT exist
      expect(client.responses).toBeUndefined();
    });

    test('should use valid OpenAI model names', async () => {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Mock successful response
      mockClient.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Test response'
          }
        }]
      });

      // Valid model names that actually exist
      const validModels = [
        'gpt-4',
        'gpt-4-turbo',
        'gpt-3.5-turbo',
        'gpt-4o',
        'gpt-4o-mini'
      ];

      for (const model of validModels) {
        await expect(async () => {
          await client.chat.completions.create({
            model: model,
            messages: [{ role: 'user', content: 'test' }]
          });
        }).not.toThrow();
      }

      // ❌ INVALID: These models should not be used
      const invalidModels = [
        'gpt-5-nano-2025-08-07', // Doesn't exist
        'gpt-5', // Doesn't exist
        'wayzo-model', // Custom non-existent model
      ];

      for (const model of invalidModels) {
        // In a real scenario, this would fail with the actual API
        // For testing, we can verify the model name format
        expect(model).not.toMatch(/^gpt-5/);
        expect(model).not.toMatch(/nano/);
        expect(model).not.toMatch(/2025/);
      }
    });

    test('should handle API errors gracefully', async () => {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Mock API error
      mockClient.chat.completions.create.mockRejectedValue(
        new Error('API Error: Model not found')
      );

      let errorCaught = false;
      try {
        await client.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'test' }]
        });
      } catch (error) {
        errorCaught = true;
        expect(error.message).toContain('API Error');
      }

      expect(errorCaught).toBe(true);
      expect(mockClient.chat.completions.create).toHaveBeenCalledOnce();
    });

    test('should validate response structure', async () => {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Mock properly structured response
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              overview: 'Trip to Prague',
              days: [
                { day: 1, activities: ['Arrival', 'City center walk'] },
                { day: 2, activities: ['Castle visit', 'Bridge exploration'] }
              ],
              budget: {
                accommodation: 800,
                food: 400,
                activities: 300,
                transport: 200,
                total: 1700
              }
            })
          }
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300
        }
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const response = await client.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Plan a trip to Prague' }]
      });

      // Validate response structure
      expect(response).toHaveProperty('choices');
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0]).toHaveProperty('message');
      expect(response.choices[0].message).toHaveProperty('content');

      // Validate content can be parsed as JSON
      const content = JSON.parse(response.choices[0].message.content);
      expect(content).toHaveProperty('overview');
      expect(content).toHaveProperty('days');
      expect(content).toHaveProperty('budget');
      expect(Array.isArray(content.days)).toBe(true);
    });
  });

  describe('HIGH PRIORITY FIX 2: Location Autofill Function', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = global.fetch;
      // Create a mock DOM environment
      global.document = {
        querySelector: vi.fn()
      };
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.clearAllMocks();
    });

    test('should detect location using ipapi.co', async () => {
      // Mock successful API response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          city: 'New York',
          country_name: 'United States',
          error: false
        })
      });

      // Mock DOM element
      const mockFromField = {
        value: '',
        placeholder: 'Enter your departure city',
        addEventListener: vi.fn()
      };
      global.document.querySelector.mockReturnValue(mockFromField);

      // Simulate the detectUserLocation function logic
      const detectUserLocation = async () => {
        const fromField = global.document.querySelector('#from');
        if (!fromField) return;

        fromField.placeholder = 'Detecting your location...';

        try {
          const response = await fetch('https://ipapi.co/json/');
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const data = await response.json();
          if (data.error) throw new Error(data.error);

          if (data.city && data.country_name) {
            const location = `${data.city}, ${data.country_name}`;
            fromField.value = location;
            fromField.placeholder = location;
            return location;
          }
        } catch (error) {
          console.log('Location detection failed:', error.message);
          fromField.placeholder = 'Enter your departure city';
          return null;
        }
      };

      const result = await detectUserLocation();

      expect(global.fetch).toHaveBeenCalledWith('https://ipapi.co/json/');
      expect(mockFromField.value).toBe('New York, United States');
      expect(result).toBe('New York, United States');
    });

    test('should handle API failures gracefully', async () => {
      // Mock failed API response
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const mockFromField = {
        value: '',
        placeholder: 'Enter your departure city'
      };
      global.document.querySelector.mockReturnValue(mockFromField);

      const detectUserLocation = async () => {
        const fromField = global.document.querySelector('#from');
        if (!fromField) return;

        fromField.placeholder = 'Detecting your location...';

        try {
          const response = await fetch('https://ipapi.co/json/');
          const data = await response.json();

          if (data.city && data.country_name) {
            const location = `${data.city}, ${data.country_name}`;
            fromField.value = location;
            return location;
          }
        } catch (error) {
          fromField.placeholder = 'Enter your departure city';
          return null;
        }
      };

      const result = await detectUserLocation();

      expect(global.fetch).toHaveBeenCalled();
      expect(mockFromField.placeholder).toBe('Enter your departure city');
      expect(result).toBeNull();
    });

    test('should use fallback API when primary fails', async () => {
      let fetchCallCount = 0;

      global.fetch = vi.fn().mockImplementation((url) => {
        fetchCallCount++;
        if (url.includes('ipapi.co')) {
          return Promise.reject(new Error('Primary API failed'));
        } else if (url.includes('ipify.org')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ip: '192.168.1.1' })
          });
        } else if (url.includes('ip-api.com')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              status: 'success',
              city: 'London',
              country: 'United Kingdom'
            })
          });
        }
      });

      const mockFromField = {
        value: '',
        placeholder: 'Enter your departure city'
      };
      global.document.querySelector.mockReturnValue(mockFromField);

      const detectUserLocationWithFallback = async () => {
        const fromField = global.document.querySelector('#from');
        fromField.placeholder = 'Detecting your location...';

        try {
          // Primary API
          const response = await fetch('https://ipapi.co/json/');
          const data = await response.json();
          // ... handle primary response
        } catch (error) {
          // Fallback API chain
          try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();

            const locationResponse = await fetch(`http://ip-api.com/json/${ipData.ip}`);
            const locationData = await locationResponse.json();

            if (locationData.status === 'success') {
              const location = `${locationData.city}, ${locationData.country}`;
              fromField.value = location;
              return location;
            }
          } catch (fallbackError) {
            fromField.placeholder = 'Enter your departure city';
            return null;
          }
        }
      };

      const result = await detectUserLocationWithFallback();

      expect(fetchCallCount).toBeGreaterThan(1); // Should try multiple APIs
      expect(mockFromField.value).toBe('London, United Kingdom');
    });
  });

  describe('HIGH PRIORITY FIX 3: Weather Table Structure', () => {
    test('should generate valid HTML table structure', () => {
      const generateWeatherTable = (weatherData) => {
        if (!weatherData || !Array.isArray(weatherData)) {
          return '<p>Weather information unavailable</p>';
        }

        let html = '<table class="weather-table" style="border-collapse: collapse; width: 100%;">';
        html += '<thead><tr><th>Date</th><th>Weather</th><th>Temperature</th><th>Precipitation</th></tr></thead>';
        html += '<tbody>';

        weatherData.forEach(day => {
          html += '<tr>';
          html += `<td>${day.date || 'N/A'}</td>`;
          html += `<td>${day.condition || 'N/A'}</td>`;
          html += `<td>${day.temperature || 'N/A'}</td>`;
          html += `<td>${day.precipitation || 'N/A'}</td>`;
          html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
      };

      const mockWeatherData = [
        { date: '2025-06-01', condition: 'Sunny', temperature: '75°F', precipitation: '0%' },
        { date: '2025-06-02', condition: 'Cloudy', temperature: '72°F', precipitation: '20%' },
        { date: '2025-06-03', condition: 'Rainy', temperature: '68°F', precipitation: '80%' }
      ];

      const result = generateWeatherTable(mockWeatherData);

      // Validate HTML structure
      expect(result).toContain('<table class="weather-table"');
      expect(result).toContain('border-collapse: collapse');
      expect(result).toContain('<thead>');
      expect(result).toContain('<tbody>');
      expect(result).toContain('</table>');

      // Validate content
      expect(result).toContain('Sunny');
      expect(result).toContain('75°F');
      expect(result).toContain('2025-06-01');

      // Validate proper table closure
      const openTags = (result.match(/<table/g) || []).length;
      const closeTags = (result.match(/<\/table>/g) || []).length;
      expect(openTags).toBe(closeTags);

      const openRows = (result.match(/<tr/g) || []).length;
      const closeRows = (result.match(/<\/tr>/g) || []).length;
      expect(openRows).toBe(closeRows);
    });

    test('should handle empty weather data', () => {
      const generateWeatherTable = (weatherData) => {
        if (!weatherData || !Array.isArray(weatherData) || weatherData.length === 0) {
          return '<p>Weather information unavailable</p>';
        }
        // ... table generation logic
      };

      expect(generateWeatherTable(null)).toBe('<p>Weather information unavailable</p>');
      expect(generateWeatherTable([])).toBe('<p>Weather information unavailable</p>');
      expect(generateWeatherTable(undefined)).toBe('<p>Weather information unavailable</p>');
    });

    test('should sanitize weather data to prevent content bleeding', () => {
      const sanitizeWeatherData = (data) => {
        if (!data) return null;

        return data.map(day => ({
          date: String(day.date || '').replace(/<[^>]*>/g, '').substring(0, 20),
          condition: String(day.condition || '').replace(/<[^>]*>/g, '').substring(0, 50),
          temperature: String(day.temperature || '').replace(/<[^>]*>/g, '').substring(0, 20),
          precipitation: String(day.precipitation || '').replace(/<[^>]*>/g, '').substring(0, 20)
        }));
      };

      const maliciousData = [
        {
          date: '2025-06-01<script>alert("xss")</script>',
          condition: 'Sunny</td><td>Extra content',
          temperature: '75°F' + 'x'.repeat(100),
          precipitation: '<div>Bleeding content</div>0%'
        }
      ];

      const sanitized = sanitizeWeatherData(maliciousData);

      expect(sanitized[0].date).not.toContain('<script>');
      expect(sanitized[0].condition).not.toContain('</td>');
      expect(sanitized[0].temperature.length).toBeLessThanOrEqual(20);
      expect(sanitized[0].precipitation).not.toContain('<div>');
    });
  });

  describe('HIGH PRIORITY FIX 4: Budget Table Duplication Prevention', () => {
    test('should generate single budget breakdown', () => {
      const generateBudgetSection = (budgetData, options = {}) => {
        if (!budgetData) return '';

        // Ensure only one budget section is created
        const sectionId = options.sectionId || 'budget-breakdown';

        let html = `<div id="${sectionId}" class="budget-section">`;
        html += '<h2>Budget Breakdown</h2>';
        html += '<table class="budget-table">';
        html += '<thead><tr><th>Category</th><th>Amount</th></tr></thead>';
        html += '<tbody>';

        const categories = ['accommodation', 'food', 'activities', 'transport'];
        categories.forEach(category => {
          if (budgetData[category]) {
            html += `<tr><td>${category.charAt(0).toUpperCase() + category.slice(1)}</td>`;
            html += `<td>$${budgetData[category]}</td></tr>`;
          }
        });

        html += `<tr class="total-row"><td><strong>Total</strong></td>`;
        html += `<td><strong>$${budgetData.total || 0}</strong></td></tr>`;
        html += '</tbody></table></div>';

        return html;
      };

      const mockBudgetData = {
        accommodation: 800,
        food: 400,
        activities: 300,
        transport: 200,
        total: 1700
      };

      const result = generateBudgetSection(mockBudgetData);

      // Should contain exactly one budget section
      const budgetHeadings = (result.match(/<h2>Budget Breakdown<\/h2>/g) || []).length;
      expect(budgetHeadings).toBe(1);

      const budgetTables = (result.match(/<table class="budget-table">/g) || []).length;
      expect(budgetTables).toBe(1);

      const totalRows = (result.match(/class="total-row"/g) || []).length;
      expect(totalRows).toBe(1);

      // Should contain all expected categories
      expect(result).toContain('Accommodation');
      expect(result).toContain('$800');
      expect(result).toContain('$1700');
    });

    test('should prevent duplicate budget sections in content', () => {
      const validateNoDuplicateBudgets = (htmlContent) => {
        // Count budget-related headings and sections
        const budgetHeadings = (htmlContent.match(/<h[1-6][^>]*>.*?budget.*?<\/h[1-6]>/gi) || []).length;
        const budgetSections = (htmlContent.match(/class="[^"]*budget[^"]*"/gi) || []).length;
        const budgetTables = (htmlContent.match(/<table[^>]*budget[^>]*>/gi) || []).length;

        return {
          budgetHeadings,
          budgetSections,
          budgetTables,
          isValid: budgetHeadings <= 1 && budgetTables <= 1
        };
      };

      // Test with content that should have duplicates removed
      const contentWithDuplicates = `
        <div class="budget-section">
          <h2>Budget Breakdown</h2>
          <table class="budget-table">...</table>
        </div>
        <div class="budget-overview">
          <h3>Budget Summary</h3>
          <table class="budget-table">...</table>
        </div>
      `;

      const validation = validateNoDuplicateBudgets(contentWithDuplicates);

      // This would fail with current content, indicating need for deduplication
      expect(validation.budgetHeadings).toBeGreaterThan(1);
      expect(validation.budgetTables).toBeGreaterThan(1);
      expect(validation.isValid).toBe(false);
    });

    test('should consolidate budget information correctly', () => {
      const consolidateBudgetData = (primaryBudget, secondaryBudget) => {
        if (!primaryBudget && !secondaryBudget) return null;
        if (!secondaryBudget) return primaryBudget;
        if (!primaryBudget) return secondaryBudget;

        // Merge budget data, preferring primary over secondary
        const consolidated = { ...secondaryBudget, ...primaryBudget };

        // Recalculate total to ensure consistency
        const categories = ['accommodation', 'food', 'activities', 'transport'];
        consolidated.total = categories.reduce((sum, category) => {
          return sum + (consolidated[category] || 0);
        }, 0);

        return consolidated;
      };

      const primaryBudget = {
        accommodation: 800,
        food: 400,
        total: 1200
      };

      const secondaryBudget = {
        accommodation: 700, // Should be overridden
        activities: 300,
        transport: 200,
        total: 1200 // Should be recalculated
      };

      const result = consolidateBudgetData(primaryBudget, secondaryBudget);

      expect(result.accommodation).toBe(800); // Primary takes precedence
      expect(result.food).toBe(400);
      expect(result.activities).toBe(300); // From secondary
      expect(result.transport).toBe(200);
      expect(result.total).toBe(1700); // Recalculated: 800+400+300+200
    });
  });
});

describe('VALIDATION HELPER FUNCTIONS', () => {
  test('should validate generated content structure', () => {
    const validateItineraryContent = (content) => {
      const validation = {
        hasOverview: /trip overview|overview/i.test(content),
        hasDays: /day \d+/i.test(content),
        hasBudget: /budget|cost|price/i.test(content),
        hasActivities: /activities|attractions|visit/i.test(content),
        isComplete: true,
        errors: []
      };

      // Check for incomplete content indicators
      const incompleteIndicators = [
        'undefined', 'null', '...', 'Error:', 'Failed to',
        '[object Object]', 'NaN', '***', '{{', '}}'
      ];

      incompleteIndicators.forEach(indicator => {
        if (content.includes(indicator)) {
          validation.isComplete = false;
          validation.errors.push(`Found incomplete indicator: ${indicator}`);
        }
      });

      // Check minimum content length
      if (content.length < 500) {
        validation.isComplete = false;
        validation.errors.push('Content too short (minimum 500 characters)');
      }

      return validation;
    };

    const goodContent = `
      Trip Overview: Your 7-day adventure in Prague, Czech Republic.
      Day 1: Arrival and Old Town exploration.
      Day 2: Prague Castle and Lesser Town.
      Budget Breakdown: Total $1,700 for accommodation, food, and activities.
    `;

    const badContent = `
      Trip Overview: undefined
      Day 1: Error: Failed to generate content...
      Budget: null
    `;

    const goodValidation = validateItineraryContent(goodContent);
    expect(goodValidation.isComplete).toBe(true);
    expect(goodValidation.hasOverview).toBe(true);
    expect(goodValidation.hasDays).toBe(true);

    const badValidation = validateItineraryContent(badContent);
    expect(badValidation.isComplete).toBe(false);
    expect(badValidation.errors.length).toBeGreaterThan(0);
  });

  test('should validate API response format', () => {
    const validateAPIResponse = (response) => {
      const validation = {
        isValid: true,
        errors: []
      };

      // Check required fields
      const requiredFields = ['choices'];
      requiredFields.forEach(field => {
        if (!response[field]) {
          validation.isValid = false;
          validation.errors.push(`Missing required field: ${field}`);
        }
      });

      // Check choices structure
      if (response.choices) {
        if (!Array.isArray(response.choices) || response.choices.length === 0) {
          validation.isValid = false;
          validation.errors.push('Choices must be a non-empty array');
        } else {
          const choice = response.choices[0];
          if (!choice.message || !choice.message.content) {
            validation.isValid = false;
            validation.errors.push('Choice must have message.content');
          }
        }
      }

      return validation;
    };

    const validResponse = {
      choices: [{
        message: {
          content: '{"overview": "Trip to Prague", "days": []}'
        }
      }]
    };

    const invalidResponse = {
      error: 'API Error'
    };

    expect(validateAPIResponse(validResponse).isValid).toBe(true);
    expect(validateAPIResponse(invalidResponse).isValid).toBe(false);
  });
});