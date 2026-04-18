# NotebookLM MCP Documentation

> AI-first installation, verification, and deployment docs for MCP and HTTP usage

---

## Start Here

Use this order if you are an AI agent or working with one:

1. [**00-AI-ONBOARDING.md**](./00-AI-ONBOARDING.md) - canonical AI-first install flow
2. [**01-INSTALL.md**](./01-INSTALL.md) - local source installation
3. [**05-TROUBLESHOOTING.md**](./05-TROUBLESHOOTING.md) - failure signatures and fixes

Recommended default:

- local source install first
- manual Google auth is required
- verify with `npm run doctor:basic` and `npm run doctor:http`

---

## Complete Documentation

| Document | Description | For whom? |
| --- | --- | --- |
| [**00-AI-ONBOARDING.md**](./00-AI-ONBOARDING.md) | AI-first install, auth, MCP registration | AI agents, operators |
| [**01-INSTALL.md**](./01-INSTALL.md) | Local source installation from scratch | First installation |
| [**02-CONFIGURATION.md**](./02-CONFIGURATION.md) | Environment variables, `.env`, and deployment config | Advanced configuration |
| [**03-API.md**](./03-API.md) | Complete REST API reference | Developers, integration |
| [**04-N8N-INTEGRATION.md**](./04-N8N-INTEGRATION.md) | Integration guide with n8n | n8n users |
| [**05-TROUBLESHOOTING.md**](./05-TROUBLESHOOTING.md) | Failure signatures and fixes | Debugging, errors |
| [**06-NOTEBOOK-LIBRARY.md**](./06-NOTEBOOK-LIBRARY.md) | Multi-notebook library management | Notebook management |
| [**07-AUTO-DISCOVERY.md**](./07-AUTO-DISCOVERY.md) | Autonomous resource discovery pattern | Auto-discovery |
| [**08-DOCKER.md**](./08-DOCKER.md) | Docker deployment with noVNC | Docker, NAS users |
| [**08-WSL-USAGE.md**](./08-WSL-USAGE.md) | WSL setup and operating notes | Windows + WSL users |
| [**09-MULTI-INTERFACE.md**](./09-MULTI-INTERFACE.md) | Run MCP and HTTP together | Mixed-interface users |
| [**10-CONTENT-MANAGEMENT.md**](./10-CONTENT-MANAGEMENT.md) | Studio and source workflows | Content operations |
| [**11-MULTI-ACCOUNT.md**](./11-MULTI-ACCOUNT.md) | Multi-account management and rotation | Rate limit handling |
| [**Test Scripts**](../scripts/README.md) | PowerShell validation scripts | Testing, CI/CD |

---

## Guides By Use Case

### I am getting started

1. [AI onboarding](./00-AI-ONBOARDING.md) - follow the golden path
2. [Installation](./01-INSTALL.md) - install Node.js, build, authenticate
3. [Notebook library](./06-NOTEBOOK-LIBRARY.md) - add your first notebook
4. [Troubleshooting](./05-TROUBLESHOOTING.md) - use the doctor checks if anything fails

### I am integrating with n8n

1. [Installation](./01-INSTALL.md)
2. [Configuration](./02-CONFIGURATION.md)
3. [n8n integration](./04-N8N-INTEGRATION.md)

### I have a problem

1. [Troubleshooting](./05-TROUBLESHOOTING.md)
2. [Configuration](./02-CONFIGURATION.md)
3. [AI onboarding](./00-AI-ONBOARDING.md#common-failure-signatures)

### I want to test my installation

1. [AI onboarding](./00-AI-ONBOARDING.md#verification-sequence)
2. [Troubleshooting](./05-TROUBLESHOOTING.md#quick-diagnosis)
3. [Test scripts](../scripts/README.md)

### I want to manage multiple notebooks

1. [Notebook library](./06-NOTEBOOK-LIBRARY.md)
2. [API reference](./03-API.md)

### I want Docker or WSL

1. [Docker guide](./08-DOCKER.md)
2. [WSL guide](./08-WSL-USAGE.md)

---

## Quick Reference

### Main Commands

| Command | Description |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run build` | Compile TypeScript |
| `npm run setup-auth` | Launch the manual Google auth flow |
| `npm run doctor:basic` | Verify repo/build prerequisites |
| `npm run start:http` | Start the local HTTP server |
| `npm run doctor:http` | Verify `/health` on the local HTTP server |

### Main Endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/health` | `GET` | Check server status |
| `/ask` | `POST` | Ask a question to NotebookLM |
| `/notebooks` | `GET` / `POST` | List or add notebooks |
| `/content` | `GET` | List notebook sources and generated content |
| `/content/sources` | `POST` / `DELETE` | Add or remove notebook sources |

---

## Need Help?

- [05-TROUBLESHOOTING.md](./05-TROUBLESHOOTING.md)
- [GitHub Issues](https://github.com/roomi-fields/notebooklm-mcp/issues)
