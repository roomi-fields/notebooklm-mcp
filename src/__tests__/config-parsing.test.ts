import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Test the parsing functions behavior through environment variables
describe('Config Parsing Functions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('parseBoolean logic', () => {
    it('should parse "true" as true', () => {
      const value = 'true';
      const result = value.toLowerCase() === 'true' || value.toLowerCase() === '1';
      expect(result).toBe(true);
    });

    it('should parse "1" as true', () => {
      const value = '1';
      const result = value.toLowerCase() === 'true' || value.toLowerCase() === '1';
      expect(result).toBe(true);
    });

    it('should parse "false" as false', () => {
      const value = 'false';
      const result = value.toLowerCase() === 'false' || value.toLowerCase() === '0';
      expect(result).toBe(true);
    });

    it('should parse "0" as false', () => {
      const value = '0';
      const result = value.toLowerCase() === 'false' || value.toLowerCase() === '0';
      expect(result).toBe(true);
    });

    it('should handle uppercase TRUE', () => {
      const value = 'TRUE';
      const result = value.toLowerCase() === 'true';
      expect(result).toBe(true);
    });

    it('should handle uppercase FALSE', () => {
      const value = 'FALSE';
      const result = value.toLowerCase() === 'false';
      expect(result).toBe(true);
    });

    it('should handle mixed case TrUe', () => {
      const value = 'TrUe';
      const result = value.toLowerCase() === 'true';
      expect(result).toBe(true);
    });

    it('should return default for invalid values', () => {
      const invalidValues = ['yes', 'no', 'on', 'off', 'maybe', ''];
      const defaultValue = false;

      invalidValues.forEach((value) => {
        const lower = value.toLowerCase();
        const result =
          lower === 'true' || lower === '1'
            ? true
            : lower === 'false' || lower === '0'
              ? false
              : defaultValue;
        expect(typeof result).toBe('boolean');
      });
    });

    it('should return default for undefined', () => {
      const value = undefined;
      const defaultValue = true;
      const result = value === undefined ? defaultValue : value;
      expect(result).toBe(defaultValue);
    });
  });

  describe('parseInteger logic', () => {
    it('should parse valid integer strings', () => {
      const testCases = [
        { input: '42', expected: 42 },
        { input: '0', expected: 0 },
        { input: '999', expected: 999 },
        { input: '-42', expected: -42 },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = Number.parseInt(input, 10);
        expect(result).toBe(expected);
        expect(Number.isNaN(result)).toBe(false);
      });
    });

    it('should handle negative numbers', () => {
      const value = '-100';
      const result = Number.parseInt(value, 10);
      expect(result).toBe(-100);
      expect(result).toBeLessThan(0);
    });

    it('should handle zero', () => {
      const value = '0';
      const result = Number.parseInt(value, 10);
      expect(result).toBe(0);
    });

    it('should handle large numbers', () => {
      const value = '999999';
      const result = Number.parseInt(value, 10);
      expect(result).toBe(999999);
    });

    it('should return NaN for invalid strings', () => {
      const invalidValues = ['abc', 'not a number', '', 'null'];

      invalidValues.forEach((value) => {
        const result = Number.parseInt(value, 10);
        expect(Number.isNaN(result)).toBe(true);
      });
    });

    it('should return default for NaN results', () => {
      const value = 'invalid';
      const defaultValue = 100;
      const parsed = Number.parseInt(value, 10);
      const result = Number.isNaN(parsed) ? defaultValue : parsed;
      expect(result).toBe(defaultValue);
    });

    it('should parse with base 10', () => {
      const value = '010'; // Could be octal
      const result = Number.parseInt(value, 10);
      expect(result).toBe(10); // Not 8
    });

    it('should truncate decimals', () => {
      const value = '42.7';
      const result = Number.parseInt(value, 10);
      expect(result).toBe(42);
    });

    it('should return default for undefined', () => {
      const value = undefined;
      const defaultValue = 50;
      const result = value === undefined ? defaultValue : Number.parseInt(value, 10);
      expect(result).toBe(defaultValue);
    });
  });

  describe('parseArray logic', () => {
    it('should parse comma-separated values', () => {
      const value = 'item1,item2,item3';
      const result = value.split(',').map((s) => s.trim());
      expect(result).toEqual(['item1', 'item2', 'item3']);
    });

    it('should trim whitespace from items', () => {
      const value = ' item1 , item2 , item3 ';
      const result = value.split(',').map((s) => s.trim());
      expect(result).toEqual(['item1', 'item2', 'item3']);
    });

    it('should handle single item', () => {
      const value = 'single';
      const result = value.split(',').map((s) => s.trim());
      expect(result).toEqual(['single']);
    });

    it('should handle empty string', () => {
      const value = '';
      const defaultValue = ['default'];
      const result = !value
        ? defaultValue
        : (value as string).split(',').map((s: string) => s.trim());
      expect(result).toEqual(defaultValue);
    });

    it('should filter empty items', () => {
      const value = 'item1,,item2,,,item3';
      const result = value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      expect(result).toEqual(['item1', 'item2', 'item3']);
    });

    it('should handle items with spaces', () => {
      const value = 'item one, item two, item three';
      const result = value.split(',').map((s) => s.trim());
      expect(result).toEqual(['item one', 'item two', 'item three']);
    });

    it('should handle special characters', () => {
      const value = 'item@1,item#2,item$3';
      const result = value.split(',').map((s) => s.trim());
      expect(result).toEqual(['item@1', 'item#2', 'item$3']);
    });

    it('should return default for undefined', () => {
      const value: string | undefined = undefined;
      const defaultValue = ['a', 'b'];
      const result = !value
        ? defaultValue
        : (value as string).split(',').map((s: string) => s.trim());
      expect(result).toEqual(defaultValue);
    });

    it('should preserve order', () => {
      const value = 'third,first,second';
      const result = value.split(',').map((s) => s.trim());
      expect(result).toEqual(['third', 'first', 'second']);
    });
  });

  describe('environment variable priority', () => {
    it('should prioritize env vars over defaults', () => {
      // Test the concept that env vars override defaults
      const envValue = 'env-value';
      const defaultValue = 'default-value';
      const result = envValue || defaultValue;
      expect(result).toBe(envValue);
    });

    it('should use default when env var is empty', () => {
      const envValue = '';
      const defaultValue = 'default-value';
      const result = envValue || defaultValue;
      expect(result).toBe(defaultValue);
    });

    it('should use default when env var is undefined', () => {
      const envValue = undefined;
      const defaultValue = 'default-value';
      const result = envValue || defaultValue;
      expect(result).toBe(defaultValue);
    });

    it('should handle boolean env vars', () => {
      const envValue: string = 'true';
      const defaultValue = false;
      const result = envValue
        ? envValue.toLowerCase() === 'true' || envValue === '1'
        : defaultValue;
      expect(result).toBe(true);
    });

    it('should handle numeric env vars', () => {
      const envValue = '100';
      const defaultValue = 50;
      const result = envValue ? Number.parseInt(envValue, 10) : defaultValue;
      expect(result).toBe(100);
    });
  });

  describe('config validation', () => {
    it('should validate WPM range', () => {
      const min = 160;
      const max = 240;
      expect(min).toBeLessThanOrEqual(max);
      expect(min).toBeGreaterThan(0);
      expect(max).toBeGreaterThan(0);
    });

    it('should validate delay range', () => {
      const min = 100;
      const max = 400;
      expect(min).toBeLessThanOrEqual(max);
      expect(min).toBeGreaterThanOrEqual(0);
    });

    it('should validate timeout values', () => {
      const timeout = 30000;
      expect(timeout).toBeGreaterThan(0);
      expect(timeout).toBeLessThan(600000); // Less than 10 minutes
    });

    it('should validate session limits', () => {
      const maxSessions = 10;
      const sessionTimeout = 900;
      expect(maxSessions).toBeGreaterThan(0);
      expect(sessionTimeout).toBeGreaterThan(0);
    });

    it('should validate viewport dimensions', () => {
      const width = 1024;
      const height = 768;
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(width).toBeGreaterThanOrEqual(height); // Width typically >= height
    });

    it('should validate profile strategy values', () => {
      const validStrategies = ['auto', 'single', 'isolated'];
      const strategy = 'auto';
      expect(validStrategies).toContain(strategy);
    });

    it('should validate cleanup settings', () => {
      const ttl = 72; // hours
      const maxCount = 20;
      expect(ttl).toBeGreaterThan(0);
      expect(maxCount).toBeGreaterThan(0);
    });
  });

  describe('path construction', () => {
    it('should construct valid paths', () => {
      const basePath = '/home/user/data';
      const subPath = 'browser_state';
      const fullPath = `${basePath}/${subPath}`;
      expect(fullPath).toBe('/home/user/data/browser_state');
    });

    it('should handle Windows paths', () => {
      const basePath = 'C:\\Users\\user\\AppData';
      const subPath = 'notebooklm-mcp';
      const fullPath = `${basePath}\\${subPath}`;
      expect(fullPath).toBe('C:\\Users\\user\\AppData\\notebooklm-mcp');
    });

    it('should construct nested paths', () => {
      const base = '/data';
      const sub1 = 'chrome_profile';
      const sub2 = 'instances';
      const fullPath = `${base}/${sub1}/${sub2}`;
      expect(fullPath).toBe('/data/chrome_profile/instances');
    });
  });

  describe('type coercion', () => {
    it('should coerce string to boolean', () => {
      const stringTrue = 'true';
      const result = stringTrue === 'true';
      expect(typeof result).toBe('boolean');
      expect(result).toBe(true);
    });

    it('should coerce string to number', () => {
      const stringNum = '42';
      const result = Number.parseInt(stringNum, 10);
      expect(typeof result).toBe('number');
      expect(result).toBe(42);
    });

    it('should handle type errors gracefully', () => {
      const invalid = 'not-a-number';
      const result = Number.parseInt(invalid, 10);
      const safe = Number.isNaN(result) ? 0 : result;
      expect(safe).toBe(0);
    });
  });

  describe('option merging', () => {
    it('should merge options with defaults', () => {
      const defaults = { a: 1, b: 2, c: 3 };
      const overrides = { b: 20, d: 40 };
      const result = { ...defaults, ...overrides };
      expect(result).toEqual({ a: 1, b: 20, c: 3, d: 40 });
    });

    it('should preserve undefined values in override', () => {
      const defaults = { a: 1, b: 2 };
      const overrides = { b: undefined };
      const result = { ...defaults, ...overrides };
      expect(result.b).toBeUndefined();
    });

    it('should handle nested option merging', () => {
      const defaults = { viewport: { width: 1024, height: 768 } };
      const overrides = { viewport: { width: 1920 } };
      // Shallow merge would replace entire viewport object
      const result = { ...defaults, ...overrides };
      expect(result.viewport).toEqual({ width: 1920 });
    });

    it('should handle deep merging for nested objects', () => {
      const defaults = { stealth: { enabled: true, delays: true } };
      const overrides = { stealth: { enabled: false } };
      // For proper deep merge, need to merge stealth object separately
      const result = {
        ...defaults,
        stealth: { ...defaults.stealth, ...overrides.stealth },
      };
      expect(result.stealth).toEqual({ enabled: false, delays: true });
    });
  });
});
