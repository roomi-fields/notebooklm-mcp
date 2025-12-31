# WSL Usage Guide

This guide explains how to use the NotebookLM MCP Server with Claude Code from WSL (Windows Subsystem for Linux).

## Architecture Overview

Due to browser requirements (Playwright needs Chrome), the HTTP server must run on **Windows**. Claude Code in WSL communicates with it through a stdio-HTTP proxy.

```
┌─────────────────────────────────────────────────────────────────┐
│                         WINDOWS                                  │
│  ┌─────────────────────┐    ┌─────────────────────────────┐     │
│  │  HTTP Server        │    │       Chrome Browser        │     │
│  │  (node.exe)         │◄──►│   (Playwright-controlled)   │     │
│  │  localhost:3000     │    │                             │     │
│  └─────────────────────┘    └─────────────────────────────┘     │
│            ▲                                                     │
└────────────┼─────────────────────────────────────────────────────┘
             │ HTTP (localhost:3000)
┌────────────┼─────────────────────────────────────────────────────┐
│            │                  WSL                                │
│  ┌─────────┴───────────────────────────────────────────────────┐│
│  │  Claude Code                                                ││
│  │  └── stdio-http-proxy.js (node.exe)                         ││
│  │      - Translates MCP stdio ←→ HTTP calls                   ││
│  │      - Points to localhost:3000                             ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start the HTTP Server on Windows

**CRITICAL: The HTTP server MUST run on Windows, NOT in WSL**

Open a **Windows terminal** (PowerShell or CMD, not WSL):

```powershell
cd D:\Claude\notebooklm-mcp-http
npm run start:http
```

**Verification:** The logs must show Windows paths:

```
Chrome Profile: C:\Users\...\AppData\Local\notebooklm-mcp\Data\chrome_profile
Listening on 0.0.0.0:3000
```

If you see `/opt/google/chrome/chrome` in error messages, the server is running under WSL, not Windows!

### 2. Configure MCP in Your Project

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "notebooklm": {
      "type": "stdio",
      "command": "node.exe",
      "args": ["D:\\Claude\\notebooklm-mcp-http\\dist\\stdio-http-proxy.js"],
      "env": {
        "NOTEBOOKLM_HTTP_URL": "http://localhost:3000"
      }
    }
  }
}
```

**Important:** Use `stdio-http-proxy.js` (NOT `index.js`)

### 3. Enable the MCP Server

The first time you use it, Claude Code needs to trust the `.mcp.json` servers. Either:

- Restart Claude Code and accept when prompted
- Or manually add to `~/.claude.json` in your project section:

```json
"enabledMcpjsonServers": ["notebooklm"],
"hasTrustDialogAccepted": true,
```

### 4. Verify Configuration

```bash
# In Claude Code, run:
/mcp
```

You should see `notebooklm` listed and connected.

### 5. Authenticate (First Time)

Ask Claude to authenticate:

> "Log me in to NotebookLM"

This opens Chrome on Windows for Google authentication.

## Available MCP Tools

| Tool                | Description                        |
| ------------------- | ---------------------------------- |
| `ask_question`      | Ask a question to a notebook       |
| `list_notebooks`    | List all available notebooks       |
| `get_health`        | Check server health status         |
| `search_notebooks`  | Search notebooks by keyword        |
| `get_notebook`      | Get details of a specific notebook |
| `add_notebook`      | Add a new notebook to the library  |
| `activate_notebook` | Set a notebook as the default      |

Example usage:

```
mcp__notebooklm__ask_question(question="...", notebook_id="my-notebook")
```

## Troubleshooting

### Error: "Chrome not found at /opt/google/chrome/chrome"

**Cause:** The HTTP server is running under WSL instead of Windows.

**Solution:**

```powershell
# From Windows (not WSL):
taskkill /F /IM node.exe
cd D:\Claude\notebooklm-mcp-http
npm run start:http
```

### Check which process is listening on port 3000

```powershell
netstat -ano | findstr :3000
```

If multiple processes are listed, there may be conflicts. Kill the unwanted ones:

```powershell
taskkill /F /PID <pid_to_kill>
```

### Test that the server works (from Windows)

```powershell
curl http://localhost:3000/health
```

Should return: `{"success":true,"data":{"status":"ok",...}}`

### MCP shows "Not connected"

1. Ensure the HTTP server is running on Windows
2. Restart Claude Code after starting the HTTP server
3. Check that `.mcp.json` uses `stdio-http-proxy.js` (not `index.js`)

### Port 3000 already in use

Kill all node processes and restart:

```powershell
taskkill /F /IM node.exe
cd D:\Claude\notebooklm-mcp-http
npm run start:http
```

### Authentication expired

Ask Claude: "Check NotebookLM health" or "Re-authenticate to NotebookLM"

### Chrome profile locked

Close all Chrome windows and restart:

```powershell
taskkill /IM chrome.exe /F
```

Then restart the HTTP server.

## Configuration Reference

### Project-Level Config (`.mcp.json`)

Shareable via git, stored in project root:

```json
{
  "mcpServers": {
    "notebooklm": {
      "type": "stdio",
      "command": "node.exe",
      "args": ["D:\\Claude\\notebooklm-mcp-http\\dist\\stdio-http-proxy.js"],
      "env": {
        "NOTEBOOKLM_HTTP_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Local Config (`~/.claude.json`)

Private to you, per-project settings in the `projects` section:

```json
"/mnt/d/Claude/your-project": {
  "mcpServers": {
    "notebooklm": {
      "type": "stdio",
      "command": "node.exe",
      "args": ["D:\\Claude\\notebooklm-mcp-http\\dist\\stdio-http-proxy.js"],
      "env": {
        "NOTEBOOKLM_HTTP_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Key Points

- Use `node.exe` (Windows) not `node` (Linux)
- Use Windows paths with double backslashes: `D:\\Claude\\...`
- Use `stdio-http-proxy.js` to connect to the HTTP server
- The HTTP server must be started separately on Windows
- The `.mcp.json` servers must be enabled via `enabledMcpjsonServers`

## Data Sharing Between WSL and Windows

The server stores authentication and data in:

- **Windows**: `C:\Users\<user>\AppData\Local\notebooklm-mcp\Data\`
- **WSL symlink**: `~/.local/share/notebooklm-mcp` → Windows path

This symlink ensures both environments share the same authentication state.

To create the symlink (if not already done):

```bash
rm -rf ~/.local/share/notebooklm-mcp
ln -sf /mnt/c/Users/<user>/AppData/Local/notebooklm-mcp/Data ~/.local/share/notebooklm-mcp
```

## Helper Scripts (Windows)

The project includes PowerShell scripts for managing the server:

```powershell
# Start server with auto-restart
.\scripts\start-server.ps1

# Stop server
.\scripts\stop-server.ps1

# Check server status
.\scripts\check-server.ps1
```

### Run in Background (Hidden Window)

```powershell
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File D:\Claude\notebooklm-mcp-http\scripts\start-server.ps1" -WindowStyle Hidden
```

### Windows Task Scheduler (Auto-start on Login)

1. Open Task Scheduler (`taskschd.msc`)
2. Create Basic Task: "NotebookLM MCP Server"
3. Trigger: "When I log on"
4. Action: Start a program
   - Program: `powershell.exe`
   - Arguments: `-ExecutionPolicy Bypass -WindowStyle Hidden -File "D:\Claude\notebooklm-mcp-http\scripts\start-server.ps1"`
5. Check "Open Properties dialog" and set "Run whether user is logged on or not"

## Authentication Procedure (TOTP/2FA)

If authentication expires, follow this procedure **from Windows**:

### Step 1: Kill existing processes

```powershell
taskkill /F /IM chrome.exe
taskkill /F /IM node.exe
```

### Step 2: Run accounts test with visible browser

```powershell
cd D:\Claude\notebooklm-mcp-http
npm run accounts test account-XXXXXXXXXXXXX -- --show
```

This will:

- Open Chrome with the account profile
- Auto-login with email/password/TOTP
- Navigate to NotebookLM home page
- Save authentication state

**Note:** "TOTP input field not found" is OK if Google skips 2FA (trusted device).

### Step 3: Sync profile to main location

```powershell
# From PowerShell or WSL:
copy C:\Users\USERNAME\AppData\Local\notebooklm-mcp\Data\accounts\account-XXXXXXXXXXXXX\browser_state\* C:\Users\USERNAME\AppData\Local\notebooklm-mcp\Data\browser_state\
```

Or from WSL:

```bash
cp /mnt/c/Users/USERNAME/AppData/Local/notebooklm-mcp/Data/accounts/account-*/browser_state/* /mnt/c/Users/USERNAME/AppData/Local/notebooklm-mcp/Data/browser_state/
```

### Step 4: Start HTTP server

```powershell
cd D:\Claude\notebooklm-mcp-http
npm run start:http
```

## Quick Test Commands (from WSL)

```bash
# Start server on Windows (from WSL)
cmd.exe /c "cd /d D:\\Claude\\notebooklm-mcp-http && start /B node dist/http-wrapper.js"

# Check health (from WSL via Windows curl)
cmd.exe /c "curl http://localhost:3000/health"

# Ask a question
cmd.exe /c 'curl -s -X POST http://localhost:3000/ask -H "Content-Type: application/json" -d "{\"question\": \"Test\", \"notebook_id\": \"notebook-1\"}"'
```

## Available Notebooks

| ID         | Name               | URL                                    | Topics         |
| ---------- | ------------------ | -------------------------------------- | -------------- |
| notebook-1 | Example Notebook 1 | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | topic1, topic2 |
| notebook-2 | Example Notebook 2 | `yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy` | topic3, topic4 |

> **Note:** Replace these with your actual notebook UUIDs from NotebookLM.

## IMPORTANT: Never Run Under WSL

The HTTP server must ALWAYS run on Windows native, never under WSL.

**Why?**

- Playwright/Chrome requires Windows Chrome, not Linux Chrome
- WSL Chrome path (`/opt/google/chrome/chrome`) doesn't exist
- Running under WSL will cause: `Chromium distribution 'chrome' is not found`

**How to verify the server is on Windows:**

1. The startup logs should show Windows paths: `C:\Users\...\AppData\...`
2. Run `.\scripts\check-server.ps1` from PowerShell
