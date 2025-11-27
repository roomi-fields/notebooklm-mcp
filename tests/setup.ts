// Global test setup
// This file runs before all tests
import { jest, afterAll } from '@jest/globals';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Environment variables for tests
process.env.NODE_ENV = 'test';

// Cleanup after all tests
afterAll(async () => {
  // Close any open handles
});
