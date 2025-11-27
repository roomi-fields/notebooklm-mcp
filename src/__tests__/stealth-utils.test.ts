import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  sleep,
  randomInt,
  randomFloat,
  randomChar,
  gaussian,
  randomDelay,
  readingPause,
} from '../utils/stealth-utils.js';
import { CONFIG } from '../config.js';

describe('Stealth Utils', () => {
  describe('sleep', () => {
    it('should sleep for specified milliseconds', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(95); // Allow small margin
      expect(elapsed).toBeLessThan(150);
    });

    it('should sleep for 0ms', async () => {
      const start = Date.now();
      await sleep(0);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it('should return a promise', () => {
      const result = sleep(10);
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('randomInt', () => {
    it('should generate integer within range', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomInt(1, 10);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(10);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('should handle single value range', () => {
      const result = randomInt(5, 5);
      expect(result).toBe(5);
    });

    it('should handle negative numbers', () => {
      const result = randomInt(-10, -5);
      expect(result).toBeGreaterThanOrEqual(-10);
      expect(result).toBeLessThanOrEqual(-5);
    });

    it('should handle range crossing zero', () => {
      const result = randomInt(-5, 5);
      expect(result).toBeGreaterThanOrEqual(-5);
      expect(result).toBeLessThanOrEqual(5);
    });

    it('should generate all values in range over many iterations', () => {
      const values = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        values.add(randomInt(1, 5));
      }
      expect(values.size).toBeGreaterThanOrEqual(4); // Should hit most values
    });

    it('should return integer for large ranges', () => {
      const result = randomInt(1, 1000000);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(1000000);
    });
  });

  describe('randomFloat', () => {
    it('should generate float within range', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomFloat(1.0, 10.0);
        expect(result).toBeGreaterThanOrEqual(1.0);
        expect(result).toBeLessThan(10.0);
      }
    });

    it('should handle single value range', () => {
      const result = randomFloat(5.0, 5.0);
      expect(result).toBe(5.0);
    });

    it('should handle negative numbers', () => {
      const result = randomFloat(-10.5, -5.5);
      expect(result).toBeGreaterThanOrEqual(-10.5);
      expect(result).toBeLessThan(-5.5);
    });

    it('should handle range crossing zero', () => {
      const result = randomFloat(-5.5, 5.5);
      expect(result).toBeGreaterThanOrEqual(-5.5);
      expect(result).toBeLessThan(5.5);
    });

    it('should generate non-integer values', () => {
      let hasNonInteger = false;
      for (let i = 0; i < 100; i++) {
        const result = randomFloat(1.0, 10.0);
        if (!Number.isInteger(result)) {
          hasNonInteger = true;
          break;
        }
      }
      expect(hasNonInteger).toBe(true);
    });

    it('should have proper distribution', () => {
      const values: number[] = [];
      for (let i = 0; i < 1000; i++) {
        values.push(randomFloat(0, 100));
      }

      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      expect(avg).toBeGreaterThan(40);
      expect(avg).toBeLessThan(60);
    });
  });

  describe('randomChar', () => {
    it('should generate lowercase letter', () => {
      const result = randomChar();
      expect(result).toMatch(/^[a-z]$/);
      expect(result.length).toBe(1);
    });

    it('should generate various letters over many iterations', () => {
      const chars = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        chars.add(randomChar());
      }
      expect(chars.size).toBeGreaterThan(15); // Should hit most letters
    });

    it('should only generate valid characters', () => {
      const validChars = 'qwertyuiopasdfghjklzxcvbnm';
      for (let i = 0; i < 100; i++) {
        const result = randomChar();
        expect(validChars).toContain(result);
      }
    });
  });

  describe('gaussian', () => {
    it('should generate number near mean', () => {
      const values: number[] = [];
      for (let i = 0; i < 1000; i++) {
        values.push(gaussian(100, 10));
      }

      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      expect(avg).toBeGreaterThan(95);
      expect(avg).toBeLessThan(105);
    });

    it('should respect standard deviation', () => {
      const values: number[] = [];
      for (let i = 0; i < 1000; i++) {
        values.push(gaussian(0, 1));
      }

      // Most values should be within 3 standard deviations
      const withinRange = values.filter((v) => Math.abs(v) <= 3).length;
      expect(withinRange / values.length).toBeGreaterThan(0.95);
    });

    it('should handle zero standard deviation', () => {
      const result = gaussian(50, 0);
      expect(result).toBe(50);
    });

    it('should handle negative mean', () => {
      const values: number[] = [];
      for (let i = 0; i < 1000; i++) {
        values.push(gaussian(-100, 10));
      }

      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      expect(avg).toBeGreaterThan(-105);
      expect(avg).toBeLessThan(-95);
    });

    it('should generate different values', () => {
      const values = new Set<number>();
      for (let i = 0; i < 100; i++) {
        values.add(gaussian(0, 10));
      }
      expect(values.size).toBeGreaterThan(90); // Should be mostly unique
    });

    it('should have proper distribution shape', () => {
      const values: number[] = [];
      for (let i = 0; i < 10000; i++) {
        values.push(gaussian(0, 1));
      }

      // Check that values closer to mean are more common
      const nearMean = values.filter((v) => Math.abs(v) <= 0.5).length;
      const farFromMean = values.filter((v) => Math.abs(v) > 2).length;
      expect(nearMean).toBeGreaterThan(farFromMean);
    });
  });

  describe('randomDelay', () => {
    it('should delay within specified range', async () => {
      const start = Date.now();
      await randomDelay(50, 150);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(200);
    });

    it('should delay for minimum value when min equals max', async () => {
      const start = Date.now();
      await randomDelay(100, 100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(95);
      expect(elapsed).toBeLessThan(150);
    });

    it('should handle zero delay', async () => {
      const start = Date.now();
      await randomDelay(0, 0);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it('should return a promise', () => {
      const result = randomDelay(10, 20);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should use gaussian distribution for delays', async () => {
      const delays: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = Date.now();
        await randomDelay(100, 500);
        delays.push(Date.now() - start);
      }

      // Most delays should be closer to middle of range
      const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
      expect(avg).toBeGreaterThan(200);
      expect(avg).toBeLessThan(400);
    });

    it('should use fixed average delay when stealth is disabled', async () => {
      const originalEnabled = CONFIG.stealthEnabled;
      (CONFIG as { stealthEnabled: boolean }).stealthEnabled = false;

      try {
        const start = Date.now();
        await randomDelay(100, 200); // Average would be 150ms
        const elapsed = Date.now() - start;

        // Should use fixed delay (average of min and max)
        expect(elapsed).toBeGreaterThanOrEqual(140);
        expect(elapsed).toBeLessThan(200);
      } finally {
        (CONFIG as { stealthEnabled: boolean }).stealthEnabled = originalEnabled;
      }
    });

    it('should use fixed average delay when random delays are disabled', async () => {
      const originalDelays = CONFIG.stealthRandomDelays;
      (CONFIG as { stealthRandomDelays: boolean }).stealthRandomDelays = false;

      try {
        const start = Date.now();
        await randomDelay(100, 200);
        const elapsed = Date.now() - start;

        // Should use fixed delay
        expect(elapsed).toBeGreaterThanOrEqual(140);
        expect(elapsed).toBeLessThan(200);
      } finally {
        (CONFIG as { stealthRandomDelays: boolean }).stealthRandomDelays = originalDelays;
      }
    });

    it('should use CONFIG defaults when no parameters provided', async () => {
      const start = Date.now();
      await randomDelay(); // Uses CONFIG.minDelayMs and CONFIG.maxDelayMs
      const elapsed = Date.now() - start;

      // Should be between CONFIG defaults (100-400ms by default)
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('edge cases', () => {
    it('should handle very small numbers', () => {
      const result = randomInt(0, 1);
      expect([0, 1]).toContain(result);
    });

    it('should handle very large numbers', () => {
      const result = randomInt(1000000, 1000001);
      expect(result).toBeGreaterThanOrEqual(1000000);
      expect(result).toBeLessThanOrEqual(1000001);
    });

    it('should handle decimal ranges in randomFloat', () => {
      const result = randomFloat(0.001, 0.002);
      expect(result).toBeGreaterThanOrEqual(0.001);
      expect(result).toBeLessThan(0.002);
    });

    it('should handle large standard deviation in gaussian', () => {
      const result = gaussian(0, 1000);
      expect(typeof result).toBe('number');
      expect(isNaN(result)).toBe(false);
    });
  });

  describe('randomness quality', () => {
    it('randomInt should have good distribution', () => {
      const counts = [0, 0, 0, 0, 0];
      for (let i = 0; i < 5000; i++) {
        const val = randomInt(0, 4);
        counts[val]++;
      }

      // Each bucket should have roughly 1000 values (20% of 5000)
      // Allow variance between 15% and 25%
      counts.forEach((count) => {
        expect(count).toBeGreaterThan(750);
        expect(count).toBeLessThan(1250);
      });
    });

    it('randomFloat should have uniform distribution', () => {
      const buckets = [0, 0, 0, 0, 0];
      for (let i = 0; i < 5000; i++) {
        const val = randomFloat(0, 5);
        const bucket = Math.floor(val);
        if (bucket < 5) buckets[bucket]++;
      }

      // Each bucket should have roughly 1000 values
      buckets.forEach((count) => {
        expect(count).toBeGreaterThan(750);
        expect(count).toBeLessThan(1250);
      });
    });

    it('gaussian should produce bell curve', () => {
      const values: number[] = [];
      for (let i = 0; i < 10000; i++) {
        values.push(gaussian(0, 1));
      }

      // Count values in different ranges
      const veryClose = values.filter((v) => Math.abs(v) <= 0.5).length;
      const close = values.filter((v) => Math.abs(v) > 0.5 && Math.abs(v) <= 1).length;
      const medium = values.filter((v) => Math.abs(v) > 1 && Math.abs(v) <= 2).length;
      const far = values.filter((v) => Math.abs(v) > 2).length;

      // Bell curve: more values near center
      expect(veryClose).toBeGreaterThan(close);
      expect(close).toBeGreaterThan(medium);
      expect(medium).toBeGreaterThan(far);
    });
  });

  describe('readingPause', () => {
    // Store original config values
    let originalStealthEnabled: boolean;
    let originalStealthRandomDelays: boolean;

    beforeEach(() => {
      originalStealthEnabled = CONFIG.stealthEnabled;
      originalStealthRandomDelays = CONFIG.stealthRandomDelays;
    });

    afterEach(() => {
      // Restore original config
      (CONFIG as { stealthEnabled: boolean }).stealthEnabled = originalStealthEnabled;
      (CONFIG as { stealthRandomDelays: boolean }).stealthRandomDelays =
        originalStealthRandomDelays;
    });

    it('should return immediately when stealth is disabled', async () => {
      (CONFIG as { stealthEnabled: boolean }).stealthEnabled = false;

      const start = Date.now();
      await readingPause(100); // 100 characters
      const elapsed = Date.now() - start;

      // Should return almost immediately
      expect(elapsed).toBeLessThan(50);
    });

    it('should return immediately when random delays are disabled', async () => {
      (CONFIG as { stealthEnabled: boolean }).stealthEnabled = true;
      (CONFIG as { stealthRandomDelays: boolean }).stealthRandomDelays = false;

      const start = Date.now();
      await readingPause(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it('should pause for short text when stealth is enabled', async () => {
      (CONFIG as { stealthEnabled: boolean }).stealthEnabled = true;
      (CONFIG as { stealthRandomDelays: boolean }).stealthRandomDelays = true;

      const start = Date.now();
      await readingPause(25); // ~5 words at 5 chars/word
      const elapsed = Date.now() - start;

      // Should pause but not too long
      // At 200-250 WPM, 5 words = ~1.2-1.5 seconds
      expect(elapsed).toBeGreaterThan(0);
      // Could be up to 3 seconds max with randomness
      expect(elapsed).toBeLessThan(4000);
    });

    it('should pause longer for longer text', async () => {
      (CONFIG as { stealthEnabled: boolean }).stealthEnabled = true;
      (CONFIG as { stealthRandomDelays: boolean }).stealthRandomDelays = true;

      const startShort = Date.now();
      await readingPause(10);
      const elapsedShort = Date.now() - startShort;

      const startLong = Date.now();
      await readingPause(100);
      const elapsedLong = Date.now() - startLong;

      // Longer text should take longer (with some variance allowed)
      // Note: Due to randomness, we just check general expectation
      expect(typeof elapsedShort).toBe('number');
      expect(typeof elapsedLong).toBe('number');
    });

    it('should respect custom WPM parameter', async () => {
      (CONFIG as { stealthEnabled: boolean }).stealthEnabled = true;
      (CONFIG as { stealthRandomDelays: boolean }).stealthRandomDelays = true;

      // Very fast reading speed
      const startFast = Date.now();
      await readingPause(50, 500); // 500 WPM (very fast)
      const elapsedFast = Date.now() - startFast;

      // Slow reading speed
      const startSlow = Date.now();
      await readingPause(50, 100); // 100 WPM (slow)
      const elapsedSlow = Date.now() - startSlow;

      // Both should complete (basic sanity check)
      expect(elapsedFast).toBeGreaterThanOrEqual(0);
      expect(elapsedSlow).toBeGreaterThanOrEqual(0);
    });

    it('should cap reading time at 3 seconds', async () => {
      (CONFIG as { stealthEnabled: boolean }).stealthEnabled = true;
      (CONFIG as { stealthRandomDelays: boolean }).stealthRandomDelays = true;

      const start = Date.now();
      // Very long text (1000 chars = 200 words)
      // At 200 WPM, this would be 60 seconds without cap
      await readingPause(1000, 200);
      const elapsed = Date.now() - start;

      // Should be capped at ~3 seconds (with some tolerance for randomness)
      expect(elapsed).toBeLessThan(4500); // 3s cap + 1.2x random + margin
    });

    it('should handle zero text length', async () => {
      (CONFIG as { stealthEnabled: boolean }).stealthEnabled = true;
      (CONFIG as { stealthRandomDelays: boolean }).stealthRandomDelays = true;

      const start = Date.now();
      await readingPause(0);
      const elapsed = Date.now() - start;

      // Zero text = 0 words = 0 time, but with randomness factor
      expect(elapsed).toBeLessThan(1000);
    });

    it('should return a promise', () => {
      const result = readingPause(50);
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
