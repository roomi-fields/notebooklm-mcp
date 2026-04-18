/**
 * E2E Test Configuration
 *
 * Centralized configuration for all E2E tests.
 * Supports multiple modes, languages, and accounts.
 */

export type TestMode = 'quick' | 'full';
export type TestLang = 'fr' | 'en';
export type TestAccount = 'primary' | 'secondary' | 'tertiary';

// Parse CLI arguments or environment variables
export const config = {
  // Test mode: quick (54 tests) or full (76 tests)
  mode: (process.env.TEST_MODE || 'quick').toLowerCase() as TestMode,

  // UI language: fr or en
  lang: (process.env.TEST_LANG || 'fr').toLowerCase() as TestLang,

  // Account to use
  account: (process.env.TEST_ACCOUNT || 'primary').toLowerCase() as TestAccount,

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

// Account configurations — override IDs/emails via env vars for your own test accounts
export const accounts: Record<TestAccount, { id: string; email: string }> = {
  primary: {
    id: process.env.TEST_ACCOUNT_PRIMARY_ID || 'account-0000000000001',
    email: process.env.TEST_ACCOUNT_PRIMARY_EMAIL || 'your-account-a@example.com',
  },
  secondary: {
    id: process.env.TEST_ACCOUNT_SECONDARY_ID || 'account-0000000000002',
    email: process.env.TEST_ACCOUNT_SECONDARY_EMAIL || 'your-account-b@example.com',
  },
  tertiary: {
    id: process.env.TEST_ACCOUNT_TERTIARY_ID || 'account-0000000000003',
    email: process.env.TEST_ACCOUNT_TERTIARY_EMAIL || 'your-account-c@example.com',
  },
};

// Notebook URLs per account — override via env vars to point at your own notebooks
export const notebooks: Record<TestAccount, { readOnly: string; e2eTest: string }> = {
  primary: {
    readOnly:
      process.env.TEST_NOTEBOOK_PRIMARY_READONLY ||
      'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000001',
    e2eTest:
      process.env.TEST_NOTEBOOK_PRIMARY_E2E ||
      'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000002',
  },
  secondary: {
    readOnly: process.env.TEST_NOTEBOOK_SECONDARY_READONLY || '',
    e2eTest: process.env.TEST_NOTEBOOK_SECONDARY_E2E || '',
  },
  tertiary: {
    readOnly:
      process.env.TEST_NOTEBOOK_TERTIARY_READONLY ||
      'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000003',
    e2eTest:
      process.env.TEST_NOTEBOOK_TERTIARY_E2E ||
      'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000003',
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
