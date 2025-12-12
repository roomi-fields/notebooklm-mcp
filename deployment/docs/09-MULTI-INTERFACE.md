# Multi-Interface Mode (v1.3.6+)

> Run Claude Desktop AND HTTP API simultaneously with a single Chrome instance

---

## Overview

The **Stdio-HTTP Proxy** enables Claude Desktop to communicate with the HTTP server, solving the Chrome profile locking issue without requiring separate browser profiles.

```
┌─────────────────────────────────────────────────────────────────┐
│                        ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Claude Desktop ─────► Stdio-HTTP Proxy ────┐                   │
│                        (no Chrome)          │                   │
│                                             ▼                   │
│  n8n / Zapier ──────────────────────► HTTP Server ──► Chrome    │
│                                             │                   │
│  curl / Postman ────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits:**

- ✅ Single Chrome instance (no profile conflicts)
- ✅ Shared authentication state
- ✅ Claude Desktop + HTTP API running simultaneously
- ✅ No additional disk space for separate profiles

---

## Quick Start

### Step 1: Start the HTTP Server

> **⚠️ CRITICAL: The HTTP server MUST run on Windows (not WSL)**
>
> The server uses Playwright to control Chrome. If you run the server from WSL,
> it will look for Chrome at Linux paths (`/opt/google/chrome/chrome`) instead
> of Windows paths and **will fail**.
>
> Always start the HTTP server from **PowerShell** or **CMD**, not from WSL bash.

**From PowerShell (recommended):**

```powershell
cd D:\Claude\notebooklm-mcp-http

# Build if needed
npm run build

# Start HTTP server (foreground)
node dist/http-wrapper.js

# Or in background (survives terminal close):
Start-Process -NoNewWindow node -ArgumentList "dist/http-wrapper.js"
```

**From WSL (recommended - use helper script):**

```bash
# Helper script handles everything correctly
HELPER=/mnt/d/Claude/notebooklm-mcp-http/scripts/mcp-wsl-helper.sh

$HELPER start      # Start server (Windows process)
$HELPER health     # Check health
$HELPER auth       # Authenticate (opens Chrome)
$HELPER ask "question" notebook-id  # Ask a question
$HELPER stop       # Stop server
```

**From WSL (manual - launches Windows node process):**

```bash
# This launches node.exe on Windows, NOT node in WSL
powershell.exe -Command "Start-Process -NoNewWindow -FilePath 'node' -ArgumentList 'D:/Claude/notebooklm-mcp-http/dist/http-wrapper.js' -WorkingDirectory 'D:/Claude/notebooklm-mcp-http'"
```

### Step 2: Configure Claude Desktop

Edit your Claude Desktop config file:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "node",
      "args": ["D:/Claude/notebooklm-mcp-http/dist/stdio-http-proxy.js"],
      "env": {
        "MCP_HTTP_URL": "http://localhost:3000"
      }
    }
  }
}
```

> **Note:** Replace the path with your actual installation path.

### Step 3: Restart Claude Desktop

Close and reopen Claude Desktop. The proxy will connect to your HTTP server.

---

## Configuration Options

### Environment Variables

| Variable       | Default                 | Description          |
| -------------- | ----------------------- | -------------------- |
| `MCP_HTTP_URL` | `http://localhost:3000` | HTTP server URL      |
| `HTTP_PORT`    | `3000`                  | Port for HTTP server |
| `HTTP_HOST`    | `0.0.0.0`               | Host for HTTP server |

### Custom Port Example

```bash
# Terminal 1: HTTP server on port 4000
HTTP_PORT=4000 npm run start:http

# Claude Desktop config
{
  "mcpServers": {
    "notebooklm": {
      "command": "node",
      "args": ["/path/to/dist/stdio-http-proxy.js"],
      "env": {
        "MCP_HTTP_URL": "http://localhost:4000"
      }
    }
  }
}
```

---

## NPM Scripts

| Script         | Description                      |
| -------------- | -------------------------------- |
| `start:http`   | Start HTTP server (foreground)   |
| `start:proxy`  | Start stdio proxy (for testing)  |
| `daemon:start` | Start HTTP server as PM2 daemon  |
| `daemon:stop`  | Stop PM2 daemon                  |
| `daemon:logs`  | View daemon logs                 |
| `dev:http`     | Development mode with hot reload |
| `dev:proxy`    | Development mode for proxy       |

---

## Usage Scenarios

### Scenario 1: Claude Desktop Only (via Proxy)

```bash
# Start HTTP server
npm run daemon:start

# Configure Claude Desktop with proxy (see above)
# Use Claude Desktop normally
```

### Scenario 2: HTTP API Only (n8n, Zapier)

```bash
# Start HTTP server
npm run start:http

# Use HTTP API
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is X?", "notebook_id": "my-notebook"}'
```

### Scenario 3: Both Simultaneously

```bash
# Terminal 1: HTTP server (owns Chrome)
npm run daemon:start

# Claude Desktop: uses proxy (configured above)
# n8n/Zapier: uses HTTP API directly
# Both work simultaneously!
```

---

## Troubleshooting

### Proxy can't connect to HTTP server

```
Cannot connect to HTTP server at http://localhost:3000
```

**Solution:** Ensure HTTP server is running:

```bash
npm run daemon:status  # Check if running
npm run daemon:start   # Start if not
```

### Authentication issues

The HTTP server manages authentication. If you need to re-authenticate:

```bash
# Via HTTP API
curl -X POST http://localhost:3000/setup-auth

# Or use Claude Desktop (via proxy)
# Ask: "Setup NotebookLM authentication"
```

### WSL Users - Chrome not found

```
Error: Playwright cannot find Chrome at /opt/google/chrome/chrome
```

**This means you started the HTTP server from WSL instead of Windows.**

The HTTP server MUST run as a Windows process to access Chrome. Fix:

```bash
# Use the helper script (recommended)
HELPER=/mnt/d/Claude/notebooklm-mcp-http/scripts/mcp-wsl-helper.sh

# 1. Stop any running server
$HELPER stop

# 2. Start server (launches Windows process)
$HELPER start

# 3. Verify it works
$HELPER health
```

**Or manually:**

```bash
# 1. Kill any WSL server
pkill -f http-wrapper

# 2. Start as Windows process
powershell.exe -Command "Start-Process -NoNewWindow -FilePath 'node' -ArgumentList 'D:/Claude/notebooklm-mcp-http/dist/http-wrapper.js' -WorkingDirectory 'D:/Claude/notebooklm-mcp-http'"

# 3. Verify (via PowerShell, not curl from WSL)
powershell.exe -Command "Invoke-RestMethod -Uri 'http://localhost:3000/health'"
```

> **Note:** `curl` from WSL may not reach Windows localhost due to network isolation.
> Always use `powershell.exe` or the helper script.

---

## Comparison: Proxy vs Native Stdio

| Feature              | Native Stdio       | Stdio-HTTP Proxy     |
| -------------------- | ------------------ | -------------------- |
| Chrome instance      | Own instance       | Uses HTTP server's   |
| Run with HTTP server | ❌ Chrome conflict | ✅ Works             |
| Authentication       | Own profile        | Shared with HTTP     |
| Dependencies         | Full (Playwright)  | Minimal (fetch only) |
| Latency              | Direct             | +1 HTTP hop          |
| Use case             | Standalone         | Multi-interface      |

---

## Future: Multi-Profile Mode (v1.4.0)

The multi-profile feature (separate Chrome profiles per mode) is planned for v1.4.0 but is a **separate feature** from multi-interface:

- **Multi-Interface (v1.3.6):** Single Chrome, multiple clients via proxy
- **Multi-Profile (v1.4.0):** Multiple Chrome profiles for independent auth

Most users should use the proxy approach for simplicity.

---

## See Also

- [Installation Guide](./01-INSTALL.md)
- [API Reference](./03-API.md)
- [Chrome Limitation](../../docs/CHROME_PROFILE_LIMITATION.md)
- [WSL Usage](./08-WSL-USAGE.md)
