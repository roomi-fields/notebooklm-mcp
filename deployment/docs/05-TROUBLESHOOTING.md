# Troubleshooting Guide

> Common failure signatures and the fastest next action

---

## Quick Diagnosis

Run checks in this order:

```bash
npm run doctor:basic
```

```bash
npm run start:http
```

In a second shell:

```bash
npm run doctor:http
```

If you have a notebook URL:

```bash
npm run doctor:http -- --notebook-url "https://notebooklm.google.com/notebook/<your-notebook-id>"
```

Useful direct checks:

```bash
curl http://127.0.0.1:3000/health
```

```bash
curl "http://127.0.0.1:3000/content?notebook_url=https%3A%2F%2Fnotebooklm.google.com%2Fnotebook%2F<your-notebook-id>"
```

---

## Build And Install Problems

### `npm install` fails

Common causes:

- no network access
- corrupted npm cache
- corporate proxy/firewall interference

Try:

1. confirm internet access
2. run `npm cache clean --force`
3. rerun `npm install`

### `npm run build` fails

Common causes:

- unsupported Node version
- missing dependencies
- partial install

Try:

1. run `node --version`
2. rerun `npm install`
3. run `npm run doctor:basic`

---

## Auth Problems

### `/health` says `authenticated: false`

Common causes:

- `npm run setup-auth` was never completed
- the browser was closed before NotebookLM loaded
- the saved session expired

Fix:

```bash
npm run setup-auth
```

Then complete the browser flow manually:

1. sign in to Google
2. open NotebookLM
3. wait until notebooks are visible
4. close the browser window

### Auth files exist but NotebookLM still fails

Common causes:

- stale cookies/state
- wrong profile still locked by Chrome
- UI locale mismatch

Try:

1. close Chrome completely
2. stop any local Node process using the repo
3. rerun `npm run setup-auth`
4. verify `NOTEBOOKLM_UI_LOCALE`

---

## HTTP Startup Problems

### `/health` is unreachable

Common causes:

- the HTTP server is not running
- the wrong port is configured
- another process already owns port `3000`

Try:

```powershell
netstat -ano | findstr :3000
```

Then either stop the conflicting process or choose a different port.

### Port already in use

Example symptom:

```text
EADDRINUSE: address already in use :::3000
```

Fix options:

1. stop the existing process
2. set a different port and restart

Example:

```powershell
$env:HTTP_PORT="3001"
npm run start:http
```

---

## Notebook Problems

### `/content` or `/ask` fails with a notebook URL

Common causes:

- invalid notebook URL
- notebook not accessible to the signed-in account
- NotebookLM UI language mismatch

Try:

1. open the notebook manually in Chrome
2. confirm the URL matches the address bar exactly
3. confirm the current Google account can access it
4. rerun:

```bash
npm run doctor:http -- --notebook-url "https://notebooklm.google.com/notebook/<your-notebook-id>"
```

### Notebook validation fails when adding to the library

Common causes:

- the notebook does not exist
- the notebook is private to another account
- auth is incomplete

Try:

1. verify `/health`
2. verify the notebook manually in NotebookLM
3. rerun auth if needed

---

## Browser And Profile Problems

### Browser/profile lock errors

Example symptoms:

- target page or browser closed unexpectedly
- profile lock file errors
- browser launches but session cannot be reused

Common causes:

- Chrome is already using the same profile
- another NotebookLM MCP run is still active

Try:

1. close Chrome
2. stop repo-related Node processes
3. restart the HTTP server
4. rerun auth if needed

### The UI selectors do not match

Common cause:

- `NOTEBOOKLM_UI_LOCALE` does not match the actual NotebookLM language

Fix:

- set `NOTEBOOKLM_UI_LOCALE=en` for English UI
- set `NOTEBOOKLM_UI_LOCALE=fr` for French UI
- rebuild or restart after changing config if needed

---

## Network Problems

### Works locally but not from another machine

Common causes:

- `HTTP_HOST` is still `127.0.0.1`
- firewall blocks inbound traffic

Fix:

1. set `HTTP_HOST=0.0.0.0`
2. restart the server
3. verify firewall rules

Windows quick test:

```powershell
Test-NetConnection -ComputerName <server-ip> -Port 3000
```

---

## If You Still Cannot Unblock It

Capture these facts before making further changes:

1. output of `npm run doctor:basic`
2. output of `npm run doctor:http`
3. the exact notebook URL used for testing
4. whether the browser auth flow fully completed
5. whether NotebookLM loads manually in Chrome

Then compare against:

- [00-AI-ONBOARDING.md](./00-AI-ONBOARDING.md)
- [01-INSTALL.md](./01-INSTALL.md)
- [02-CONFIGURATION.md](./02-CONFIGURATION.md)
