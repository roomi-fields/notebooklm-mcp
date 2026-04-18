# AI Onboarding Guide

This guide is the fastest way for an AI agent or a human working with one to install, authenticate, register, and verify this repository.

Read this before making changes to client configuration or assuming any local NotebookLM state already exists.

## What This Repo Provides

- An MCP server for NotebookLM via `dist/index.js`
- An optional local HTTP server via `dist/http-wrapper.js`
- Browser automation for NotebookLM auth and querying
- A deterministic verification script via `scripts/doctor.mjs`

## Ground Rules For AI Agents

- Default to the local source install path first.
- Treat Google login as a manual human step.
- Do not assume the user already has saved NotebookLM auth, a configured notebook URL, or a working client registration.
- Do not overwrite an existing MCP client config unless the user explicitly asks for that change.
- Use copy-paste registration snippets instead of silently mutating user config files.

## Recommended Install Matrix

| Mode | When to use it | Recommended first step |
| --- | --- | --- |
| Local MCP | Codex, Claude Code, Claude Desktop, Cursor, local MCP clients | `npm install` then `npm run build` |
| HTTP | n8n, Zapier, Make, local REST workflows | `npm install`, `npm run build`, `npm run start:http` |
| Docker/noVNC | NAS, remote host, isolated browser auth | Read [08-DOCKER.md](./08-DOCKER.md) after the local path |
| WSL | Windows host with Linux shell workflow | Read [08-WSL-USAGE.md](./08-WSL-USAGE.md) after the local path |

## Prerequisites

- Node.js `18+`
- npm
- Google Chrome installed on the machine that will authenticate
- A Google account with access to NotebookLM
- At least one NotebookLM notebook if you want to verify `/content` and `/ask`

## Golden Path

### 1. Clone the repository

```bash
git clone https://github.com/roomi-fields/notebooklm-mcp.git
cd notebooklm-mcp
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build the runtime

```bash
npm run build
```

### 4. Optional: create a local `.env`

Use `.env.example` as the starting point:

```bash
cp .env.example .env
```

You only need to set values that matter for your environment.

Useful fields:

- `NOTEBOOK_URL=https://notebooklm.google.com/notebook/<your-notebook-id>`
- `NOTEBOOKLM_UI_LOCALE=en`
- `HTTP_HOST=127.0.0.1`
- `HTTP_PORT=3000`

### 5. Run manual authentication

```bash
npm run setup-auth
```

### 6. Pause for the human auth step

When the browser opens:

1. Sign in to Google.
2. Open NotebookLM.
3. Wait until notebooks are visible.
4. Close the browser window when the auth flow is complete.

If this step is skipped, later `/health` checks will usually report `authenticated: false`.

### 7. Register the MCP server in the client

Use `dist/index.js` for MCP clients.

Generic MCP JSON pattern:

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

Client-specific wrappers:

- [../../CODEX.md](../../CODEX.md)
- [../../CLAUDE.md](../../CLAUDE.md)

### 8. Verify the install

Basic repo and build verification:

```bash
npm run doctor:basic
```

HTTP verification:

```bash
npm run start:http
```

In a second shell:

```bash
npm run doctor:http
```

Notebook-aware verification:

```bash
npm run doctor:http -- --notebook-url "https://notebooklm.google.com/notebook/<your-notebook-id>"
```

## Exact Auth Pause Point

The auth pause point is after `npm run setup-auth` launches a visible browser and before any claim that authentication completed successfully.

Do not claim success before the human has:

- signed in,
- opened NotebookLM,
- confirmed notebooks are visible,
- and closed the browser window.

## OS-Specific Command Notes

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

- Authenticate on the Windows side if browser forwarding is unreliable.
- Keep file paths consistent between the shell and the client config.
- Use the dedicated WSL notes in [08-WSL-USAGE.md](./08-WSL-USAGE.md).

## Client Registration Patterns

### Codex

Use the MCP JSON snippet in [../../CODEX.md](../../CODEX.md).

### Claude Code

```bash
claude mcp add notebooklm node /absolute/path/to/notebooklm-mcp/dist/index.js
```

### Claude Desktop

Use the JSON example in [../../CLAUDE.md](../../CLAUDE.md).

### Cursor and other MCP clients

Use the generic `command` plus `args` pattern and point to `dist/index.js`.

## Verification Sequence

Run checks in this order:

1. `npm run doctor:basic`
2. `npm run start:http`
3. `npm run doctor:http`
4. `npm run doctor:http -- --notebook-url "https://notebooklm.google.com/notebook/<your-notebook-id>"`

Interpretation:

- `doctor:basic` proves the repo, build, and required files are present.
- `doctor:http` proves the local HTTP server answers `/health`.
- `doctor:http -- --notebook-url ...` proves `/content` and `/ask` can run for a real notebook.

## Common Failure Signatures

### `/health` is unreachable

Likely causes:

- the HTTP server is not running,
- the wrong port is configured,
- another process owns port `3000`.

Try:

```bash
npm run start:http
npm run doctor:http
```

### `authenticated: false`

Likely causes:

- manual auth was never completed,
- the saved browser state expired,
- the wrong profile/session data is being used.

Try:

```bash
npm run setup-auth
```

Then complete the browser login manually.

### `/content` or `/ask` fails with a notebook URL

Likely causes:

- the notebook URL is wrong,
- the notebook is not accessible to the signed-in account,
- the NotebookLM UI language does not match configured selectors.

Try:

- opening the notebook manually in Chrome,
- confirming `NOTEBOOKLM_UI_LOCALE`,
- rerunning the HTTP doctor with the exact notebook URL.

### Browser or profile lock errors

Likely causes:

- Chrome is still using the same profile directory,
- another automation run is still active.

Try:

- close Chrome,
- stop local Node processes using the server,
- rerun auth or restart the HTTP server.

## Related Docs

- [01-INSTALL.md](./01-INSTALL.md)
- [02-CONFIGURATION.md](./02-CONFIGURATION.md)
- [05-TROUBLESHOOTING.md](./05-TROUBLESHOOTING.md)
- [08-DOCKER.md](./08-DOCKER.md)
- [08-WSL-USAGE.md](./08-WSL-USAGE.md)
