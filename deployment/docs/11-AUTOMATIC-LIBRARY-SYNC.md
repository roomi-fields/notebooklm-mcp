# Automatic Notebook Library Sync

The auto-sync worker periodically asks the NotebookLM HTTP server to scrape the authenticated account and import discovered notebooks into the local library.

## Run with npx

```bash
NOTEBOOKLM_SERVER_URL=http://127.0.0.1:3000 \
AUTO_IMPORT_NOTEBOOKS_INTERVAL=600 \
npx -y --package @roomi-fields/notebooklm-mcp notebooklm-mcp-auto-sync
```

The worker performs a sync on startup by default, then repeats at the configured interval.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `NOTEBOOKLM_SERVER_URL` | `http://127.0.0.1:3000` | NotebookLM HTTP server URL |
| `MCP_HTTP_URL` | — | Backward-compatible server URL |
| `AUTO_IMPORT_NOTEBOOKS_INTERVAL` | `600` | Sync interval in seconds; minimum 60 |
| `AUTO_IMPORT_NOTEBOOKS_ON_STARTUP` | `true` | Run once when the worker starts |
| `AUTO_DISCOVER_IMPORTED_NOTEBOOKS` | `false` | Generate metadata through NotebookLM while importing |
| `AUTO_IMPORT_SHOW_BROWSER` | `false` | Show the browser while scraping |

## Docker Compose example

Run the worker as a sidecar that shares the HTTP server network:

```yaml
services:
  notebooklm:
    image: notebooklm-mcp:latest
    ports:
      - "3000:3000"

  notebooklm-auto-sync:
    image: notebooklm-mcp:latest
    command: ["node", "dist/cli/auto-sync.js"]
    restart: unless-stopped
    environment:
      NOTEBOOKLM_SERVER_URL: http://notebooklm:3000
      AUTO_IMPORT_NOTEBOOKS_INTERVAL: "600"
      AUTO_IMPORT_NOTEBOOKS_ON_STARTUP: "true"
      AUTO_DISCOVER_IMPORTED_NOTEBOOKS: "false"
    depends_on:
      - notebooklm
```

## Behavior

- prevents overlapping sync runs;
- logs discovered, imported, and failed counts;
- continues scheduling after a failed run;
- does not require Google credentials because authentication remains in the HTTP server;
- uses the existing `/notebooks/import-from-scrape` endpoint.

Set `AUTO_DISCOVER_IMPORTED_NOTEBOOKS=true` only when generated descriptions and topics are needed. Auto-discovery sends an additional NotebookLM query for every imported notebook and is slower than plain import.
