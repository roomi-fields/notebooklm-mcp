<div align="center">

# NotebookLM MCP Server

> **Forked from** [PleasePrompto/notebooklm-mcp](https://github.com/PleasePrompto/notebooklm-mcp)

**Full automation of Google NotebookLM: Q&A, audio podcasts, and source management**

<!-- Badges -->

[![CI](https://github.com/roomi-fields/notebooklm-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/roomi-fields/notebooklm-mcp/actions/workflows/ci.yml) [![npm version](https://badge.fury.io/js/%40roomi-fields%2Fnotebooklm-mcp.svg)](https://www.npmjs.com/package/@roomi-fields/notebooklm-mcp) [![npm downloads](https://img.shields.io/npm/dm/@roomi-fields/notebooklm-mcp.svg)](https://www.npmjs.com/package/@roomi-fields/notebooklm-mcp) [![codecov](https://codecov.io/gh/roomi-fields/notebooklm-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/roomi-fields/notebooklm-mcp) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js->=18-green.svg)](https://nodejs.org/)

[![MCP](https://img.shields.io/badge/MCP-2025-green.svg)](https://modelcontextprotocol.io/) [![Claude Code](https://img.shields.io/badge/Claude_Code-MCP-8A2BE2)](https://claude.ai/claude-code) [![n8n](https://img.shields.io/badge/n8n-HTTP_API-orange)](./deployment/docs/04-N8N-INTEGRATION.md) [![GitHub](https://img.shields.io/github/stars/roomi-fields/notebooklm-mcp?style=social)](https://github.com/roomi-fields/notebooklm-mcp)

<!-- End Badges -->

</div>

---

## Features

### Q&A with Citations

- **Ask questions** to NotebookLM and get accurate, citation-backed answers
- **Source citation extraction** with 5 formats: none, inline, footnotes, json, expanded
- **Session management** for multi-turn conversations

### Content Generation

Generate multiple content types from your notebook sources:

| Content Type       | Formats                  | Options                                        |
| ------------------ | ------------------------ | ---------------------------------------------- |
| **Audio Overview** | Podcast-style discussion | Language (80+), custom instructions            |
| **Video**          | Brief, Explainer         | 6 visual styles, language, custom instructions |
| **Infographic**    | Horizontal, Vertical     | Language, custom instructions                  |
| **Report**         | Summary, Detailed        | Language, custom instructions                  |
| **Presentation**   | Overview, Detailed       | Language, custom instructions                  |
| **Data Table**     | Simple, Detailed         | Language, custom instructions                  |

**Video Visual Styles**: classroom, documentary, animated, corporate, cinematic, minimalist

### Content Download

- **Download Audio** — WAV audio files
- **Download Video** — MP4 video files
- **Download Infographic** — PNG image files
- Text-based content (report, presentation, data_table) is returned in the API response

### Source Management

- **Add sources**: Files (PDF, TXT, DOCX), URLs, Text, YouTube videos, Google Drive
- **List sources**: View all sources in a notebook

### Notebook Library

- **Multi-notebook management** with validation and smart selection
- **Auto-discovery**: Automatically generate metadata via NotebookLM queries
- **Search notebooks** by keyword in name, description, or topics

### Integration Options

- **MCP Protocol** — Claude Code, Cursor, Codex, any MCP client
- **HTTP REST API** — n8n, Zapier, Make.com, custom integrations

---

## Quick Start

> ⚠️ **npm registry temporarily unavailable** - Install from GitHub instead (see below)

### Option 1: MCP Mode (Claude Code, Cursor, Codex)

```bash
# Clone and build locally
git clone https://github.com/roomi-fields/notebooklm-mcp.git
cd notebooklm-mcp
npm install && npm run build

# Claude Code
claude mcp add notebooklm node /path/to/notebooklm-mcp/dist/index.js

# Cursor - add to ~/.cursor/mcp.json
{
  "mcpServers": {
    "notebooklm": {
      "command": "node",
      "args": ["/path/to/notebooklm-mcp/dist/index.js"]
    }
  }
}
```

Then say: _"Log me in to NotebookLM"_ → Chrome opens → log in with Google.

### Option 2: HTTP REST API (n8n, Zapier, Make.com)

```bash
git clone https://github.com/roomi-fields/notebooklm-mcp.git
cd notebooklm-mcp
npm install && npm run build
npm run setup-auth   # One-time Google login
npm run start:http   # Start server on port 3000
```

```bash
# Query the API
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Explain X", "notebook_id": "my-notebook"}'
```

---

## Documentation

| Guide                                                        | Description                               |
| ------------------------------------------------------------ | ----------------------------------------- |
| [Installation](./deployment/docs/01-INSTALL.md)              | Step-by-step setup for HTTP and MCP modes |
| [Configuration](./deployment/docs/02-CONFIGURATION.md)       | Environment variables and security        |
| [API Reference](./deployment/docs/03-API.md)                 | Complete HTTP endpoint documentation      |
| [n8n Integration](./deployment/docs/04-N8N-INTEGRATION.md)   | Workflow automation setup                 |
| [Troubleshooting](./deployment/docs/05-TROUBLESHOOTING.md)   | Common issues and solutions               |
| [Notebook Library](./deployment/docs/06-NOTEBOOK-LIBRARY.md) | Multi-notebook management                 |
| [Auto-Discovery](./deployment/docs/07-AUTO-DISCOVERY.md)     | Autonomous metadata generation            |
| [Multi-Interface](./deployment/docs/09-MULTI-INTERFACE.md)   | Run Claude Desktop + HTTP simultaneously  |
| [Chrome Limitation](./docs/CHROME_PROFILE_LIMITATION.md)     | Profile locking (solved in v1.3.6+)       |

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for planned features and version history.

**Latest releases:**

- **v1.5.0** — Complete Studio content generation (video, infographic, presentation, data_table) + Notes management + Delete sources
- **v1.4.0** — Content management (sources, audio, generation) + Multi-account
- **v1.3.7** — Source citation extraction (5 formats)

**Not yet implemented:**

- Discover sources (Web/Drive search with Fast/Deep modes)
- Edit notes (create, delete, and convert are implemented)

---

## Disclaimer

This tool automates browser interactions with NotebookLM. Use a dedicated Google account for automation. CLI tools like Claude Code can make mistakes — always review changes before deploying.

See full [Disclaimer](#disclaimer-details) below.

---

## Contributing

Found a bug? Have an idea? [Open an issue](https://github.com/roomi-fields/notebooklm-mcp/issues) or submit a PR!

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT — Use freely in your projects. See [LICENSE](./LICENSE).

## Author

**Romain Peyrichou** — [@roomi-fields](https://github.com/roomi-fields)

---

<details>
<summary><a name="disclaimer-details"></a>Full Disclaimer</summary>

**About browser automation:**
While I've built in humanization features (realistic typing speeds, natural delays, mouse movements), I can't guarantee Google won't detect or flag automated usage. Use a dedicated Google account for automation.

**About CLI tools and AI agents:**
CLI tools like Claude Code, Codex, and similar AI-powered assistants are powerful but can make mistakes:

- Always review changes before committing or deploying
- Test in safe environments first
- Keep backups of important work
- AI agents are assistants, not infallible oracles

I built this tool for myself and share it hoping it helps others, but I can't take responsibility for any issues that might occur. Use at your own discretion.

</details>

---

<div align="center">

Built with frustration about hallucinated APIs, powered by Google's NotebookLM

⭐ [Star on GitHub](https://github.com/roomi-fields/notebooklm-mcp) if this saves you debugging time!

</div>
