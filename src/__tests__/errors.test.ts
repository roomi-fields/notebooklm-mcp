import { describe, it, expect } from '@jest/globals';
import { RateLimitError, AuthenticationError } from '../errors.js';

describe('RateLimitError', () => {
  describe('constructor', () => {
    it('should create error with default message', () => {
      const error = new RateLimitError();

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.name).toBe('RateLimitError');
      expect(error.message).toBe(
        'NotebookLM rate limit reached (50 queries/day for free accounts)'
      );
    });

    it('should create error with custom message', () => {
      const customMessage = 'Custom rate limit message';
      const error = new RateLimitError(customMessage);

      expect(error.message).toBe(customMessage);
      expect(error.name).toBe('RateLimitError');
    });

    it('should maintain proper stack trace', () => {
      const error = new RateLimitError();

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('RateLimitError');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new RateLimitError('Test error');
      }).toThrow(RateLimitError);

      expect(() => {
        throw new RateLimitError('Test error');
      }).toThrow('Test error');
    });

    it('should be catchable as generic Error', () => {
      try {
        throw new RateLimitError('Test error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(RateLimitError);
        if (error instanceof RateLimitError) {
          expect(error.message).toBe('Test error');
        }
      }
    });
  });

  describe('error properties', () => {
    it('should have correct name property', () => {
      const error = new RateLimitError();
      expect(error.name).toBe('RateLimitError');
    });

    it('should have message property', () => {
      const error = new RateLimitError();
      expect(error.message).toBeTruthy();
      expect(typeof error.message).toBe('string');
    });

    it('should preserve custom messages exactly', () => {
      const messages = [
        'Rate limit exceeded',
        'Try again tomorrow',
        'Upgrade to Pro for higher limits',
        '',
      ];

      messages.forEach((msg) => {
        const error = new RateLimitError(msg);
        expect(error.message).toBe(msg);
      });
    });
  });
});

describe('AuthenticationError', () => {
  describe('constructor', () => {
    it('should create error with message and default suggestCleanup', () => {
      const error = new AuthenticationError('Auth failed');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.name).toBe('AuthenticationError');
      expect(error.message).toBe('Auth failed');
      expect(error.suggestCleanup).toBe(false);
    });

    it('should create error with suggestCleanup true', () => {
      const error = new AuthenticationError('Auth failed', true);

      expect(error.message).toBe('Auth failed');
      expect(error.suggestCleanup).toBe(true);
    });

    it('should create error with suggestCleanup false explicitly', () => {
      const error = new AuthenticationError('Auth failed', false);

      expect(error.message).toBe('Auth failed');
      expect(error.suggestCleanup).toBe(false);
    });

    it('should maintain proper stack trace', () => {
      const error = new AuthenticationError('Auth failed');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AuthenticationError');
    });

    it('should be throwable and catchable', () => {
      expect(() => {
        throw new AuthenticationError('Test error');
      }).toThrow(AuthenticationError);

      expect(() => {
        throw new AuthenticationError('Test error', true);
      }).toThrow('Test error');
    });

    it('should preserve suggestCleanup flag when thrown', () => {
      try {
        throw new AuthenticationError('Test error', true);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        if (error instanceof AuthenticationError) {
          expect(error.suggestCleanup).toBe(true);
        }
      }
    });
  });

  describe('error properties', () => {
    it('should have correct name property', () => {
      const error = new AuthenticationError('Test');
      expect(error.name).toBe('AuthenticationError');
    });

    it('should have message property', () => {
      const error = new AuthenticationError('Test message');
      expect(error.message).toBe('Test message');
      expect(typeof error.message).toBe('string');
    });

    it('should have suggestCleanup property', () => {
      const error1 = new AuthenticationError('Test');
      expect(error1).toHaveProperty('suggestCleanup');
      expect(typeof error1.suggestCleanup).toBe('boolean');

      const error2 = new AuthenticationError('Test', true);
      expect(error2.suggestCleanup).toBe(true);
    });

    it('should preserve all custom values', () => {
      const testCases = [
        { msg: 'Login failed', cleanup: true },
        { msg: 'Invalid credentials', cleanup: false },
        { msg: 'Session expired', cleanup: true },
        { msg: '', cleanup: false },
      ];

      testCases.forEach(({ msg, cleanup }) => {
        const error = new AuthenticationError(msg, cleanup);
        expect(error.message).toBe(msg);
        expect(error.suggestCleanup).toBe(cleanup);
      });
    });
  });

  describe('error differentiation', () => {
    it('should be distinguishable from RateLimitError', () => {
      const authError = new AuthenticationError('Auth failed');
      const rateLimitError = new RateLimitError();

      expect(authError).toBeInstanceOf(AuthenticationError);
      expect(authError).not.toBeInstanceOf(RateLimitError);
      expect(rateLimitError).toBeInstanceOf(RateLimitError);
      expect(rateLimitError).not.toBeInstanceOf(AuthenticationError);
    });

    it('should be catchable independently', () => {
      const errors = [new AuthenticationError('Auth'), new RateLimitError()];

      errors.forEach((error) => {
        if (error instanceof AuthenticationError) {
          expect(error.suggestCleanup).toBeDefined();
        } else if (error instanceof RateLimitError) {
          expect(error.message).toContain('rate limit');
        }
      });
    });
  });
});
