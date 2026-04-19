# Configuration Guide - NotebookLM MCP HTTP Server

> Advanced configuration, environment variables, security

---

## 📋 Environment Variables

### HTTP Configuration

| Variable    | Default       | Description                                                      |
| ----------- | ------------- | ---------------------------------------------------------------- |
| `HTTP_HOST` | `0.0.0.0`     | Listen IP address (`0.0.0.0` = network, `127.0.0.1` = localhost) |
| `HTTP_PORT` | `3000`        | HTTP listen port                                                 |
| `NODE_ENV`  | `development` | Environment (`development`, `production`)                        |

**Examples:**

```powershell
# Localhost only (maximum security)
$env:HTTP_HOST="127.0.0.1"
$env:HTTP_PORT="3000"
node dist/http-wrapper.js

# Local network (for n8n)
$env:HTTP_HOST="0.0.0.0"
$env:HTTP_PORT="3000"
node dist/http-wrapper.js

# Custom port
$env:HTTP_PORT="8080"
node dist/http-wrapper.js
```

### Browser Configuration

| Variable               | Default | Description                                             |
| ---------------------- | ------- | ------------------------------------------------------- |
| `HEADLESS`             | `true`  | Chrome headless (`true` = invisible, `false` = visible) |
| `STEALTH_ENABLED`      | `true`  | Stealth anti-detection mode                             |
| `NOTEBOOKLM_UI_LOCALE` | `fr`    | UI language for selectors (`fr` or `en`)                |

**Examples:**

```powershell
# Debug: see Chrome
$env:HEADLESS="false"
node dist/http-wrapper.js

# Use English UI selectors (for English Google Account)
$env:NOTEBOOKLM_UI_LOCALE="en"
node dist/http-wrapper.js
```

### Session Configuration

| Variable          | Default | Description                           |
| ----------------- | ------- | ------------------------------------- |
| `MAX_SESSIONS`    | `10`    | Maximum number of concurrent sessions |
| `SESSION_TIMEOUT` | `900`   | Session timeout in seconds (15 min)   |

**Examples:**

```powershell
# More simultaneous sessions
$env:MAX_SESSIONS="20"
node dist/http-wrapper.js
```

### Data Configuration

| Variable             | Default                 | Description               |
| -------------------- | ----------------------- | ------------------------- |
| `DATA_DIR`           | `./Data`                | Persistent data directory |
| `CHROME_PROFILE_DIR` | `./Data/chrome_profile` | Chrome profile            |
| `BROWSER_STATE_DIR`  | `./Data/browser_state`  | Browser state             |

---

## 🔒 Security

### 1. Restrict to Localhost

**For local use only:**

```powershell
$env:HTTP_HOST="127.0.0.1"
node dist/http-wrapper.js
```

**Advantages:**

- ✅ No network access possible
- ✅ Maximum security
- ❌ n8n must be on the same machine

### 2. Windows Firewall

**For n8n on local network, allow only the n8n server IP:**

```powershell
# Replace 192.168.1.100 with your n8n server IP
New-NetFirewallRule `
  -DisplayName "NotebookLM MCP (n8n only)" `
  -Direction Inbound `
  -LocalPort 3000 `
  -Protocol TCP `
  -Action Allow `
  -RemoteAddress 192.168.1.100
```

### 3. Add API Authentication (Optional)

Modify `src/http-wrapper.ts` after line 27:

```typescript
// Authentication middleware
const API_KEY = process.env.API_KEY || 'change-me';

app.use((req, res, next) => {
  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${API_KEY}`) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
  }
  next();
});
```

**Usage:**

```powershell
# Start with API key
$env:API_KEY="my-super-secure-secret-token"
node dist/http-wrapper.js
```

**In n8n, add the header:**

```
Authorization: Bearer my-super-secure-secret-token
```

### 4. HTTPS with Reverse Proxy (Production)

**Option A: Nginx**

```nginx
server {
    listen 443 ssl;
    server_name notebooklm.mydomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Option B: Caddy** (simpler)

```
notebooklm.mydomain.com {
    reverse_proxy localhost:3000
}
```

---

## ⚙️ Advanced Configuration

### .env File (Recommended)

Create `.env` at the root:

```bash
# HTTP Configuration
HTTP_HOST=0.0.0.0
HTTP_PORT=3000
NODE_ENV=production

# Browser Configuration
HEADLESS=true
STEALTH_ENABLED=true
NOTEBOOKLM_UI_LOCALE=fr  # or 'en' for English

# Session Configuration
MAX_SESSIONS=10
SESSION_TIMEOUT=900

# Security
API_KEY=your-secret-token

# Data Paths (optional)
DATA_DIR=./Data
CHROME_PROFILE_DIR=./Data/chrome_profile
BROWSER_STATE_DIR=./Data/browser_state
```

**Load with:**

```powershell
# Install dotenv
npm install dotenv

# Modify http-wrapper.ts (first line):
import 'dotenv/config';

# Start
node dist/http-wrapper.js
```

### Logging

The server uses the `utils/logger.ts` module with 4 levels:

- `log.success()` - Success messages (green)
- `log.info()` - Information (cyan)
- `log.warning()` - Warnings (yellow)
- `log.error()` - Errors (red)
- `log.dim()` - Secondary messages (gray)

**Disable debug logs:**

Modify `src/session/browser-session.ts` line 415:

```typescript
debug: false,  // Disable debug logs
```

---

## 🚀 Deployment Modes

### Development Mode

```powershell
npm run dev:http
```

- Auto-reload on code changes
- Debug logs enabled
- Chrome visible (`HEADLESS=false`)

### Production Mode

```powershell
$env:NODE_ENV="production"
$env:HEADLESS="true"
node dist/http-wrapper.js
```

- No auto-reload
- Minimal logs
- Chrome headless

### Background Mode (Windows)

```powershell
# Start
Start-Process node -ArgumentList "dist/http-wrapper.js" -WindowStyle Hidden

# Stop
Get-Process node | Where-Object {$_.Path -like "*node.exe*"} | Stop-Process
```

### With PM2 (Recommended for Production)

```bash
# Start (PM2 is included as dev dependency)
npm run daemon:start

# Auto-restart on boot
pm2 startup
pm2 save

# Manage
npm run daemon:status    # View status
npm run daemon:logs      # View logs
npm run daemon:restart   # Restart
npm run daemon:stop      # Stop
```

---

## 📊 Monitoring

### Health Check Endpoint

```bash
curl http://localhost:3000/health
```

**Response:**

```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "sessions": 2,
    "library_notebooks": 1,
    "context_age_hours": 0.5
  }
}
```

**Automatic monitoring (cron):**

```bash
# Check every 5 minutes
*/5 * * * * curl -s http://localhost:3000/health | jq -e '.success == true' || echo "Server down!"
```

---

## 🔧 Configuration Troubleshooting

### Problem: "EADDRINUSE: address already in use"

**Cause:** Port already in use

**Solution:**

```powershell
# Change the port
$env:HTTP_PORT="3001"
node dist/http-wrapper.js
```

### Problem: n8n cannot connect

**Cause:** Firewall or HOST misconfigured

**Solution:**

```powershell
# Check config
$env:HTTP_HOST="0.0.0.0"  # Not 127.0.0.1!
node dist/http-wrapper.js

# Check firewall
Test-NetConnection -ComputerName localhost -Port 3000
```

### Problem: "Cannot find module 'dotenv'"

**Cause:** .env used but dotenv not installed

**Solution:**

```powershell
npm install dotenv
```

---

## 📝 Complete Example

**Production startup script (`start-prod.ps1`):**

```powershell
#!/usr/bin/env pwsh

# Configuration
$env:NODE_ENV="production"
$env:HTTP_HOST="0.0.0.0"
$env:HTTP_PORT="3000"
$env:HEADLESS="true"
$env:MAX_SESSIONS="15"
$env:SESSION_TIMEOUT="1800"  # 30 min

# Checks
if (-not (Test-Path "dist/http-wrapper.js")) {
    Write-Error "Build missing. Run: npm run build"
    exit 1
}

if (-not (Test-Path "Data/browser_state/state.json")) {
    Write-Warning "Authentication not configured. Run: npm run setup-auth"
}

# Start
Write-Host "🚀 Starting in production mode..." -ForegroundColor Green
node dist/http-wrapper.js
```

---

**Configuration validated!** ✅
