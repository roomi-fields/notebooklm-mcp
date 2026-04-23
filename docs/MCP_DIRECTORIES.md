# MCP Directories & Registries

Tracking of all directories where `@roomi-fields/notebooklm-mcp` is listed or submitted.

## Currently Listed

| Directory          | URL                                                                                                              | Notes                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Glama.ai**       | [glama.ai/mcp/servers/@roomi-fields/notebooklm-mcp](https://glama.ai/mcp/servers/@roomi-fields/notebooklm-mcp)   | Security A, Quality A, License A. Auto-indexed. |
| **PulseMCP**       | [pulsemcp.com/servers/pleaseprompto-notebooklm](https://www.pulsemcp.com/servers/pleaseprompto-notebooklm)       | #163 global, ~177k visitors. Auto-aggregated.   |
| **mcpservers.org** | [mcpservers.org/servers/roomi-fields/notebooklm-mcp](https://mcpservers.org/servers/roomi-fields/notebooklm-mcp) | Full listing. Auto-indexed.                     |
| **MCPMarket.com**  | [mcpmarket.com/server/notebooklm](https://mcpmarket.com/server/notebooklm)                                       | Has Top 100 leaderboard.                        |
| **LobeHub**        | [lobehub.com/mcp/roomi-fields-notebooklm-mcp](https://lobehub.com/mcp/roomi-fields-notebooklm-mcp)               | Auto-indexed.                                   |
| **npm**            | [npmjs.com/package/@roomi-fields/notebooklm-mcp](https://www.npmjs.com/package/@roomi-fields/notebooklm-mcp)     | v1.5.7 published with `mcpName` field.          |
| **Official MCP Registry** | [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/) | `io.github.roomi-fields/notebooklm-mcp` v1.5.7, status active. |
| **Cursor Directory** | [cursor.directory/mcp/notebooklm-mcp](https://cursor.directory/mcp/notebooklm-mcp) | Submitted via web form. Live. |
| **awesome-mcp-servers** | [github.com/punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) | 79.6k stars. Merged via [PR #2467](https://github.com/punkpeye/awesome-mcp-servers/pull/2467). |

## Pending Review

| Directory                             | Submission          | Date       | Link                                                                         |
| ------------------------------------- | ------------------- | ---------- | ---------------------------------------------------------------------------- |
| **Cline Marketplace**                 | Issue               | 2026-02-27 | [Issue #703](https://github.com/cline/mcp-marketplace/issues/703)            |
| **mcp.so**                            | Comment on Issue #1 | 2026-02-27 | [Comment](https://github.com/chatmcp/mcpso/issues/1#issuecomment-3971662494) |

## Not Yet Submitted (Tier 2)

| Directory                                    | How to Submit                                             | Priority |
| -------------------------------------------- | --------------------------------------------------------- | -------- |
| **FindMCP.dev**                              | Web form at findmcp.dev (~2 min)                          | Medium   |
| **wong2/awesome-mcp-servers** (3.6k stars)   | GitHub PR                                                 | Medium   |
| **appcypher/awesome-mcp-servers** (5k stars) | GitHub PR                                                 | Medium   |
| **MCPIndex.net**                             | Contact form at mcpindex.net/en/contact                   | Medium   |
| **MCPList.ai**                               | Web form                                                  | Medium   |
| **Docker MCP Catalog**                       | PR on github.com/docker/mcp-registry (needs Docker image) | Medium   |
| **Windsurf Directory**                       | windsurf.run/mcp                                          | Low      |

## Not Yet Submitted (Tier 3)

| Directory                                       | How to Submit                            |
| ----------------------------------------------- | ---------------------------------------- |
| **MCPServerFinder.com**                         | Web form                                 |
| **MCPServer.dev**                               | Web form                                 |
| **MCPServe.com**                                | Web form at mcpserve.com/submit          |
| **MCP-Server-Directory.com**                    | Web form                                 |
| **MCPServers.com**                              | Web form                                 |
| **MCPDir.dev**                                  | Web form (open source, 8k+ servers)      |
| **MCPServerHub.net**                            | Web form                                 |
| **MCPServerHub.com**                            | Web form                                 |
| **MCP-Servers-Hub.net**                         | Web form at mcp-servers-hub.net/submit   |
| **AIAgentsList.com**                            | Web form at aiagentslist.com/mcp-servers |
| **APITracker.io**                               | Web form at apitracker.io/mcp-servers    |
| **ClaudeMCP.org**                               | Web form                                 |
| **ClaudeMCP.com**                               | Web form                                 |
| **UBOS.tech**                                   | GitHub PR                                |
| **TensorBlock/awesome-mcp-servers** (471 stars) | GitHub PR                                |

## Other Actions

| Action                     | Status                                                  | Notes                                                                       |
| -------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| **GitHub fork detachment** | Requested via GitHub Support Virtual Agent (2026-02-27) | Detach from PleasePrompto/notebooklm-mcp. Will enable Contributors sidebar. |
| **GitHub notifications**   | Enabled on all 13 public repos                          | Watch → All Activity                                                        |
| **Cline logo**             | Not yet created                                         | 400x400 PNG needed for Cline Marketplace submission                         |

## How to Complete Official MCP Registry

```bash
cd /mnt/d/path/to/notebooklm-mcp

# 1. Login (opens browser for GitHub device flow)
./mcp-publisher login github

# 2. Publish
./mcp-publisher publish

# 3. Verify
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.roomi-fields/notebooklm-mcp"
```

## Files Related to Registry

- `server.json` — Official MCP Registry metadata
- `package.json` — Contains `mcpName: "io.github.roomi-fields/notebooklm-mcp"`
