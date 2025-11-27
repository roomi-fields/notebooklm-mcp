#!/usr/bin/env node
/**
 * CLI Script for Google Authentication Setup
 *
 * Usage: npm run setup-auth
 *
 * This script provides a clean CLI experience for setting up
 * Google authentication for NotebookLM MCP Server.
 */

import { AuthManager } from '../auth/auth-manager.js';
import { log } from '../utils/logger.js';

async function main() {
  console.log('');
  console.log('==========================================');
  console.log('  NotebookLM MCP - Authentication Setup');
  console.log('==========================================');
  console.log('');

  const authManager = new AuthManager();

  try {
    // Check if already authenticated
    const existingAuth = await authManager.getValidStatePath();

    if (existingAuth) {
      log.success('Already authenticated!');
      log.info('');
      log.info('Your Google session is valid.');
      log.info("Use 'npm run re-auth' to switch accounts or re-authenticate.");
      log.info('');
      process.exit(0);
    }

    log.info('Starting interactive authentication...');
    log.info('');
    log.warning('Instructions:');
    log.info('  1. Chrome will open (visible window)');
    log.info('  2. Log in to your Google account');
    log.info('  3. Wait for NotebookLM to load');
    log.info('  4. Browser will close automatically when done');
    log.info('');

    // Perform setup with visible browser
    const success = await authManager.performSetup(
      async (message, progress, total) => {
        if (progress !== undefined && total !== undefined) {
          const pct = Math.round((progress / total) * 100);
          log.info(`  [${pct}%] ${message}`);
        } else {
          log.info(`  ${message}`);
        }
      },
      true // show_browser = true
    );

    console.log('');

    if (success) {
      log.success('==========================================');
      log.success('  Authentication configured successfully!');
      log.success('==========================================');
      log.info('');
      log.info('Google session valid for ~399 days');
      log.info('');
      log.info('Next steps:');
      log.info('  - Start HTTP server: npm run start:http');
      log.info('  - Or use with Claude: npx notebooklm-mcp');
      log.info('');
      process.exit(0);
    } else {
      log.error('==========================================');
      log.error('  Authentication failed');
      log.error('==========================================');
      log.info('');
      log.info('Possible solutions:');
      log.info('  1. Run again: npm run setup-auth');
      log.info('  2. Check that Chrome closed properly');
      log.info('  3. See: deployment/docs/05-TROUBLESHOOTING.md');
      log.info('');
      process.exit(1);
    }
  } catch (error) {
    log.error(`Setup failed: ${error}`);
    process.exit(1);
  }
}

main();
