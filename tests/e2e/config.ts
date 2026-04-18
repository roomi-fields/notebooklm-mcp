/**
 * E2E Test Configuration
 *
 * Centralized configuration for all E2E tests.
 * Supports multiple modes, languages, and accounts.
 */

export type TestMode = 'quick' | 'full';
export type TestLang = 'fr' | 'en';
export type TestAccount = 'mathieu' | 'rpmonster' | 'rom1pey';

// Parse CLI arguments or environment variables
export const config = {
  // Test mode: quick (54 tests) or full (76 tests)
  mode: (process.env.TEST_MODE || 'quick').toLowerCase() as TestMode,

  // UI language: fr or en
  lang: (process.env.TEST_LANG || 'fr').toLowerCase() as TestLang,

  // Account to use
  account: (process.env.TEST_ACCOUNT || 'mathieu').toLowerCase() as TestAccount,

  // Server URL
  serverUrl: process.env.SERVER_URL || 'http://localhost:3000',

  // Timeouts (ms)
  timeouts: {
    health: 10000,
    ask: 120000, // 2 minutes
    content: 180000, // 3 minutes
    audio: 300000, // 5 minutes
  },
};

// Account configurations
export const accounts: Record<TestAccount, { id: string; email: string }> = {
  mathieu: {
    id: 'account-0000000000001',
    email: 'agent-primary@example.com',
  },
  rpmonster: {
    id: 'account-0000000000002',
    email: 'agent-secondary@example.com',
  },
  rom1pey: {
    id: 'account-0000000000003',
    email: 'agent-tertiary@example.com',
  },
};

// Notebook URLs per account
export const notebooks: Record<TestAccount, { readOnly: string; e2eTest: string }> = {
  mathieu: {
    readOnly: 'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000112', // CNV
    e2eTest: 'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000108', // E2E-Test-Notebook
  },
  rpmonster: {
    readOnly: '',
    e2eTest: '',
  },
  rom1pey: {
    readOnly: 'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000110',
    e2eTest: 'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000110', // rom1pey-english-test
  },
};

// Helper to check if running in full mode
export const isFullMode = config.mode === 'full';

// Helper to get current account config
export const currentAccount = accounts[config.account];

// Helper to get current notebooks
export const currentNotebooks = notebooks[config.account];

// Log configuration on import
console.log(`
╔════════════════════════════════════════════════════════════╗
║  E2E Test Configuration                                     ║
╠════════════════════════════════════════════════════════════╣
║  Mode:    ${config.mode.toUpperCase().padEnd(48)}║
║  Lang:    ${config.lang.toUpperCase().padEnd(48)}║
║  Account: ${config.account.padEnd(48)}║
║  Server:  ${config.serverUrl.padEnd(48)}║
╚════════════════════════════════════════════════════════════╝
`);
