/**
 * Change Google account language to English
 */
import { chromium } from 'patchright';
import path from 'path';

const ACCOUNT_ID = process.env.NOTEBOOKLM_ACCOUNT_ID || 'account-0000000000001';
const DATA_DIR =
  process.env.NOTEBOOKLM_DATA_DIR ||
  `${process.env.LOCALAPPDATA || `${process.env.HOME || ''}/AppData/Local`}\\notebooklm-mcp\\Data`;
const PROFILE_DIR = path.join(DATA_DIR, 'accounts', ACCOUNT_ID, 'profile');

async function changeLanguage() {
  console.log(`🌐 Opening browser with account profile ${ACCOUNT_ID}...`);
  console.log(`📁 Profile: ${PROFILE_DIR}`);

  const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();

  console.log('🔗 Navigating to Google language settings...');
  await page.goto('https://myaccount.google.com/language', { waitUntil: 'networkidle' });

  // Wait for user to manually change language
  console.log('\n' + '='.repeat(60));
  console.log('👆 MANUAL STEP REQUIRED:');
  console.log('1. Click "English" or "Add language" in the browser');
  console.log('2. Select "English (United States)" as primary language');
  console.log('3. Press ENTER here when done');
  console.log('='.repeat(60) + '\n');

  // Wait for user input
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => resolve());
  });

  console.log('✅ Saving and closing browser...');
  await browser.close();
  console.log('🎉 Done! Language should now be English.');
}

changeLanguage().catch(console.error);
