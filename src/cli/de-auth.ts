#!/usr/bin/env node
/**
 * CLI Script for De-authentication (Logout)
 *
 * Usage: npm run de-auth
 *
 * Clears all authentication data without re-authenticating.
 */

import { AuthManager } from '../auth/auth-manager.js';
import { log } from '../utils/logger.js';

async function main() {
  console.log('');
  console.log('==========================================');
  console.log('  NotebookLM MCP - De-authentication');
  console.log('==========================================');
  console.log('');

  const authManager = new AuthManager();

  try {
    // Check if authenticated
    const existingAuth = await authManager.getValidStatePath();

    if (!existingAuth) {
      log.warning('No authentication found.');
      log.info('Nothing to clear.');
      log.info('');
      process.exit(0);
    }

    log.info('Clearing authentication data...');
    log.info('');

    // Clear all auth data
    await authManager.clearAllAuthData();

    console.log('');
    log.success('==========================================');
    log.success('  De-authentication complete!');
    log.success('==========================================');
    log.info('');
    log.info('All credentials have been cleared.');
    log.info("Run 'npm run setup-auth' to authenticate again.");
    log.info('');
    process.exit(0);
  } catch (error) {
    log.error(`De-auth failed: ${error}`);
    process.exit(1);
  }
}

main();
