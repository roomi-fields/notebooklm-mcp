# Multi-Account Management

The NotebookLM MCP server supports multiple Google accounts with automatic rotation when rate limits are hit.

## Overview

NotebookLM has a **50 queries per day limit** per Google account (free tier). With multi-account support, the server can automatically switch to another account when the limit is reached, giving you up to **150 queries/day** with 3 accounts.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Account Manager                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Account 1   │  │  Account 2   │  │  Account 3   │      │
│  │  (Primary)   │  │  (Secondary) │  │  (Tertiary)  │      │
│  │  50/day      │  │  50/day      │  │  50/day      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  Rotation Strategy: least_used | round_robin | failover    │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Account Directory Structure

Each account has its own directory under `DATA_DIR/accounts/`:

```
DATA_DIR/
├── accounts/
│   ├── account-{timestamp1}/
│   │   ├── config.json      # Account configuration
│   │   ├── quota.json       # Usage tracking
│   │   ├── state.json       # Account state
│   │   ├── browser_state/
│   │   │   └── state.json   # Playwright storage state
│   │   └── profile/         # Chrome profile directory
│   │
│   ├── account-{timestamp2}/
│   │   └── ...
│   │
│   └── config.json          # Global accounts config
│
├── browser_state/
│   └── state.json           # Active account's state
│
└── chrome_profile/          # Active account's Chrome profile
```

### Account Config File

`accounts/account-{id}/config.json`:

```json
{
  "id": "account-1766565732376",
  "email": "user@gmail.com",
  "enabled": true,
  "priority": 1,
  "totp_secret": "BASE32SECRET..." // Optional for 2FA
}
```

### Quota Tracking

`accounts/account-{id}/quota.json`:

```json
{
  "used": 15,
  "limit": 50,
  "resetAt": "2025-12-31T00:00:00.000Z",
  "lastUpdated": "2025-12-30T10:00:00.000Z"
}
```

### Global Config

`accounts/config.json`:

```json
{
  "rotationStrategy": "least_used",
  "autoRotateOnRateLimit": true,
  "maxConsecutiveFailures": 3
}
```

## Rotation Strategies

### `least_used` (Default)

Selects the account with the most remaining quota. Best for maximizing throughput.

### `round_robin`

Cycles through accounts in order. Best for even distribution.

### `failover`

Uses accounts in priority order. Only switches when current account fails.

## Rate Limit Detection

The server detects rate limits via:

1. **Response text**: "Le système n'a pas pu répondre" (general error)
2. **Input field**: "Vous avez atteint la limite quotidienne de discussions"
3. **Page body**: Rate limit keywords in French/English

### Detection Keywords

French:

- "limite quotidienne de discussions"
- "atteint la limite quotidienne"
- "vous avez atteint la limite"
- "revenez plus tard"

English:

- "daily limit reached"
- "rate limit exceeded"
- "quota exhausted"
- "too many requests"

## Automatic Rotation Flow

When a rate limit is detected:

```
1. Rate limit detected
   ↓
2. Mark current account as quota exhausted
   ↓
3. Close browser sessions (releases profile lock)
   ↓
4. Wait 2 seconds for Chrome to release files
   ↓
5. Select next available account (based on strategy)
   ↓
6. Sync new account's profile to main profile:
   - Copy state.json → browser_state/
   - Copy profile/ → chrome_profile/
   ↓
7. Retry the request with new account
```

## Adding a New Account

### Via CLI

```bash
npm run accounts add
```

Follow the interactive prompts to:

1. Enter email address
2. Enter password
3. Optionally enter TOTP secret for 2FA

### Manually

1. Create account directory:

   ```bash
   mkdir -p DATA_DIR/accounts/account-$(date +%s)
   ```

2. Create `config.json`:

   ```json
   {
     "id": "account-...",
     "email": "newaccount@gmail.com",
     "enabled": true,
     "priority": 2
   }
   ```

3. Run auto-login to authenticate:

   ```bash
   npm run accounts test account-... -- --show
   ```

4. Sync to main profile if this should be the active account.

## CLI Commands

```bash
# List all accounts
npm run accounts list

# Add new account
npm run accounts add

# Test account authentication
npm run accounts test <account-id> -- --show

# Remove account
npm run accounts remove <account-id>
```

## Troubleshooting

### All Accounts Exhausted

If all accounts hit their daily limit:

1. **Wait** until midnight UTC for quotas to reset
2. **Manually reset** quotas for testing:
   ```bash
   echo '{"used": 0, "limit": 50, ...}' > accounts/account-xxx/quota.json
   ```

### Account Won't Switch

Check if:

1. Profile lock is released (close all Chrome instances)
2. Account has quota remaining
3. Account is enabled in config.json
4. Account hasn't exceeded failure threshold

### Authentication Expired

Re-authenticate the account:

```bash
npm run accounts test <account-id> -- --show
```

Then sync to main profile if needed.

## API Integration

The `/ask` endpoint automatically handles account rotation. No changes needed to API calls.

If rotation fails, the response includes:

```json
{
  "success": false,
  "error": "NotebookLM rate limit reached... Automatic account rotation failed..."
}
```

## Best Practices

1. **Use 3+ accounts** for production workloads
2. **Enable TOTP** for unattended authentication
3. **Monitor quotas** via logs or quota.json files
4. **Stagger usage** across accounts to avoid hitting limits simultaneously
5. **Test rotation** before deploying to production
