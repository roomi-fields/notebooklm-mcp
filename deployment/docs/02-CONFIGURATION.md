# Configuration Guide

> Environment variables, `.env` usage, and deployment-safe defaults

This repo supports both MCP and HTTP usage. The safest default is a local source install plus manual Google auth.

---

## Start From `.env.example`

Copy the example file only if you need local overrides:

```bash
cp .env.example .env
```

Important:

- `.env` configures runtime behavior
- `.env` does not complete Google login for you
- `.env` should stay local and must not contain committed secrets or real notebook URLs in public examples

---

## Common Variables

### Notebook settings

| Variable | Default | Description |
| --- | --- | --- |
| `NOTEBOOK_URL` | empty | Optional default notebook URL for local HTTP checks |
| `NOTEBOOKLM_UI_LOCALE` | `fr` or repo default | NotebookLM UI language selectors |

### HTTP settings

| Variable | Default | Description |
| --- | --- | --- |
| `HTTP_HOST` | `0.0.0.0` | HTTP listen address |
| `HTTP_PORT` | `3000` | HTTP listen port |
| `NODE_ENV` | `development` | Runtime mode |

### Browser settings

| Variable | Default | Description |
| --- | --- | --- |
| `HEADLESS` | `true` | Run browser headless or visible |
| `STEALTH_ENABLED` | `true` | Enable stealth mode |

### Session settings

| Variable | Default | Description |
| --- | --- | --- |
| `MAX_SESSIONS` | `10` | Maximum concurrent sessions |
| `SESSION_TIMEOUT` | `900` | Session timeout in seconds |

### Data locations

| Variable | Default | Description |
| --- | --- | --- |
| `DATA_DIR` | `./Data` | Persistent runtime data directory |
| `CHROME_PROFILE_DIR` | `./Data/chrome_profile` | Chrome profile directory |
| `BROWSER_STATE_DIR` | `./Data/browser_state` | Saved browser state directory |

---

## Example `.env`

```dotenv
# Optional default notebook for local verification
NOTEBOOK_URL=https://notebooklm.google.com/notebook/<your-notebook-id>

# HTTP server
HTTP_HOST=127.0.0.1
HTTP_PORT=3000
NODE_ENV=production

# Browser automation
HEADLESS=true
STEALTH_ENABLED=true
NOTEBOOKLM_UI_LOCALE=en

# Session handling
MAX_SESSIONS=10
SESSION_TIMEOUT=900

# Persistent data
DATA_DIR=./Data
CHROME_PROFILE_DIR=./Data/chrome_profile
BROWSER_STATE_DIR=./Data/browser_state
```

---

## Recommended Defaults

### For local MCP use

Use these defaults:

- no HTTP host change needed unless you also want REST
- `HEADLESS=true` for normal operation
- `NOTEBOOKLM_UI_LOCALE` must match the Google/NotebookLM UI language actually in use

### For local HTTP use

Recommended local-only settings:

```dotenv
HTTP_HOST=127.0.0.1
HTTP_PORT=3000
```

This avoids exposing the server to the local network by default.

### For network use

If you intentionally want LAN access:

```dotenv
HTTP_HOST=0.0.0.0
HTTP_PORT=3000
```

Use firewall rules or a reverse proxy before exposing the endpoint beyond your machine.

---

## Auth Reality Check

Config and auth are different things.

Even with a complete `.env`, you still need:

```bash
npm run setup-auth
```

Then a human must finish Google login in the browser window.

If auth was never completed, `/health` will usually show `authenticated: false`.

---

## Typical Startup Commands

### MCP build only

```bash
npm run build
```

### HTTP server

```bash
npm run start:http
```

### Basic verification

```bash
npm run doctor:basic
```

### HTTP verification

```bash
npm run doctor:http
```

### Notebook-aware verification

```bash
npm run doctor:http -- --notebook-url "https://notebooklm.google.com/notebook/<your-notebook-id>"
```

---

## Security Notes

### Keep local data local

Do not publish:

- `.env`
- browser profile data
- cookies
- saved auth state
- machine-specific log files
- real notebook URLs tied to private work

### Prefer copy-paste config snippets

When helping a user or AI client:

- provide JSON or CLI snippets
- do not silently overwrite existing MCP client config unless explicitly asked

### Keep HTTP private by default

Use `127.0.0.1` unless you intentionally need network access.

---

## Reverse Proxy Example

If you need HTTPS in front of the HTTP server, terminate TLS with a reverse proxy and forward to the local port.

Nginx example:

```nginx
server {
    listen 443 ssl;
    server_name notebooklm.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

---

## Troubleshooting Configuration

If config looks right but behavior is still wrong:

1. run `npm run doctor:basic`
2. run `npm run doctor:http`
3. confirm the UI locale matches NotebookLM
4. rerun `npm run setup-auth` if auth is stale

See [05-TROUBLESHOOTING.md](./05-TROUBLESHOOTING.md) for failure-specific fixes.
