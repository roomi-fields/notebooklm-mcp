/**
 * Account Manager
 *
 * Manages multiple Google accounts for NotebookLM with:
 * - Account pool with rotation strategies
 * - Encrypted credential storage
 * - Quota tracking per account
 * - Session health monitoring
 * - Auto-login when sessions expire
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import { log } from '../utils/logger.js';
import { encrypt, decrypt, maskEmail, verifyEncryption } from './crypto.js';
import type {
  Account,
  AccountConfig,
  AccountsConfig,
  AccountQuota,
  AccountState,
  AccountHealth,
  AccountSelection,
  EncryptedCredentials,
  RotationStrategy,
} from './types.js';

const DEFAULT_DAILY_QUOTA = 50; // NotebookLM free tier

export class AccountManager {
  private configPath: string;
  private accountsDir: string;
  private config: AccountsConfig | null = null;
  private accounts: Map<string, Account> = new Map();
  private lastUsedIndex: number = 0;

  constructor() {
    this.configPath = path.join(CONFIG.dataDir, 'accounts.json');
    this.accountsDir = path.join(CONFIG.dataDir, 'accounts');
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the account manager
   */
  async initialize(): Promise<void> {
    log.info('🔄 Initializing Account Manager...');

    // Ensure directories exist
    await this.ensureDirectories();

    // Verify encryption is working
    if (!(await verifyEncryption())) {
      throw new Error('Encryption verification failed');
    }

    // Load configuration
    await this.loadConfig();

    // Load all accounts
    await this.loadAccounts();

    log.success(`✅ Account Manager initialized (${this.accounts.size} accounts)`);
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const dirs = [CONFIG.dataDir, this.accountsDir];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
        log.info(`  📁 Created: ${dir}`);
      }
    }
  }

  /**
   * Load accounts configuration
   */
  private async loadConfig(): Promise<void> {
    if (!existsSync(this.configPath)) {
      // Create default config
      this.config = {
        accounts: [],
        rotationStrategy: 'least_used',
        keepAliveIntervalHours: 12,
        autoLoginEnabled: true,
      };
      await this.saveConfig();
      log.info('  📄 Created default accounts.json');
      return;
    }

    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(data);
      log.info(`  📄 Loaded config: ${this.config?.accounts.length || 0} accounts configured`);
    } catch (error) {
      log.error(`❌ Failed to load accounts config: ${error}`);
      throw error;
    }
  }

  /**
   * Save accounts configuration
   */
  private async saveConfig(): Promise<void> {
    if (!this.config) return;

    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  /**
   * Load all accounts from disk
   */
  private async loadAccounts(): Promise<void> {
    if (!this.config) return;

    for (const accountConfig of this.config.accounts) {
      if (!accountConfig.enabled) continue;

      try {
        const account = await this.loadAccount(accountConfig);
        this.accounts.set(accountConfig.id, account);
        log.info(`  👤 Loaded: ${maskEmail(accountConfig.email)}`);
      } catch (error) {
        log.warning(`  ⚠️  Failed to load account ${accountConfig.id}: ${error}`);
      }
    }
  }

  /**
   * Load a single account
   */
  private async loadAccount(config: AccountConfig): Promise<Account> {
    const accountDir = path.join(this.accountsDir, config.id);

    // Ensure account directory exists
    if (!existsSync(accountDir)) {
      await fs.mkdir(accountDir, { recursive: true });
    }

    // Load or create quota
    const quotaPath = path.join(accountDir, 'quota.json');
    let quota: AccountQuota;

    if (existsSync(quotaPath)) {
      const quotaData = await fs.readFile(quotaPath, 'utf-8');
      quota = JSON.parse(quotaData);

      // Check if quota needs reset (new day)
      const resetDate = new Date(quota.resetAt);
      const now = new Date();
      if (now >= resetDate) {
        quota = this.createFreshQuota();
        await fs.writeFile(quotaPath, JSON.stringify(quota, null, 2));
      }
    } else {
      quota = this.createFreshQuota();
      await fs.writeFile(quotaPath, JSON.stringify(quota, null, 2));
    }

    // Load or create state
    const statePath = path.join(accountDir, 'state.json');
    let state: AccountState;

    if (existsSync(statePath)) {
      const stateData = await fs.readFile(statePath, 'utf-8');
      state = JSON.parse(stateData);
    } else {
      state = {
        sessionStatus: 'unknown',
        lastActivity: null,
        lastLoginAttempt: null,
        loginFailures: 0,
        consecutiveFailures: 0,
      };
      await fs.writeFile(statePath, JSON.stringify(state, null, 2));
    }

    return {
      config,
      quota,
      state,
      profileDir: path.join(accountDir, 'profile'),
      stateFilePath: path.join(accountDir, 'browser_state', 'state.json'),
    };
  }

  /**
   * Create fresh quota (resets at midnight UTC)
   */
  private createFreshQuota(): AccountQuota {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    return {
      used: 0,
      limit: DEFAULT_DAILY_QUOTA,
      resetAt: tomorrow.toISOString(),
      lastUpdated: now.toISOString(),
    };
  }

  // ============================================================================
  // Account Management
  // ============================================================================

  /**
   * Add a new account
   */
  async addAccount(
    email: string,
    password: string,
    totpSecret?: string,
    options: { priority?: number; notes?: string } = {}
  ): Promise<string> {
    if (!this.config) {
      throw new Error('Account manager not initialized');
    }

    // Generate unique ID
    const id = `account-${Date.now()}`;

    // Create account config
    const accountConfig: AccountConfig = {
      id,
      email,
      enabled: true,
      priority: options.priority ?? this.config.accounts.length + 1,
      hasCredentials: true,
      hasTotp: !!totpSecret,
      createdAt: new Date().toISOString(),
      notes: options.notes,
    };

    // Create account directory
    const accountDir = path.join(this.accountsDir, id);
    await fs.mkdir(accountDir, { recursive: true });
    await fs.mkdir(path.join(accountDir, 'browser_state'), { recursive: true });
    await fs.mkdir(path.join(accountDir, 'profile'), { recursive: true });

    // Encrypt and save credentials
    const credentials: EncryptedCredentials = {
      emailEncrypted: await encrypt(email),
      passwordEncrypted: await encrypt(password),
      totpSecretEncrypted: totpSecret ? await encrypt(totpSecret) : undefined,
      encryptedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(accountDir, 'credentials.enc.json'),
      JSON.stringify(credentials, null, 2),
      { mode: 0o600 }
    );

    // Add to config
    this.config.accounts.push(accountConfig);
    await this.saveConfig();

    // Load the account
    const account = await this.loadAccount(accountConfig);
    this.accounts.set(id, account);

    log.success(`✅ Account added: ${maskEmail(email)} (${id})`);
    return id;
  }

  /**
   * Remove an account
   */
  async removeAccount(accountId: string): Promise<boolean> {
    if (!this.config) return false;

    const index = this.config.accounts.findIndex((a) => a.id === accountId);
    if (index === -1) {
      log.warning(`⚠️  Account not found: ${accountId}`);
      return false;
    }

    // Remove from config
    const [removed] = this.config.accounts.splice(index, 1);
    await this.saveConfig();

    // Remove from memory
    this.accounts.delete(accountId);

    // Delete account directory
    const accountDir = path.join(this.accountsDir, accountId);
    if (existsSync(accountDir)) {
      await fs.rm(accountDir, { recursive: true, force: true });
    }

    log.success(`✅ Account removed: ${maskEmail(removed.email)}`);
    return true;
  }

  /**
   * List all accounts
   */
  listAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Get account by ID
   */
  getAccount(accountId: string): Account | undefined {
    return this.accounts.get(accountId);
  }

  /**
   * Get credentials for an account
   */
  async getCredentials(
    accountId: string
  ): Promise<{ email: string; password: string; totpSecret?: string } | null> {
    const account = this.accounts.get(accountId);
    if (!account) {
      log.warning(`⚠️  Account not found: ${accountId}`);
      return null;
    }

    const credentialsPath = path.join(this.accountsDir, accountId, 'credentials.enc.json');
    if (!existsSync(credentialsPath)) {
      log.warning(`⚠️  No credentials file for: ${accountId}`);
      return null;
    }

    try {
      const data = await fs.readFile(credentialsPath, 'utf-8');
      const credentials: EncryptedCredentials = JSON.parse(data);

      return {
        email: await decrypt(credentials.emailEncrypted),
        password: await decrypt(credentials.passwordEncrypted),
        totpSecret: credentials.totpSecretEncrypted
          ? await decrypt(credentials.totpSecretEncrypted)
          : undefined,
      };
    } catch (error) {
      log.error(`❌ Failed to decrypt credentials for ${accountId}: ${error}`);
      return null;
    }
  }

  // ============================================================================
  // Account Selection
  // ============================================================================

  /**
   * Get the best available account based on rotation strategy
   * @param excludeAccountId Optional account ID to exclude (e.g., rate-limited account)
   */
  async getBestAccount(excludeAccountId?: string): Promise<AccountSelection | null> {
    if (!this.config || this.accounts.size === 0) {
      return null;
    }

    const strategy = this.config.rotationStrategy;
    let availableAccounts = this.getAvailableAccounts();

    // Exclude specific account if requested (e.g., the one that hit rate limit)
    if (excludeAccountId) {
      availableAccounts = availableAccounts.filter((a) => a.config.id !== excludeAccountId);
      log.info(
        `  🔄 Excluding ${excludeAccountId} from selection (${availableAccounts.length} remaining)`
      );
    }

    if (availableAccounts.length === 0) {
      log.warning('⚠️  No available accounts (all disabled, quota exhausted, or failed)');
      return null;
    }

    let selected: Account;
    let reason: string;

    switch (strategy) {
      case 'least_used':
        selected = this.selectLeastUsed(availableAccounts);
        reason = `Least used (${selected.quota.used}/${selected.quota.limit} queries)`;
        break;

      case 'round_robin':
        selected = this.selectRoundRobin(availableAccounts);
        reason = 'Round robin rotation';
        break;

      case 'failover':
        selected = this.selectFailover(availableAccounts);
        reason = `Failover (priority ${selected.config.priority})`;
        break;

      case 'random':
        selected = availableAccounts[Math.floor(Math.random() * availableAccounts.length)];
        reason = 'Random selection';
        break;

      default:
        selected = availableAccounts[0];
        reason = 'Default (first available)';
    }

    log.info(`🎯 Selected: ${maskEmail(selected.config.email)} (${reason})`);
    return { account: selected, reason };
  }

  /**
   * Get accounts that are available for use
   */
  private getAvailableAccounts(): Account[] {
    return Array.from(this.accounts.values()).filter((account) => {
      // Must be enabled
      if (!account.config.enabled) return false;

      // Must have quota remaining
      if (account.quota.used >= account.quota.limit) return false;

      // Must not have too many consecutive failures
      if (account.state.consecutiveFailures >= 3) return false;

      return true;
    });
  }

  /**
   * Select account with most remaining quota
   */
  private selectLeastUsed(accounts: Account[]): Account {
    return accounts.reduce((best, current) => {
      const bestRemaining = best.quota.limit - best.quota.used;
      const currentRemaining = current.quota.limit - current.quota.used;
      return currentRemaining > bestRemaining ? current : best;
    });
  }

  /**
   * Select account using round-robin
   */
  private selectRoundRobin(accounts: Account[]): Account {
    this.lastUsedIndex = (this.lastUsedIndex + 1) % accounts.length;
    return accounts[this.lastUsedIndex];
  }

  /**
   * Select account by priority (failover)
   */
  private selectFailover(accounts: Account[]): Account {
    return accounts.sort((a, b) => a.config.priority - b.config.priority)[0];
  }

  // ============================================================================
  // Quota Management
  // ============================================================================

  /**
   * Record a query usage for an account
   */
  async recordUsage(accountId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) return;

    account.quota.used++;
    account.quota.lastUpdated = new Date().toISOString();
    account.state.lastActivity = new Date().toISOString();

    // Save quota
    const quotaPath = path.join(this.accountsDir, accountId, 'quota.json');
    await fs.writeFile(quotaPath, JSON.stringify(account.quota, null, 2));

    // Save state
    const statePath = path.join(this.accountsDir, accountId, 'state.json');
    await fs.writeFile(statePath, JSON.stringify(account.state, null, 2));

    const remaining = account.quota.limit - account.quota.used;
    log.dim(`  📊 Quota: ${account.quota.used}/${account.quota.limit} (${remaining} remaining)`);
  }

  /**
   * Mark account as rate-limited (quota exhausted)
   * This ensures the account won't be selected again until quota resets
   */
  async markRateLimited(accountId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) return;

    log.warning(`🚫 Marking account ${maskEmail(account.config.email)} as rate-limited`);

    // Set quota to exhausted
    account.quota.used = account.quota.limit;
    account.quota.lastUpdated = new Date().toISOString();

    // Save quota
    const quotaPath = path.join(this.accountsDir, accountId, 'quota.json');
    await fs.writeFile(quotaPath, JSON.stringify(account.quota, null, 2));

    log.info(`  📊 Account quota exhausted: ${account.quota.used}/${account.quota.limit}`);
  }

  /**
   * Save the ID of the currently active account
   * This is used to identify which account is currently loaded in the main profile
   */
  async saveCurrentAccountId(accountId: string): Promise<void> {
    const currentAccountPath = path.join(CONFIG.dataDir, 'current-account.txt');
    await fs.writeFile(currentAccountPath, accountId, 'utf-8');
    log.info(`  📋 Current account set: ${accountId}`);
  }

  /**
   * Get the ID of the currently active account
   * Returns null if no account is set or file doesn't exist
   */
  async getCurrentAccountId(): Promise<string | null> {
    const currentAccountPath = path.join(CONFIG.dataDir, 'current-account.txt');
    try {
      const id = await fs.readFile(currentAccountPath, 'utf-8');
      return id.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Clear the current-account marker.
   *
   * Used after `re_auth` succeeds: a re-auth may have logged in with a
   * different Google account than the one previously stored, but
   * `performSetup()` (manual browser login) doesn't tell us *which* Google
   * account the user picked. Rather than keep stale data and lie about
   * which account is active, we clear the marker so `get_health` truthfully
   * omits `current_account` until something explicit re-establishes it.
   */
  async clearCurrentAccountId(): Promise<void> {
    const currentAccountPath = path.join(CONFIG.dataDir, 'current-account.txt');
    try {
      await fs.unlink(currentAccountPath);
      log.info('  🧹 Current account marker cleared');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  /**
   * Record a login failure
   */
  async recordLoginFailure(accountId: string, error: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) return;

    account.state.loginFailures++;
    account.state.consecutiveFailures++;
    account.state.lastLoginAttempt = new Date().toISOString();
    account.state.lastError = error;
    account.state.sessionStatus = 'expired';

    const statePath = path.join(this.accountsDir, accountId, 'state.json');
    await fs.writeFile(statePath, JSON.stringify(account.state, null, 2));
  }

  /**
   * Record a successful login
   */
  async recordLoginSuccess(accountId: string): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) return;

    account.state.consecutiveFailures = 0;
    account.state.lastLoginAttempt = new Date().toISOString();
    account.state.lastActivity = new Date().toISOString();
    account.state.sessionStatus = 'valid';
    delete account.state.lastError;

    const statePath = path.join(this.accountsDir, accountId, 'state.json');
    await fs.writeFile(statePath, JSON.stringify(account.state, null, 2));
  }

  /**
   * Update session status for an account
   */
  async updateSessionStatus(
    accountId: string,
    status: 'valid' | 'expiring' | 'expired'
  ): Promise<void> {
    const account = this.accounts.get(accountId);
    if (!account) return;

    account.state.sessionStatus = status;

    const statePath = path.join(this.accountsDir, accountId, 'state.json');
    await fs.writeFile(statePath, JSON.stringify(account.state, null, 2));
  }

  // ============================================================================
  // Health Checks
  // ============================================================================

  /**
   * Check health of all accounts
   */
  async healthCheck(): Promise<AccountHealth[]> {
    const results: AccountHealth[] = [];

    for (const [accountId, account] of this.accounts) {
      const health = await this.checkAccountHealth(accountId, account);
      results.push(health);
    }

    return results;
  }

  /**
   * Check health of a single account
   */
  private async checkAccountHealth(accountId: string, account: Account): Promise<AccountHealth> {
    const issues: string[] = [];

    // Check quota
    const quotaRemaining = account.quota.limit - account.quota.used;
    const quotaPercent = Math.round((quotaRemaining / account.quota.limit) * 100);

    if (quotaRemaining <= 0) {
      issues.push('Quota exhausted');
    } else if (quotaPercent < 20) {
      issues.push(`Low quota (${quotaPercent}% remaining)`);
    }

    // Check session
    let sessionValid = account.state.sessionStatus === 'valid';

    // Verify by checking state file exists
    if (existsSync(account.stateFilePath)) {
      try {
        const stateData = await fs.readFile(account.stateFilePath, 'utf-8');
        const state = JSON.parse(stateData);
        if (!state.cookies || state.cookies.length === 0) {
          sessionValid = false;
          issues.push('No cookies in state file');
        }
      } catch {
        sessionValid = false;
        issues.push('Invalid state file');
      }
    } else {
      sessionValid = false;
      issues.push('No state file (needs login)');
    }

    // Check consecutive failures
    if (account.state.consecutiveFailures >= 3) {
      issues.push(`${account.state.consecutiveFailures} consecutive login failures`);
    }

    // Check last activity
    if (account.state.lastActivity) {
      const lastActivity = new Date(account.state.lastActivity);
      const hoursSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
      if (hoursSinceActivity > 24) {
        issues.push(`Inactive for ${Math.round(hoursSinceActivity)} hours`);
      }
    }

    return {
      accountId,
      email: account.config.email,
      enabled: account.config.enabled,
      sessionValid,
      quotaRemaining,
      quotaPercent,
      lastActivity: account.state.lastActivity,
      issues,
    };
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Get current rotation strategy
   */
  getRotationStrategy(): RotationStrategy {
    return this.config?.rotationStrategy ?? 'least_used';
  }

  /**
   * Set rotation strategy
   */
  async setRotationStrategy(strategy: RotationStrategy): Promise<void> {
    if (!this.config) return;

    this.config.rotationStrategy = strategy;
    await this.saveConfig();
    log.success(`✅ Rotation strategy set to: ${strategy}`);
  }

  /**
   * Check if auto-login is enabled
   */
  isAutoLoginEnabled(): boolean {
    return this.config?.autoLoginEnabled ?? false;
  }

  /**
   * Enable/disable auto-login
   */
  async setAutoLoginEnabled(enabled: boolean): Promise<void> {
    if (!this.config) return;

    this.config.autoLoginEnabled = enabled;
    await this.saveConfig();
    log.success(`✅ Auto-login ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get account count
   */
  getAccountCount(): number {
    return this.accounts.size;
  }

  /**
   * Check if any accounts are configured
   */
  hasAccounts(): boolean {
    return this.accounts.size > 0;
  }

  /**
   * Sync an account's Chrome profile and state to the main (shared) profile.
   * This ensures the browser uses the same cookies/profile as the authenticated account.
   *
   * Copies:
   * - account/<id>/browser_state/state.json → browser_state/state.json
   * - account/<id>/profile/ → chrome_profile/
   */
  async syncProfileToMain(accountId: string): Promise<boolean> {
    const account = this.accounts.get(accountId);
    if (!account) {
      log.warning(`syncProfileToMain: account ${accountId} not found`);
      return false;
    }

    const mainStateFile = path.join(CONFIG.dataDir, 'browser_state', 'state.json');
    const mainProfileDir = path.join(CONFIG.dataDir, 'chrome_profile');
    const accountStateFile = account.stateFilePath;
    const accountProfileDir = account.profileDir;

    log.info(`  📋 Syncing account profile to main profile...`);

    // Ensure main browser_state directory exists
    const mainStateDir = path.dirname(mainStateFile);
    if (!existsSync(mainStateDir)) {
      await fs.mkdir(mainStateDir, { recursive: true });
    }

    // Sync state.json
    if (existsSync(accountStateFile)) {
      try {
        await fs.copyFile(accountStateFile, mainStateFile);
        log.success(`  ✅ State synced: ${accountStateFile} → ${mainStateFile}`);
      } catch (e) {
        log.warning(`  ⚠️ Could not sync state: ${e}`);
        return false;
      }
    } else {
      log.warning(`  ⚠️ Account state file not found: ${accountStateFile}`);
      return false;
    }

    // Sync Chrome profile (delete old, copy new)
    if (existsSync(accountProfileDir)) {
      try {
        await fs.rm(mainProfileDir, { recursive: true, force: true });
        await fs.cp(accountProfileDir, mainProfileDir, { recursive: true });
        log.success(`  ✅ Chrome profile synced: ${accountProfileDir} → ${mainProfileDir}`);
      } catch (e) {
        log.warning(`  ⚠️ Could not sync Chrome profile: ${e}`);
        return false;
      }
    } else {
      log.dim(`  ℹ️ No account profile directory to sync: ${accountProfileDir}`);
    }

    return true;
  }

  /**
   * Sync main profile TO account (reverse direction).
   * Used after performSetup saves fresh auth to the global paths.
   * Copies main state.json → account state.json, main chrome_profile → account profile.
   */
  async syncMainToAccount(accountId: string): Promise<boolean> {
    const account = this.accounts.get(accountId);
    if (!account) {
      log.warning(`syncMainToAccount: account ${accountId} not found`);
      return false;
    }

    const mainStateFile = path.join(CONFIG.dataDir, 'browser_state', 'state.json');
    const mainProfileDir = path.join(CONFIG.dataDir, 'chrome_profile');
    const accountStateFile = account.stateFilePath;
    const accountProfileDir = account.profileDir;

    log.info(`  📋 Syncing main profile to account...`);

    // Sync state.json: main → account
    if (existsSync(mainStateFile)) {
      try {
        const accountStateDir = path.dirname(accountStateFile);
        if (!existsSync(accountStateDir)) {
          await fs.mkdir(accountStateDir, { recursive: true });
        }
        await fs.copyFile(mainStateFile, accountStateFile);
        log.success(`  ✅ State synced: ${mainStateFile} → ${accountStateFile}`);
      } catch (e) {
        log.warning(`  ⚠️ Could not sync state to account: ${e}`);
        return false;
      }
    }

    // Sync Chrome profile: main → account
    if (existsSync(mainProfileDir)) {
      try {
        if (!existsSync(path.dirname(accountProfileDir))) {
          await fs.mkdir(path.dirname(accountProfileDir), { recursive: true });
        }
        await fs.rm(accountProfileDir, { recursive: true, force: true });
        await fs.cp(mainProfileDir, accountProfileDir, { recursive: true });
        log.success(`  ✅ Chrome profile synced: ${mainProfileDir} → ${accountProfileDir}`);
      } catch (e) {
        log.warning(`  ⚠️ Could not sync Chrome profile to account: ${e}`);
        return false;
      }
    }

    return true;
  }
}

// Singleton instance
let accountManagerInstance: AccountManager | null = null;

/**
 * Get or create the account manager instance
 */
export async function getAccountManager(): Promise<AccountManager> {
  if (!accountManagerInstance) {
    accountManagerInstance = new AccountManager();
    await accountManagerInstance.initialize();
  }
  return accountManagerInstance;
}
