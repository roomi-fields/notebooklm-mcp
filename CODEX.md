# CODEX.md

Use `AGENTS.md` as the source of truth for install, auth, and verification.

## Codex MCP Registration

After `npm install` and `npm run build`, point Codex at:

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

## Minimal Verification Flow

```bash
npm run doctor:basic
npm run start:http
npm run doctor:http -- --notebook-url "https://notebooklm.google.com/notebook/<your-notebook-id>"
```

Manual Google login is still required during `npm run setup-auth`.
