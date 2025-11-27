# Troubleshooting Guide - NotebookLM MCP HTTP Server

> Solutions to common problems

---

## 🔍 Quick Diagnosis

### Verification Commands

```powershell
# 1. Server active?
netstat -ano | findstr :3000

# 2. Health check
curl http://localhost:3000/health

# 3. Node processes
Get-Process node

# 4. Logs (if launched with scripts)
# See the terminal where the server is running
```

---

## ❌ Installation Problems

### Error: "npm install" fails

**Symptoms:**

```
npm ERR! code ECONNREFUSED
npm ERR! network request failed
```

**Solutions:**

1. Check Internet connection
2. Clean npm cache: `npm cache clean --force`
3. Retry: `npm install`
4. Use VPN if corporate firewall

---

### Error: "npm run build" fails

**Symptoms:**

```
error TS2307: Cannot find module 'express'
```

**Solutions:**

1. Reinstall dependencies: `rm -rf node_modules && npm install`
2. Check Node.js version: `node --version` (must be 20+)
3. Verify package.json exists

---

## ❌ Authentication Problems

### Chrome profile empty after setup-auth

**Symptoms:**

- Session not persistent
- Auth files missing or empty

**IMPORTANT:** Files are stored in `%LOCALAPPDATA%\notebooklm-mcp\Data\`, NOT in the project directory!

**Solutions:**

1. Verify 5 second fix is applied (auth-manager.ts line 966)
2. Rerun: `npm run setup-auth`
3. Wait for Chrome to close completely
4. Verify files created in the RIGHT location:
   ```powershell
   echo $env:LOCALAPPDATA\notebooklm-mcp\Data
   dir $env:LOCALAPPDATA\notebooklm-mcp\Data\chrome_profile\Default\Cookies
   dir $env:LOCALAPPDATA\notebooklm-mcp\Data\browser_state\state.json
   ```
5. The Cookies file must be >10KB

---

### Google session expires

**Symptoms:**

```
Error: Authentication required
```

**Solutions:**

1. Re-authenticate: `npm run setup-auth`
2. Verify cookies: cookies valid for 399 days
3. Check for conflicts: close all Chrome instances

---

## ❌ Startup Problems

### Port 3000 already in use

**Symptoms:**

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**

1. Find process:
   ```powershell
   netstat -ano | findstr :3000
   ```
2. Kill process:
   ```powershell
   taskkill /PID <PID> /F
   ```
3. Or change port:
   ```powershell
   $env:HTTP_PORT="3001"
   node dist/http-wrapper.js
   ```

---

### "Target page, context or browser has been closed"

**Symptoms:**

```
Error: Target page, context or browser has been closed
```

**Causes:**

- Multiple Chrome instances sharing the same profile
- Chrome profile locked

**Solutions:**

1. Close all node processes:
   ```powershell
   Get-Process node | Stop-Process -Force
   ```
2. Remove the lock (if necessary):
   ```powershell
   rm Data\chrome_profile\SingletonLock
   ```
3. Restart server

---

## ❌ Response Problems

### Timeout waiting for response

**Symptoms:**

```
Error: Timeout waiting for response from NotebookLM
```

**Causes:**

- NotebookLM not responding
- Notebook doesn't exist
- Rate limit reached

**Solutions:**

1. Verify notebook exists: `curl http://localhost:3000/notebooks`
2. Test manually on notebooklm.google.com
3. Check rate limit (50/day free)
4. Increase timeout (already 120s by default)

---

### Incomplete responses or placeholders

**Symptoms:**

- Response = "Getting the context..."
- Truncated text

**Causes:**

- Streaming fix not applied
- Insufficient stability

**Solutions:**

1. Verify fix line 210 page-utils.ts: `requiredStablePolls = 8`
2. Verify placeholders line 51 page-utils.ts
3. Rebuild: `npm run build`

---

## ❌ Network Problems (n8n)

### n8n cannot connect

**Symptoms:**

```
ECONNREFUSED 192.168.1.52:3000
```

**Solutions:**

1. Verify server listens on 0.0.0.0:
   ```powershell
   # Should show 0.0.0.0:3000, not 127.0.0.1:3000
   netstat -ano | findstr :3000
   ```
2. Verify correct IP: `ipconfig`
3. Test from n8n:
   ```bash
   curl http://192.168.1.52:3000/health
   ```
4. Check Windows firewall:
   ```powershell
   Test-NetConnection -ComputerName 192.168.1.52 -Port 3000
   ```

---

### Windows firewall blocks

**Symptoms:**

- Connection works locally
- Fails from network

**Solutions:**

1. Allow port:
   ```powershell
   New-NetFirewallRule `
     -DisplayName "NotebookLM MCP" `
     -Direction Inbound `
     -LocalPort 3000 `
     -Protocol TCP `
     -Action Allow
   ```
2. Or temporarily disable firewall to test

---

## ❌ Performance Problems

### Slow server

**Causes:**

- Too many active sessions
- Insufficient RAM
- Chrome not headless

**Solutions:**

1. List sessions: `curl http://localhost:3000/sessions`
2. Close sessions: `curl -X DELETE http://localhost:3000/sessions/<id>`
3. Reduce MAX_SESSIONS:
   ```powershell
   $env:MAX_SESSIONS="5"
   ```
4. Check available RAM: `Get-Process node`

---

### NotebookLM rate limit reached

**Symptoms:**

```
Error: NotebookLM rate limit reached (50 queries/day)
```

**Solutions:**

1. Wait 24h (reset midnight PST)
2. Switch to Google Workspace (higher limit)
3. Monitor usage: count queries/day

---

## ❌ PowerShell Script Problems

### "Execution policy" error

**Symptoms:**

```
.\install.ps1 : File cannot be loaded because running scripts is disabled
```

**Solutions:**

1. Allow scripts (current session):
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```
2. Then rerun script

---

### Script cannot find package.json

**Symptoms:**

```
package.json introuvable
```

**Solutions:**

1. Verify you are in the correct directory:
   ```powershell
   cd D:\notebooklm-http
   ls package.json  # Must exist
   ```
2. Run from project root, not from deployment/

---

## 🔧 Debug Commands

### Enable debug logs

Modify `src/session/browser-session.ts` line 415:

```typescript
debug: true,  // See detailed logs
```

Rebuild: `npm run build`

### See Chrome in action

```powershell
$env:HEADLESS="false"
node dist/http-wrapper.js
```

### Full logs

```powershell
# Redirect logs to file
node dist/http-wrapper.js 2>&1 | Tee-Object -FilePath server.log
```

---

## 📊 Complete Diagnostic Checklist

```powershell
# 1. Node.js OK?
node --version  # v20+
npm --version   # v10+

# 2. Build OK?
ls dist/http-wrapper.js  # Exists?

# 3. Auth OK?
ls Data/chrome_profile/Default/Cookies  # >10KB?
ls Data/browser_state/state.json        # Exists?

# 4. Port free?
netstat -ano | findstr :3000  # No result = OK

# 5. Server starts?
node dist/http-wrapper.js  # See logs

# 6. Health OK?
curl http://localhost:3000/health  # authenticated: true?

# 7. Full test?
curl -X POST http://localhost:3000/ask `
  -H "Content-Type: application/json" `
  -d '{"question":"test","notebook_id":"cnv"}'
```

If all checks pass but problem persists → GitHub Issues

---

## 🆘 Getting Help

### Logs to Provide

When opening an issue, include:

1. **Environment:**

   ```
   - OS: Windows 11
   - Node: v20.9.0
   - npm: 10.1.0
   ```

2. **Server logs:** (last 50 lines)

3. **Exact command:**

   ```powershell
   node dist/http-wrapper.js
   ```

4. **Exact error:**
   ```
   Error: EADDRINUSE
   ```

### Support

- **GitHub Issues:** [To be configured when repository is published]
- **Discussions:** [To be configured when repository is published]
- **Documentation:** ./deployment/docs/

---

**Complete troubleshooting guide!** ✅
