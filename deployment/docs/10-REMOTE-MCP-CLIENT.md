# Remote MCP Client

Connect Claude Code or another stdio MCP client to a NotebookLM HTTP server running on another machine without cloning this repository or referencing files inside `dist/`.

## Claude Code

Replace the URL with the address of the NotebookLM HTTP server:

```bash
claude mcp add notebooklm --scope user -- \
  npx -y --package @roomi-fields/notebooklm-mcp \
  notebooklm-mcp-remote --url http://192.168.1.211:3000
```

Verify the connection:

```bash
claude mcp list
```

Then run `/mcp` inside Claude Code.

## SSH tunnel

For a server bound to localhost, create a tunnel first:

```bash
ssh -N -L 3000:127.0.0.1:3000 user@server
```

Then register the client against the local end of the tunnel:

```bash
claude mcp add notebooklm --scope user -- \
  npx -y --package @roomi-fields/notebooklm-mcp \
  notebooklm-mcp-remote --url http://127.0.0.1:3000
```

## Other configuration methods

The server URL can be supplied in three ways, in priority order:

1. `--url` or `-u`
2. First positional argument
3. `NOTEBOOKLM_SERVER_URL` or the legacy `MCP_HTTP_URL` environment variable

Examples:

```bash
notebooklm-mcp-remote http://192.168.1.211:3000
NOTEBOOKLM_SERVER_URL=http://192.168.1.211:3000 notebooklm-mcp-remote
```

## Security

The NotebookLM HTTP server does not provide API-key authentication by default. Prefer one of these deployments:

- bind the HTTP port to localhost and use an SSH tunnel;
- keep the server on a trusted private network;
- place an authenticated reverse proxy in front of it.

Google authentication remains on the HTTP server. The remote MCP client does not need a separate Google login or OAuth client ID.
