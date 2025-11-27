import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Logger, logger, log, LogLevel } from '../utils/logger.js';

describe('Logger', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create logger with enabled by default', () => {
      const testLogger = new Logger();
      testLogger.info('test');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should create logger with custom enabled state', () => {
      const testLogger = new Logger(false);
      testLogger.info('test');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('log method', () => {
    it('should log message with default info level', () => {
      const testLogger = new Logger();
      testLogger.log('test message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('test message');
      expect(output).toContain('ℹ️');
    });

    it('should log message with specified level', () => {
      const testLogger = new Logger();
      const levels = ['info', 'success', 'warning', 'error', 'debug', 'dim'] as const;

      levels.forEach((level) => {
        consoleErrorSpy.mockClear();
        testLogger.log('test', level);
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('should include timestamp in output', () => {
      const testLogger = new Logger();
      testLogger.log('test message');

      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
    });

    it('should not log when disabled', () => {
      const testLogger = new Logger(false);
      testLogger.log('test message');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should use console.error for output', () => {
      const testLogger = new Logger();
      testLogger.log('test');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('info method', () => {
    it('should log info message', () => {
      const testLogger = new Logger();
      testLogger.info('info message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('info message');
      expect(output).toContain('ℹ️');
    });

    it('should not log when disabled', () => {
      const testLogger = new Logger(false);
      testLogger.info('test');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('success method', () => {
    it('should log success message', () => {
      const testLogger = new Logger();
      testLogger.success('success message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('success message');
      expect(output).toContain('✅');
    });

    it('should not log when disabled', () => {
      const testLogger = new Logger(false);
      testLogger.success('test');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('warning method', () => {
    it('should log warning message', () => {
      const testLogger = new Logger();
      testLogger.warning('warning message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('warning message');
      expect(output).toContain('⚠️');
    });

    it('should not log when disabled', () => {
      const testLogger = new Logger(false);
      testLogger.warning('test');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('error method', () => {
    it('should log error message', () => {
      const testLogger = new Logger();
      testLogger.error('error message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('error message');
      expect(output).toContain('❌');
    });

    it('should not log when disabled', () => {
      const testLogger = new Logger(false);
      testLogger.error('test');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('debug method', () => {
    it('should log debug message', () => {
      const testLogger = new Logger();
      testLogger.debug('debug message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('debug message');
      expect(output).toContain('🔍');
    });

    it('should not log when disabled', () => {
      const testLogger = new Logger(false);
      testLogger.debug('test');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('dim method', () => {
    it('should log dim message', () => {
      const testLogger = new Logger();
      testLogger.dim('dim message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('dim message');
    });

    it('should not log when disabled', () => {
      const testLogger = new Logger(false);
      testLogger.dim('test');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('setEnabled method', () => {
    it('should enable logging', () => {
      const testLogger = new Logger(false);
      testLogger.info('test1');
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      testLogger.setEnabled(true);
      testLogger.info('test2');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should disable logging', () => {
      const testLogger = new Logger(true);
      testLogger.info('test1');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      consoleErrorSpy.mockClear();
      testLogger.setEnabled(false);
      testLogger.info('test2');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should toggle logging multiple times', () => {
      const testLogger = new Logger(true);

      testLogger.info('test1');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      testLogger.setEnabled(false);
      consoleErrorSpy.mockClear();
      testLogger.info('test2');
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      testLogger.setEnabled(true);
      testLogger.info('test3');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('message formatting', () => {
    it('should handle empty messages', () => {
      const testLogger = new Logger();
      testLogger.info('');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle long messages', () => {
      const testLogger = new Logger();
      const longMessage = 'a'.repeat(1000);
      testLogger.info(longMessage);

      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain(longMessage);
    });

    it('should handle messages with special characters', () => {
      const testLogger = new Logger();
      const specialMessage = 'Test\nwith\ttabs\rand\x1b[31mcolors\x1b[0m';
      testLogger.info(specialMessage);

      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain(specialMessage);
    });

    it('should handle messages with unicode', () => {
      const testLogger = new Logger();
      const unicodeMessage = '你好世界 🌍 Привет мир';
      testLogger.info(unicodeMessage);

      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain(unicodeMessage);
    });
  });

  describe('log level prefixes', () => {
    it('should use correct prefix for each level', () => {
      const testLogger = new Logger();
      const expectedPrefixes = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌',
        debug: '🔍',
      };

      Object.entries(expectedPrefixes).forEach(([level, prefix]) => {
        consoleErrorSpy.mockClear();
        testLogger.log('test', level as LogLevel);
        const output = consoleErrorSpy.mock.calls[0][0];
        expect(output).toContain(prefix);
      });
    });
  });
});

describe('Global logger instance', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    logger.setEnabled(true); // Reset to default
  });

  it('should be a Logger instance', () => {
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should be enabled by default', () => {
    logger.info('test');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('should work with all log methods', () => {
    logger.info('info');
    logger.success('success');
    logger.warning('warning');
    logger.error('error');
    logger.debug('debug');
    logger.dim('dim');

    expect(consoleErrorSpy).toHaveBeenCalledTimes(6);
  });
});

describe('Convenience log functions', () => {
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    logger.setEnabled(true); // Reset to default
  });

  describe('log.info', () => {
    it('should log info message', () => {
      log.info('test info');
      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('test info');
      expect(output).toContain('ℹ️');
    });
  });

  describe('log.success', () => {
    it('should log success message', () => {
      log.success('test success');
      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('test success');
      expect(output).toContain('✅');
    });
  });

  describe('log.warning', () => {
    it('should log warning message', () => {
      log.warning('test warning');
      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('test warning');
      expect(output).toContain('⚠️');
    });
  });

  describe('log.error', () => {
    it('should log error message', () => {
      log.error('test error');
      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('test error');
      expect(output).toContain('❌');
    });
  });

  describe('log.debug', () => {
    it('should log debug message', () => {
      log.debug('test debug');
      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('test debug');
      expect(output).toContain('🔍');
    });
  });

  describe('log.dim', () => {
    it('should log dim message', () => {
      log.dim('test dim');
      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = consoleErrorSpy.mock.calls[0][0];
      expect(output).toContain('test dim');
    });
  });

  it('should respect logger enabled state', () => {
    logger.setEnabled(false);

    log.info('test');
    log.success('test');
    log.warning('test');
    log.error('test');
    log.debug('test');
    log.dim('test');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
