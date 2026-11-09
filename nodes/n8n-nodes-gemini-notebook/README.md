# n8n-nodes-gemini-notebook

[![npm version](https://img.shields.io/npm/v/n8n-nodes-gemini-notebook.svg)](https://www.npmjs.com/package/n8n-nodes-gemini-notebook)
[![CI](https://github.com/roomi-fields/notebooklm-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/roomi-fields/notebooklm-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An [n8n](https://n8n.io/) community node for **Gemini Notebook** (formerly
NotebookLM): citation-backed answers, passage retrieval, Studio generation —
**all 57 operations**, generated from the server's OpenAPI specification.

## Installation

In n8n: **Settings → Community nodes → Install**, then
`n8n-nodes-gemini-notebook`. Self-hosted n8n only, as with every community node.

## Credentials

One credential, two fields: where the server listens, and the token it asks
for once it is exposed beyond loopback.

```
Base URL    http://127.0.0.1:3000
API Token   (empty on loopback)
```

There is **no Google credential here**, on purpose. The Google session lives in
the server, on the machine it was created on, because it is bound to that
machine and expires server-side while its cookies still look valid. A
credential field cannot hold that, and pretending otherwise is how a workflow
breaks silently a week later.

```bash
npx -y @roomi-fields/notebooklm-mcp                                # the server
npx -y -p @roomi-fields/notebooklm-mcp notebooklm-mcp-setup-auth   # once
```

## Operations

Seven resources, 57 operations, named exactly as the REST API and the MCP tools
name them:

| Resource       | Operations | Examples                                                                      |
| -------------- | ---------- | ----------------------------------------------------------------------------- |
| Question       | 2          | `ask_question`, `batch_to_vault`                                              |
| Notebook       | 21         | `list_notebooks`, `search_passages`, `get_notebook_summary`, `share_notebook` |
| Content        | 15         | `generate_content`, `download_content`, `export_artifact`, `revise_slide`     |
| Source         | 8          | `add_source`, `read_source`, `check_source_freshness`                         |
| Authentication | 4          | `setup_auth`, `re_auth`, `de_auth`, `cleanup_data`                            |
| Session        | 3          | `list_sessions`, `close_session`, `reset_session`                             |
| Health         | 3          | `get_health`, `get_server_info`, `get_utcp_manual`                            |

The node returns the payload, not the envelope: a refused call raises the
server's own explanation as the node's error rather than handing you
`{ success: false }` to test by hand.

## Two things worth knowing

**Citations come back as data.** Set the question's source format to `json` and
`ask_question` returns the quoted passage behind every marker, with its source
name — not markers to parse out of prose.

**Retrieval spends no generation allowance.** `search_passages` returns the
indexed passages matching a query without generating anything. When a workflow
means to reason over the evidence itself, ask for the evidence.

## Documentation

- [Using it from n8n](https://notebooklm.roomi-fields.com/notebooklm-n8n) — the
  workflows, including the webhook-to-answer pattern
- [REST API reference](https://notebooklm.roomi-fields.com/notebooklm-rest-api)
  — the same 57 operations
- [Server documentation](https://notebooklm.roomi-fields.com/)

## License

MIT. See [LICENSE](https://github.com/roomi-fields/notebooklm-mcp/blob/main/LICENSE).

### Contribution

Issues and pull requests go to
[roomi-fields/notebooklm-mcp](https://github.com/roomi-fields/notebooklm-mcp),
which holds the server and this node together. The node is generated: change
`deployment/docs/openapi.yaml` and run `npm run n8n:sync`, never
`nodes/NotebookLm/NotebookLm.node.ts` by hand.
