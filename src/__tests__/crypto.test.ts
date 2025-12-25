/**
 * Tests for cryptographic utilities
 * @module crypto.test
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import crypto from 'crypto';

// We need to test the pure functions directly and mock the key management
// Import the module to test
import {
  generateNewKey,
  maskSensitive,
  maskEmail,
  encrypt,
  decrypt,
  verifyEncryption,
} from '../accounts/crypto.js';

describe('crypto utilities', () => {
  describe('generateNewKey', () => {
    it('should generate a 64-character hex string', () => {
      const key = generateNewKey();
      expect(key).toHaveLength(64);
    });

    it('should only contain hex characters', () => {
      const key = generateNewKey();
      expect(key).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate unique keys on each call', () => {
      const key1 = generateNewKey();
      const key2 = generateNewKey();
      const key3 = generateNewKey();

      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);
    });

    it('should generate 256-bit keys (32 bytes)', () => {
      const key = generateNewKey();
      const buffer = Buffer.from(key, 'hex');
      expect(buffer.length).toBe(32);
    });

    it('should be cryptographically random', () => {
      // Generate multiple keys and check they don't have obvious patterns
      const keys = Array.from({ length: 100 }, () => generateNewKey());
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(100);
    });
  });

  describe('maskSensitive', () => {
    it('should fully mask strings of 4 or fewer characters', () => {
      expect(maskSensitive('')).toBe('');
      expect(maskSensitive('a')).toBe('*');
      expect(maskSensitive('ab')).toBe('**');
      expect(maskSensitive('abc')).toBe('***');
      expect(maskSensitive('abcd')).toBe('****');
    });

    it('should show first 2 and last 2 characters for longer strings', () => {
      expect(maskSensitive('abcde')).toBe('ab*de');
      expect(maskSensitive('abcdef')).toBe('ab**ef');
      expect(maskSensitive('password123')).toBe('pa*******23');
    });

    it('should handle special characters', () => {
      expect(maskSensitive('p@ss!')).toBe('p@*s!');
      expect(maskSensitive('test@123')).toBe('te****23');
    });

    it('should handle unicode characters', () => {
      expect(maskSensitive('héllo')).toBe('hé*lo');
      expect(maskSensitive('日本語テスト')).toBe('日本**スト');
    });

    it('should handle strings with spaces', () => {
      expect(maskSensitive('hello world')).toBe('he*******ld');
    });

    it('should preserve exact length in masking', () => {
      const original = 'mysecretpassword';
      const masked = maskSensitive(original);
      expect(masked.length).toBe(original.length);
    });
  });

  describe('maskEmail', () => {
    it('should mask email with standard format', () => {
      expect(maskEmail('test@gmail.com')).toBe('t**t@gmail.com');
      expect(maskEmail('john.doe@example.org')).toBe('j******e@example.org');
    });

    it('should handle short usernames (1-2 chars)', () => {
      expect(maskEmail('a@test.com')).toBe('*@test.com');
      expect(maskEmail('ab@test.com')).toBe('**@test.com');
    });

    it('should handle 3-character usernames', () => {
      expect(maskEmail('abc@test.com')).toBe('a*c@test.com');
    });

    it('should fallback to maskSensitive for non-email strings', () => {
      expect(maskEmail('notanemail')).toBe('no******il');
      expect(maskEmail('no-at-symbol')).toBe('no********ol');
    });

    it('should handle emails with special characters in username', () => {
      expect(maskEmail('user.name+tag@gmail.com')).toBe('u***********g@gmail.com');
      expect(maskEmail('test_user@domain.co')).toBe('t*******r@domain.co');
    });

    it('should preserve domain completely', () => {
      const email = 'longusername@subdomain.example.com';
      const masked = maskEmail(email);
      expect(masked).toContain('@subdomain.example.com');
    });

    it('should handle emails with numbers', () => {
      expect(maskEmail('user123@test.com')).toBe('u*****3@test.com');
    });

    it('should handle multiple @ symbols (take first split)', () => {
      // This is technically invalid but tests edge case behavior
      // split('@') gives ['user', 'domain', 'extra.com'], destructuring takes first two
      const result = maskEmail('user@domain@extra.com');
      expect(result).toBe('u**r@domain');
    });
  });

  describe('encrypt and decrypt integration', () => {
    // These tests require a valid encryption key
    // We'll set up a test key via environment variable
    const TEST_KEY = crypto.randomBytes(32).toString('hex');

    beforeEach(() => {
      process.env.NBLM_ENCRYPTION_KEY = TEST_KEY;
    });

    afterEach(() => {
      delete process.env.NBLM_ENCRYPTION_KEY;
    });

    it('should encrypt and decrypt a simple string', async () => {
      const plaintext = 'Hello, World!';
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', async () => {
      const plaintext = 'Same message';
      const encrypted1 = await encrypt(plaintext);
      const encrypted2 = await encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to same value
      expect(await decrypt(encrypted1)).toBe(plaintext);
      expect(await decrypt(encrypted2)).toBe(plaintext);
    });

    it('should encrypt empty string', async () => {
      const plaintext = '';
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt long text', async () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt unicode text', async () => {
      const plaintext = '日本語テスト émojis 🎉🔐';
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt JSON strings', async () => {
      const data = { email: 'test@example.com', password: 'secret123' };
      const plaintext = JSON.stringify(data);
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);
      expect(JSON.parse(decrypted)).toEqual(data);
    });

    it('should produce ciphertext in correct format (iv:authTag:ciphertext)', async () => {
      const encrypted = await encrypt('test');
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);

      // IV should be 32 hex chars (16 bytes)
      expect(parts[0]).toHaveLength(32);
      expect(parts[0]).toMatch(/^[0-9a-f]+$/);

      // Auth tag should be 32 hex chars (16 bytes)
      expect(parts[1]).toHaveLength(32);
      expect(parts[1]).toMatch(/^[0-9a-f]+$/);

      // Ciphertext should be hex
      expect(parts[2]).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('decrypt error handling', () => {
    const TEST_KEY = crypto.randomBytes(32).toString('hex');

    beforeEach(() => {
      process.env.NBLM_ENCRYPTION_KEY = TEST_KEY;
    });

    afterEach(() => {
      delete process.env.NBLM_ENCRYPTION_KEY;
    });

    it('should throw on invalid format (missing parts)', async () => {
      await expect(decrypt('invalid')).rejects.toThrow(
        'Invalid encrypted data format (expected iv:authTag:ciphertext)'
      );
    });

    it('should throw on invalid format (only two parts)', async () => {
      await expect(decrypt('part1:part2')).rejects.toThrow(
        'Invalid encrypted data format (expected iv:authTag:ciphertext)'
      );
    });

    it('should throw on invalid format (too many parts)', async () => {
      await expect(decrypt('part1:part2:part3:part4')).rejects.toThrow(
        'Invalid encrypted data format (expected iv:authTag:ciphertext)'
      );
    });

    it('should throw on invalid IV length', async () => {
      // Short IV (should be 32 hex chars)
      await expect(decrypt('0123456789abcdef:' + '0'.repeat(32) + ':aabbcc')).rejects.toThrow(
        'Invalid IV length'
      );
    });

    it('should throw on invalid auth tag length', async () => {
      // Correct IV but short auth tag
      await expect(decrypt('0'.repeat(32) + ':0123456789abcdef:aabbcc')).rejects.toThrow(
        'Invalid auth tag length'
      );
    });

    it('should throw on tampered ciphertext', async () => {
      const encrypted = await encrypt('test message');
      const parts = encrypted.split(':');
      // Tamper with ciphertext
      const tampered = `${parts[0]}:${parts[1]}:ffffffff`;

      await expect(decrypt(tampered)).rejects.toThrow();
    });

    it('should throw on tampered auth tag', async () => {
      const encrypted = await encrypt('test message');
      const parts = encrypted.split(':');
      // Tamper with auth tag
      const tampered = `${parts[0]}:${'f'.repeat(32)}:${parts[2]}`;

      await expect(decrypt(tampered)).rejects.toThrow();
    });

    it('should throw on tampered IV', async () => {
      const encrypted = await encrypt('test message');
      const parts = encrypted.split(':');
      // Tamper with IV
      const tampered = `${'f'.repeat(32)}:${parts[1]}:${parts[2]}`;

      await expect(decrypt(tampered)).rejects.toThrow();
    });
  });

  describe('verifyEncryption', () => {
    const TEST_KEY = crypto.randomBytes(32).toString('hex');

    beforeEach(() => {
      process.env.NBLM_ENCRYPTION_KEY = TEST_KEY;
    });

    afterEach(() => {
      delete process.env.NBLM_ENCRYPTION_KEY;
    });

    it('should return true for valid encryption key', async () => {
      const result = await verifyEncryption();
      expect(result).toBe(true);
    });

    it('should return false when encryption fails', async () => {
      // Set invalid key
      process.env.NBLM_ENCRYPTION_KEY = 'invalid';

      const result = await verifyEncryption();
      expect(result).toBe(false);
    });

    it('should return false for too short key', async () => {
      process.env.NBLM_ENCRYPTION_KEY = 'abc123';

      const result = await verifyEncryption();
      expect(result).toBe(false);
    });
  });

  describe('getEncryptionKey validation', () => {
    afterEach(() => {
      delete process.env.NBLM_ENCRYPTION_KEY;
    });

    it('should throw for key with wrong length', async () => {
      process.env.NBLM_ENCRYPTION_KEY = 'tooshort';

      // encrypt uses getEncryptionKey internally
      await expect(encrypt('test')).rejects.toThrow(
        'NBLM_ENCRYPTION_KEY must be 64 hex characters'
      );
    });

    it('should accept valid 64-char hex key', async () => {
      process.env.NBLM_ENCRYPTION_KEY = '0'.repeat(64);

      // Should not throw
      const encrypted = await encrypt('test');
      expect(encrypted).toBeDefined();
    });
  });
});
