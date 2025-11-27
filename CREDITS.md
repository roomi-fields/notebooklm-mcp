# Credits

This project is the result of collaboration between human creators and AI tools.

---

## Original Project

**NotebookLM MCP Server**

- **Author:** Gérôme Dexheimer (Please Prompto!)
- **GitHub:** [@PleasePrompto](https://github.com/PleasePrompto)
- **Repository:** [notebooklm-mcp](https://github.com/PleasePrompto/notebooklm-mcp)
- **License:** MIT
- **Date:** January 2025

**Original contributions:**

- MCP server architecture with stdio protocol
- Persistent Google authentication
- Browser session management with Playwright/Patchright
- Notebook library
- Stealth anti-detection mode
- Streaming detection with stability

**Special thanks:**

- The Anthropic team for the MCP SDK
- The Playwright/Patchright community
- All contributors to the original project

---

## HTTP REST API Wrapper

**Creator:** Romain Peyrichou

**Developed with Claude Code**

- **Tool:** [Claude Code](https://claude.com/claude-code) (Anthropic)
- **Model:** Claude Sonnet 4.5
- **Version:** claude-sonnet-4-5-20250929
- **Date:** January 21, 2025

**HTTP Wrapper Contributions:**

### Architecture & Development

- HTTP REST API server design (Express.js)
- Wrapper around existing MCP tools
- Network configuration (0.0.0.0 binding)
- CORS management for third-party integrations
- 8 complete REST endpoints

### Critical Bug Fixes

**1. Windows Authentication Persistence**

- Diagnosis: chrome_profile/ remained empty
- Analysis: Asynchronous Windows filesystem delay
- Solution: Added 5-second delay before closing Chrome
- File: `src/auth/auth-manager.ts:966`

**2. Streaming Detection Reliability**

- Diagnosis: Placeholders returned as final answers
- Analysis: Too low stability threshold + missing NotebookLM placeholders
- Solution: Added placeholders + increased threshold to 8 polls
- File: `src/utils/page-utils.ts:51,210`

**3. System Text in Responses**

- Diagnosis: "EXTREMELY IMPORTANT..." in every response
- Analysis: Text added after cleaning
- Solution: Removed FOLLOW_UP_REMINDER
- File: `src/tools/index.ts:30,791`

### Complete Documentation

**5 Detailed Guides:**

1. Installation guide (01-INSTALL.md)
2. Configuration guide (02-CONFIGURATION.md)
3. API reference (03-API.md)
4. n8n integration (04-N8N-INTEGRATION.md)
5. Troubleshooting guide (05-TROUBLESHOOTING.md)

**Additional Files:**

- Main package README
- Quick start guide (QUICK-START.md)
- Navigation index (INDEX.md)
- Deployment file list (PACKAGE-FILES.txt)

### Automation Scripts

**4 PowerShell Scripts:**

- Automated installation (install.ps1)
- Startup with checks (start-server.ps1)
- Clean shutdown (stop-server.ps1)
- Validation tests (test-server.ps1)

**Features:**

- Color codes and formatting
- Prerequisite checks
- Robust error handling
- Informative logs

### Deployment Package

- Clean directory structure (`deployment/`)
- Code/documentation separation
- Ready for Git/npm distribution
- Runtime files isolation (Data/)

---

## Technologies Used

### Backend

- **Node.js** (v20+) - JavaScript runtime
- **TypeScript** (v5.3+) - Static typing
- **Express.js** (v4.18+) - HTTP server
- **Patchright** (v1.48+) - Browser automation (Playwright fork)
- **@modelcontextprotocol/sdk** (v1.0+) - Anthropic MCP SDK

### Development

- **tsx** - TypeScript execution
- **dotenv** - Environment configuration
- **CORS** - Cross-origin requests

### Tools

- **PowerShell** - Windows automation scripts
- **curl** - HTTP testing
- **Git** - Version control

---

## Supported Platforms

**Operating System:**

- ✅ **Windows 10/11** (64-bit) - Fully supported and tested
- ⚠️ **Linux/macOS** - Experimental support
  - File paths use `env-paths` for cross-platform compatibility
  - Session storage uses `%LOCALAPPDATA%` (Windows) or system equivalents
  - Google authentication requires Chrome/Chromium installed
  - **Note:** Community testing welcome for full validation

**Verified Integrations:**

- ✅ n8n via HTTP Request nodes
- ✅ Claude Code (MCP stdio)
- ✅ curl (command line)
- ✅ PowerShell scripts (Windows)

**Documented n8n Workflows:**

1. Webhook → NotebookLM → Response
2. Schedule → NotebookLM → Email
3. Slack Mention → NotebookLM → Slack Reply

---

## Project Philosophy

### Human-AI Collaborative Approach

This project illustrates productive collaboration between:

- **Human vision:** Direction, objectives, validation
- **AI execution:** Implementation, documentation, debugging

**Methodology:**

1. **Rapid iteration:** Test → Feedback → Fix
2. **Transparency:** All bugs and fixes documented
3. **Quality:** Exhaustive manual testing at each step
4. **Documentation:** Guide for every project aspect

### Values

- **Open Source:** Free code under MIT license
- **Attribution:** Clear credits for human and AI contributors
- **Community:** Accessible documentation for all levels
- **Reliability:** Critical bugs fixed before publication

---

## Acknowledgments

**To the Anthropic team:**

- For Claude Code and Claude Sonnet 4.5
- For the MCP SDK and its ecosystem
- For making this collaboration possible

**To Please Prompto! (Gérôme Dexheimer):**

- For the quality original project
- For the MIT license allowing this extension
- For the solid architecture to build upon

**To the community:**

- All future contributors
- Users who will test and report bugs
- Creators of innovative n8n workflows

---

## License

**Original Project:** MIT License © 2025 Please Prompto!
**HTTP Wrapper:** MIT License © 2025 (Developed with Claude Code - Anthropic Claude Sonnet 4.5)

See [LICENSE](./LICENSE) for complete details.

---

## Contact & Contributions

- **Issues:** [GitHub Issues](https://github.com/roomi-fields/notebooklm-mcp/issues)
- **Discussions:** [GitHub Discussions](https://github.com/roomi-fields/notebooklm-mcp/discussions)
- **Contributions:** See [CONTRIBUTING.md](./CONTRIBUTING.md)

---

**Built with passion for the open source community** 🚀

_This credits file reflects our commitment to transparency about human and AI contributions._
