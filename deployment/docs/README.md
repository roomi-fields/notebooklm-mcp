# NotebookLM MCP HTTP Server Documentation

> Complete documentation for the NotebookLM HTTP server

---

## 🚀 Quick Start

**New to the project?** Start with the installation guide:

👉 [**01-INSTALL.md**](./01-INSTALL.md) — Complete installation from scratch (Windows)

---

## 📚 Complete Documentation

| Document | Description | For whom? |
|----------|-------------|-----------|
| [**01-INSTALL.md**](./01-INSTALL.md) | Complete installation guide from scratch | First installation |
| [**02-CONFIGURATION.md**](./02-CONFIGURATION.md) | Environment variables, security, deployment | Advanced configuration |
| [**03-API.md**](./03-API.md) | Complete REST API reference | Developers, integration |
| [**04-N8N-INTEGRATION.md**](./04-N8N-INTEGRATION.md) | Integration guide with n8n | n8n users |
| [**05-TROUBLESHOOTING.md**](./05-TROUBLESHOOTING.md) | Solutions to common problems | Debugging, errors |
| [**06-NOTEBOOK-LIBRARY.md**](./06-NOTEBOOK-LIBRARY.md) | Multi-notebook library management | Notebook management |
| [**07-AUTO-DISCOVERY.md**](./07-AUTO-DISCOVERY.md) | Autonomous resource discovery pattern | Auto-discovery feature |
| [**Test Scripts**](../scripts/README.md) | PowerShell validation scripts | Testing, CI/CD |

---

## 🎯 Guides by Use Case

### I'm getting started

1. [Installation](./01-INSTALL.md) — Install Node.js, compile, authenticate
2. [Notebook configuration](./06-NOTEBOOK-LIBRARY.md#-guide-de-d%C3%A9marrage) — Add your first notebook
3. [Testing](./01-INSTALL.md#-v%C3%A9rification) — Verify everything works

### I'm integrating with n8n

1. [Installation](./01-INSTALL.md)
2. [Network configuration](./02-CONFIGURATION.md#-s%C3%A9curit%C3%A9)
3. [n8n integration](./04-N8N-INTEGRATION.md)

### I have a problem

1. [Troubleshooting](./05-TROUBLESHOOTING.md) — Common problems and solutions
2. [Configuration](./02-CONFIGURATION.md#-troubleshooting-configuration) — Configuration issues

### I want to manage multiple notebooks

1. [Notebook library](./06-NOTEBOOK-LIBRARY.md) — Complete guide
2. [Notebooks API](./03-API.md#5-add-notebook) — Management endpoints

### I want to test my installation

1. [Test scripts](../scripts/README.md) — Automated tests
2. [Quick test](../scripts/README.md#-test-serverps1) — Validation in 30 seconds
3. [Complete tests](../scripts/README.md#-test-apips1) — Full suite (10 tests)

---

## 📖 Quick Reference

### Main Endpoints

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/health` | GET | Check server status |
| `/ask` | POST | Ask a question to NotebookLM |
| `/notebooks` | GET | List notebooks |
| `/notebooks` | POST | Add a notebook (with validation) |
| `/notebooks/auto-discover` | POST | Auto-generate notebook metadata |
| `/notebooks/:id` | DELETE | Delete a notebook |
| `/notebooks/:id/activate` | PUT | Activate a notebook |

**👉 [Complete API reference](./03-API.md)**

### Useful Scripts

| Command | Description |
|----------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run start:http` | Start HTTP server (foreground) |
| `npm run daemon:start` | Start server in background (daemon mode) |
| `npm run daemon:stop` | Stop background server |
| `npm run daemon:logs` | View background server logs |
| `npm run daemon:status` | Check daemon status |
| `npm run dev:http` | Development mode (auto-reload) |
| `npm run setup-auth` | Configure Google authentication |
| `.\deployment\scripts\setup-auth.ps1` | PowerShell authentication script |
| `.\deployment\scripts\test-server.ps1` | Quick tests (3 tests, 30s) |
| `.\deployment\scripts\test-api.ps1` | Complete tests (10 tests, 5-10min) |
| `.\deployment\scripts\test-errors.ps1` | Error case tests (12 tests) |

### Important Files

| File | Location | Description |
|---------|-------------|-------------|
| `state.json` | `%LOCALAPPDATA%\notebooklm-mcp\Data\browser_state\` | Authentication state |
| `Cookies` | `%LOCALAPPDATA%\notebooklm-mcp\Data\chrome_profile\Default\` | Google cookies |
| `library.json` | `%LOCALAPPDATA%\notebooklm-mcp\Data\` | Notebook library |

---

## 🆘 Need Help?

### Common Problems

**Server won't start**
→ [Troubleshooting - EADDRINUSE](./05-TROUBLESHOOTING.md#probl%C3%A8me-eaddrinuse-address-already-in-use)

**Authentication fails**
→ [Troubleshooting - Authentication](./05-TROUBLESHOOTING.md#probl%C3%A8me-authentication-failed)

**Invalid notebook**
→ [Notebook Library - Validation](./06-NOTEBOOK-LIBRARY.md#-validations-automatiques)

**n8n cannot connect**
→ [Configuration - Firewall](./02-CONFIGURATION.md#2-firewall-windows)

### External Documentation

- [NotebookLM](https://notebooklm.google.com) — Official Google service
- [n8n](https://n8n.io) — Automation platform
- [Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright) — Stealth browser automation
- [Model Context Protocol](https://modelcontextprotocol.io/) — MCP specification

---

## 🔄 Changelog

### v1.3.1 (2025-01-24)

**New features:**
- ✅ MCP Auto-Discovery Tool: `auto_discover_notebook` for Claude Desktop/Cursor
- ✅ Parity with HTTP API: MCP clients now have auto-discovery capability
- ✅ Zero-friction notebook addition: just URL, metadata auto-generated

**Critical Fixes:**
- ✅ Claude Desktop compatibility: Disabled `CompleteRequestSchema` handler
- ✅ Fixed "Server does not support completions" error on connection

**Documentation:**
- ✅ Added [CHROME_PROFILE_LIMITATION.md](../../docs/CHROME_PROFILE_LIMITATION.md) documenting HTTP/stdio conflict
- ✅ Documented workaround for Chrome profile locking
- ✅ Added v1.4.0 roadmap for separate Chrome profiles
- ✅ Updated tool documentation to recommend auto-discovery first

### v1.1.2 (2025-11-22)

**New features:**
- ✅ Multi-notebook library system
- ✅ Live validation of notebooks when adding
- ✅ Protection against duplicate names
- ✅ DELETE and PUT endpoints for notebooks
- ✅ Detailed and contextualized error messages

**Fixes:**
- ✅ Fixed Cookies path (Default/Network/Cookies)
- ✅ Cookies threshold lowered to 10KB
- ✅ Better temporary session management

**Documentation:**
- ✅ New guide [06-NOTEBOOK-LIBRARY.md](./06-NOTEBOOK-LIBRARY.md)
- ✅ "Notebook Configuration" section in [01-INSTALL.md](./01-INSTALL.md)
- ✅ Enhanced API in [03-API.md](./03-API.md)

---

## 📝 Contributing

Found an error in the documentation? An unclear section?

**Open an issue:** [GitHub Issues](https://github.com/roomi-fields/notebooklm-mcp/issues)

Or directly propose a PR to improve the documentation!

---

**Documentation updated:** 2025-01-23
**Version:** 1.3.4
