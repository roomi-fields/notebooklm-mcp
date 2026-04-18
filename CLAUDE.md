# CLAUDE.md

Use `AGENTS.md` as the canonical install and troubleshooting guide.

## Claude Code / Claude Desktop Registration

After `npm install` and `npm run build`, register the MCP server with the built entrypoint:

```bash
claude mcp add notebooklm node /absolute/path/to/notebooklm-mcp/dist/index.js
```

For Claude Desktop-style JSON config, use:

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

## Required Human Step

`npm run setup-auth` opens a browser, but the Google sign-in itself must be completed manually by the user.
