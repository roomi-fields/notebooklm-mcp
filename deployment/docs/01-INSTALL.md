# Installation Guide

> Local source installation for MCP clients and the optional HTTP server

Start with [00-AI-ONBOARDING.md](./00-AI-ONBOARDING.md) if you are an AI agent or working with one.

---

## Recommended Default

Use the local source install path first:

1. install dependencies
2. build the project
3. complete manual Google auth
4. register `dist/index.js` in the MCP client
5. verify with the doctor script

This is the fastest supported path for Codex, Claude, Cursor, and most MCP workflows.

---

## Prerequisites

You need:

- Node.js `18+`
- npm
- Google Chrome
- a Google account with NotebookLM access
- at least one notebook if you want to run `/content` and `/ask` verification

Check Node:

```bash
node --version
npm --version
```

---

## Clone The Repository

```bash
git clone https://github.com/roomi-fields/notebooklm-mcp.git
cd notebooklm-mcp
```

If you downloaded a ZIP instead, open a shell in the extracted folder before continuing.

---

## Install Dependencies

```bash
npm install
```

Expected outcome:

- `node_modules/` is created
- the install finishes without dependency errors

---

## Build The Runtime

```bash
npm run build
```

Required output files after build:

- `dist/index.js`
- `dist/http-wrapper.js`

Quick check:

```bash
npm run doctor:basic
```

---

## Optional `.env` Setup

This repo ships `.env.example` for local configuration.

Create a local `.env` only if you need it:

```bash
cp .env.example .env
```

Useful fields:

- `NOTEBOOK_URL=https://notebooklm.google.com/notebook/<your-notebook-id>`
- `NOTEBOOKLM_UI_LOCALE=en`
- `HTTP_HOST=127.0.0.1`
- `HTTP_PORT=3000`

Important:

- `.env` helps with configuration
- `.env` does not replace the manual auth step
- do not commit real notebook URLs or local auth data

---

## Manual Google Authentication

Run:

```bash
npm run setup-auth
```

What happens:

1. the auth flow launches a visible browser
2. a human must sign in to Google
3. the human must open NotebookLM
4. the human should wait until notebooks are visible
5. the human closes the browser window

If this step is skipped or times out, later health checks will usually report `authenticated: false`.

Auth data is stored in the local application data directory, not in the repo.

Typical Windows path:

```text
%LOCALAPPDATA%\notebooklm-mcp\Data\
```

---

## Register The MCP Server

Use `dist/index.js` in the client configuration.

Generic MCP JSON:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "node",
      "args": ["/absolute/path/to/notebooklm-mcp/dist/index.js"]
    }
  }
}
```

Client-specific guides:

- [../../CODEX.md](../../CODEX.md)
- [../../CLAUDE.md](../../CLAUDE.md)

Do not silently overwrite an existing client config unless the user explicitly asks for it.

---

## Verify The Install

### Basic verification

```bash
npm run doctor:basic
```

### HTTP verification

Start the local HTTP server:

```bash
npm run start:http
```

In a second shell:

```bash
npm run doctor:http
```

### Notebook-aware verification

If you have a notebook URL:

```bash
npm run doctor:http -- --notebook-url "https://notebooklm.google.com/notebook/<your-notebook-id>"
```

That last check exercises:

- `/health`
- `/content`
- `/ask`

---

## MCP vs HTTP

### Use MCP when

- you want direct tool use from Codex, Claude, Cursor, or another MCP client
- you do not need an HTTP endpoint

### Use HTTP when

- you want REST integration for n8n, Zapier, Make, or custom tooling
- you want to test `/health`, `/content`, and `/ask` directly

HTTP startup:

```bash
npm run start:http
```

Quick health check:

```bash
curl http://127.0.0.1:3000/health
```

---

## Platform Notes

### Windows PowerShell

```powershell
git clone https://github.com/roomi-fields/notebooklm-mcp.git
cd notebooklm-mcp
npm install
npm run build
npm run setup-auth
```

### macOS / Linux

```bash
git clone https://github.com/roomi-fields/notebooklm-mcp.git
cd notebooklm-mcp
npm install
npm run build
npm run setup-auth
```

### WSL

Use the dedicated notes in [08-WSL-USAGE.md](./08-WSL-USAGE.md) if the shell is Linux but the browser/auth flow needs the Windows side.

---

## Next Docs

- [02-CONFIGURATION.md](./02-CONFIGURATION.md)
- [05-TROUBLESHOOTING.md](./05-TROUBLESHOOTING.md)
- [08-DOCKER.md](./08-DOCKER.md)
- [08-WSL-USAGE.md](./08-WSL-USAGE.md)
