<div align="center">

# NotebookLM REST API + MCP server

**Automate Google NotebookLM at scale. 45-endpoint HTTP REST API for n8n / Zapier / Make / curl, plus an MCP server for Claude Code / Cursor / Codex. Citation-backed Q&A, full Studio generation (audio · video · infographic · report · presentation · data table), multi-account rotation with auto-reauth across personal and Google Workspace accounts.**

> v4.2.0 — **Node 22 is now the floor, and the last four open advisories are gone with it.** The declared floor of Node 18 had quietly become fiction: three production dependencies already required Node 20 or newer, and the test matrix kept passing on 18 without exercising them. Raising it also let the third-party file globber go — its dependency chain carried four advisories with no fix upstream — replaced by Node's built-in search, now actually under test. Builds on **4.0.0**, where the HTTP API stopped being open to the network and to any web page ([GHSA-p69m-c5rf-g2c3](https://github.com/roomi-fields/notebooklm-mcp/security/advisories/GHSA-p69m-c5rf-g2c3)): it binds loopback, refuses unlisted origins, and takes a bearer token — **remote access and Docker require `NOTEBOOKLM_API_KEY`**, see [Securing the HTTP API](./deployment/docs/15-SECURITY.md). Built on a **dual transport** — the internal `batchexecute` RPC API (10-100× faster than scraping, immune to UI rebrands) with the Playwright browser as an automatic fallback. See the [changelog](./CHANGELOG.md).

> **Note (July 2026):** Google rebranded **NotebookLM** to **Gemini Notebook**. It is the same product, existing links redirect, and this project drives the same underlying service — the browser path was updated for the new DOM in v2.3.0 and the RPC path in v3.0.0. Package and repository keep the `notebooklm` name.

<!-- Badges -->

[![CI](https://github.com/roomi-fields/notebooklm-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/roomi-fields/notebooklm-mcp/actions/workflows/ci.yml) [![npm version](https://badge.fury.io/js/%40roomi-fields%2Fnotebooklm-mcp.svg)](https://www.npmjs.com/package/@roomi-fields/notebooklm-mcp) [![npm downloads](https://img.shields.io/npm/dm/@roomi-fields/notebooklm-mcp.svg)](https://www.npmjs.com/package/@roomi-fields/notebooklm-mcp) [![codecov](https://codecov.io/gh/roomi-fields/notebooklm-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/roomi-fields/notebooklm-mcp) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js->=22-green.svg)](https://nodejs.org/)

[![MCP](https://img.shields.io/badge/MCP-compatible-green.svg)](https://modelcontextprotocol.io/) [![Claude Code](https://img.shields.io/badge/Claude_Code-MCP-8A2BE2)](https://claude.ai/claude-code) [![n8n](https://img.shields.io/badge/n8n-HTTP_API-orange)](./deployment/docs/04-N8N-INTEGRATION.md) [![GitHub](https://img.shields.io/github/stars/roomi-fields/notebooklm-mcp?style=social)](https://github.com/roomi-fields/notebooklm-mcp) [![MCP Toplist](https://mcptoplist.com/badge/io.github.roomi-fields%2Fnotebooklm-mcp.svg)](https://mcptoplist.com/server/io.github.roomi-fields%2Fnotebooklm-mcp)

[![LightNow capabilities](https://lightnow.ai/badge/io.github.roomi-fields/notebooklm-mcp)](https://lightnow.ai/servers/io.github.roomi-fields/notebooklm-mcp)

<!-- End Badges -->

</div>

---

> **Unofficial project — good to know before you start**
>
> This is not affiliated with Google. It talks to the same `batchexecute`
> endpoints the NotebookLM web app uses, with a browser fallback when they move.
> They are undocumented, so they can change without notice — when that happens we
> ship a fix, as we have for every change so far.
>
> Two practical notes: use a **dedicated Google account** for automation, and
> expect NotebookLM's own quotas to apply at high volume. See
> [Disclaimer](#disclaimer) for the full text.

---

## What You Can Build

🔗 **No-code automation pipelines** — The 45-endpoint REST API means NotebookLM becomes a step in n8n, Zapier, Make, or a plain `curl` in cron. No agent, no MCP client, no Node in your stack — just HTTP. This is the half most NotebookLM libraries don't have.

🤖 **Agent tooling** — The same engine over MCP for Claude Code, Cursor and Codex, with a bundled skill that primes the agent on citation formats, the daily-quota-aware batch pattern, and transport selection.

📚 **Research at volume** — Multi-account rotation with automatic re-authentication, built for overnight runs of 1 000+ questions across several notebooks without babysitting.

🎙️ **Full Studio generation** — Audio overviews, video, infographics, reports, presentations, data tables, plus flashcards, quizzes and mind maps — generated and downloaded programmatically.

## Use Cases & Recipes

NotebookLM is a **grounded** engine: Gemini reads your sources and answers _from them_, with citations. The winning pattern is to let it do the expensive reading while your own stack handles orchestration and the last mile.

**Spend fewer tokens — offload the reading**

- **🪙 Zero-token synthesis layer** — Drop 30 documents in a notebook, let Gemini do the heavy analysis, and spend your agent's context only on the final polish. The reasoning happens server-side; your agent just orchestrates (`add_notebook` → `source_add` → `notebook_ask`).
- **💾 Answer cache you can re-read offline** — `vault_batch` writes every answer to disk as structured JSON against a published [schema](https://schemas.roomi-fields.com/nblm-answer-v1.json), so a batch run becomes a corpus you can grep, diff, re-index, or feed to a retrieval layer — without re-querying and re-spending quota.

**Wire it into things that aren't agents**

- **⚙️ NotebookLM as an n8n / Zapier / Make step** — Because it speaks plain HTTP, a citation-backed answer becomes one node in a workflow: a form submission triggers a question, the cited answer lands in a sheet, a Slack message, or a database. No agent runtime involved.
- **📄 Document intake pipeline** — Watch a folder or an inbox, push new PDFs and URLs in as sources, and ask a standing set of questions against them on every arrival.

**Grounded answers with a paper trail**

- **🔍 Citations with the actual source text** — Answers come back with source names _and the quoted excerpts_ they rest on, extracted from the citation panel — so a claim can be checked, not just attributed.
- **🎓 Literature review at thesis scale** — Batch 100+ research questions across multiple notebooks, rotate accounts as daily quotas run out, and resume where it stopped. Built for, and tested on, exactly this.

**Get artifacts back out**

- **🔁 One source set, every format** — Fan a single notebook out to a podcast, a video, a slide deck, a report, a quiz and a mind map, then download them all locally.

---

## In the Wild

Real deployments, not hypotheticals.

- **📚 A doctoral literature review at batch scale** — The project was built for, and is
  continuously tested on, overnight runs of **1 000+ research questions** spread across
  several notebooks: multi-account rotation picks up when a daily quota runs out, every
  answer is written to disk with its citations, and an interrupted run resumes instead of
  starting over. The batch pattern in [`vault_batch`](#features) exists because a thesis
  needed it.

- **🔌 Replacing a RAG engine with the REST API** — [`musnymubarak/Calim_Doc`](https://github.com/musnymubarak/Calim_Doc)
  swapped a Gemini-based retrieval engine for this project's HTTP API, running it as a
  Docker service (`notebooklm:3000`) behind a full client and worker layer. A good
  illustration of the REST half: no agent runtime, no MCP client — NotebookLM simply
  became a backend service their Python app calls.

Built something with it? Open an issue — this section is for other people's work.

## Features

### Q&A with Citations

- **Ask questions** to NotebookLM and get accurate, citation-backed answers
- **Source citation extraction** with 5 formats: none, inline, footnotes, json, expanded (97% excerpt success rate)
- **Session management** for multi-turn conversations with auto-reauth on session expiry

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
| **Flashcards**     | Study cards              | Language, custom instructions                  |
| **Quiz**           | Assessment questions     | Language, custom instructions                  |
| **Mind Map**       | Interactive node graph   | Saved to the notebook                          |

**Video Visual Styles**: classroom, documentary, animated, corporate, cinematic, minimalist

**Language of generated content**: pass `language` to any generator — a BCP-47 code (`es`, `ja`, `pt_BR`, `zh_Hans`) or a name in English or in the language itself (`"Spanish"`, `"Español"`). 81 languages are accepted, and an unrecognised one is refused rather than quietly swapped for another. Set a default with `NOTEBOOKLM_CONTENT_LANGUAGE`; it is deliberately independent of `NOTEBOOKLM_UI_LOCALE`, which only picks the interface language the browser fallback reads.

Flashcards and quizzes are generated via `generate_study_aid`; mind maps via `generate_mind_map`. v3 also adds `share_notebook`, `manage_labels`, and `research_sources` (web/Drive source discovery) — see the [changelog](./CHANGELOG.md).

### Content Download

- **Download Audio** — WAV audio files
- **Download Video** — MP4 video files
- **Download Infographic** — PNG image files
- Text-based content (report, presentation, data_table) is returned in the API response
- **Delete generated content** (`content_delete`) — until now a notebook accumulated every draft anyone ever asked for, with no way to remove one short of the web UI

### Source Management

- **Add sources**: Files (PDF, TXT, DOCX), URLs, Text, YouTube videos, Google Drive
- **List sources**: Every source with its ID and title (`source_list`)
- **Read a source in full** (`source_read`): the exact text NotebookLM indexed — what it actually reasons over, which the web UI only shows in fragments. Quote a source verbatim, check what a PDF really yielded, or hand the raw material to another tool. Name the source instead of its ID if you prefer; an ambiguous name is refused rather than guessed. Long sources arrive **one page at a time**, with an explicit instruction for fetching the next — or `paginate: false` for the whole document at once.

### Notebook Library

- **Multi-notebook management** with validation and smart selection
- **Auto-discovery**: Automatically generate metadata via NotebookLM queries
- **Search notebooks** by keyword in name, description, or topics
- **Scrape notebooks**: List all notebooks from NotebookLM with IDs and names
- **Bulk delete**: Delete multiple notebooks at once

### Accounts & Localization

- **Personal _and_ Google Workspace accounts** — recognizes both NotebookLM hosts (`notebooklm.google.com` and the `notebook.google.com` Workspace alias), so Workspace sessions authenticate cleanly instead of looping on "session expired"
- **UI-language-aware** — drives NotebookLM whether its interface is in English, French, German, or Japanese (`en` · `fr` · `de` · `ja`); [add a language](./docs/ADDING_A_LANGUAGE.md) in a single JSON file

### Integration Options

- **MCP Protocol** — Claude Code, Cursor, Codex, any MCP client
- **Agent Skill** — ships a bundled [`notebooklm` skill](./skills/notebooklm/SKILL.md) (also standalone: [`roomi-fields/notebooklm-skill`](https://github.com/roomi-fields/notebooklm-skill)) that teaches the agent citation formats, the batch-to-cache pattern, and when to use which transport
- **HTTP REST API** — n8n, Zapier, Make.com, custom integrations
- **Docker** — Isolated deployment with Docker or Docker Compose
- **[RTFM](https://github.com/roomi-fields/rtfm) retrieval layer** — `/batch-to-vault` writes citation-backed answers as markdown + JSON sidecars (`nblm-answer-v1` schema), indexable by [RTFM](https://github.com/roomi-fields/rtfm) (FTS5 + semantic) for unlimited offline queries. Ideal for academic / SOTA workflows. [Guide](./deployment/docs/14-RTFM-INTEGRATION.md).

---

## Quick Start

### Option 0 — Claude Code marketplace (one-liner, recommended for Claude Code users)

The fastest way to get NotebookLM into Claude Code. Distributed via the [`roomi-fields/claude-plugins`](https://github.com/roomi-fields/claude-plugins) marketplace alongside [RTFM](https://github.com/roomi-fields/rtfm) (the retrieval companion — see [RTFM integration guide](./deployment/docs/14-RTFM-INTEGRATION.md)):

```text
/plugin marketplace add roomi-fields/claude-plugins
/plugin install notebooklm@roomi-fields
```

That registers the MCP server **and the `notebooklm` agent skill**, runs `npx -y @roomi-fields/notebooklm-mcp@<pinned-version>` automatically (Node ≥ 22 required), and lets you upgrade with two commands when a new release ships: `/plugin marketplace update roomi-fields` then `/reload-plugins`. Then run `npx -y -p @roomi-fields/notebooklm-mcp notebooklm-mcp-setup-auth` once in a terminal to log into Google (a visible Chrome opens). To install RTFM at the same time: `/plugin install rtfm@roomi-fields`.

### Option 1 — HTTP REST API (n8n, Zapier, Make, curl, any HTTP client)

```bash
git clone https://github.com/roomi-fields/notebooklm-mcp.git
cd notebooklm-mcp
npm install && npm run build
npm run setup-auth   # One-time Google login
npm run start:http   # Start REST API on port 3000
```

```bash
# Citation-backed Q&A, single curl, JSON response
curl -X POST http://localhost:3000/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "Summarize chapter 3", "notebook_id": "your-id", "source_format": "json"}'
```

The full surface is **33 documented endpoints** — see the [REST API reference](https://notebooklm.roomi-fields.com/notebooklm-rest-api). For overnight batches of 1 000+ questions, see the [batch pattern](https://notebooklm.roomi-fields.com/batch-1000-questions).

### Option 2 — MCP Mode (Claude Code, Cursor, Codex)

```bash
# Build (same package, MCP transport)
git clone https://github.com/roomi-fields/notebooklm-mcp.git
cd notebooklm-mcp
npm install && npm run build

# Claude Code
claude mcp add notebooklm node /path/to/notebooklm-mcp/dist/index.js

# Cursor — add to ~/.cursor/mcp.json
{
  "mcpServers": {
    "notebooklm": {
      "command": "node",
      "args": ["/path/to/notebooklm-mcp/dist/index.js"]
    }
  }
}
```

**Log in once — in a terminal, not through the assistant.** Run the interactive
Google login as a command; a visible Chrome window opens, you sign in, and the
saved session is then reused by the MCP server:

```bash
npm run setup-auth          # from a clone (Option 2 above)
notebooklm-mcp setup-auth   # from a global install (npm i -g @roomi-fields/notebooklm-mcp)
```

Do the login in a terminal rather than by asking the assistant _"log me in"_:
some stdio MCP clients (e.g. Claude Desktop) cap tool-call duration and cut off
the up-to-10-minute interactive login before you can finish signing in (see
[issue #27](https://github.com/roomi-fields/notebooklm-mcp/issues/27)).

### Option 3 — Docker (NAS, server, headless)

```bash
# Build and run
docker build -t notebooklm-mcp .
docker run -d --name notebooklm-mcp -p 3000:3000 -p 6080:6080 -v notebooklm-data:/data notebooklm-mcp

# Authenticate via noVNC
# 1. Open http://localhost:6080/vnc.html
# 2. Run: curl -X POST http://localhost:3000/setup-auth -d '{"show_browser":true}'
# 3. Login to Google in the VNC window
```

See [Docker Guide](./deployment/docs/08-DOCKER.md) for NAS deployment (Synology, QNAP).

---

## Documentation

Full docs site: **<https://notebooklm.roomi-fields.com/>** · [OpenAPI 3.1 spec](./deployment/docs/openapi.yaml)

| Guide                                                                                        | Description                                                                                                                       |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [Installation](./deployment/docs/01-INSTALL.md)                                              | Step-by-step setup for HTTP and MCP modes                                                                                         |
| [Configuration](./deployment/docs/02-CONFIGURATION.md)                                       | Environment variables and security                                                                                                |
| [REST API reference](./deployment/docs/03-API.md)                                            | Complete HTTP endpoint documentation (45 endpoints)                                                                               |
| [Run 1 000 questions overnight](./deployment/docs/12-BATCH-1000.md)                          | Production batch pattern with auto-reauth and rotation                                                                            |
| [**RTFM integration — cache as searchable vault**](./deployment/docs/14-RTFM-INTEGRATION.md) | Pipeline pattern: NotebookLM as one-shot ingestion, RTFM as retrieval layer. `/batch-to-vault` endpoint, `nblm-answer-v1` schema. |
| [n8n integration](./deployment/docs/04-N8N-INTEGRATION.md)                                   | Workflow automation setup                                                                                                         |
| [Troubleshooting](./deployment/docs/05-TROUBLESHOOTING.md)                                   | Common issues and solutions                                                                                                       |
| [Notebook library](./deployment/docs/06-NOTEBOOK-LIBRARY.md)                                 | Multi-notebook management                                                                                                         |
| [Auto-discovery](./deployment/docs/07-AUTO-DISCOVERY.md)                                     | Autonomous metadata generation                                                                                                    |
| [Content management](./deployment/docs/10-CONTENT-MANAGEMENT.md)                             | Audio, video, infographic, report, presentation                                                                                   |
| [Multi-account rotation](./deployment/docs/11-MULTI-ACCOUNT.md)                              | Multiple accounts with TOTP auto-reauth                                                                                           |
| [Docker](./deployment/docs/08-DOCKER.md)                                                     | Docker and Docker Compose deployment                                                                                              |
| [Multi-interface](./deployment/docs/09-MULTI-INTERFACE.md)                                   | Run Claude Desktop + HTTP simultaneously                                                                                          |
| [**Compare with PleasePrompto v2.0.0**](./deployment/docs/13-COMPARE.md)                     | Feature matrix vs the upstream MCP-only server                                                                                    |
| [Chrome profile limitation](./docs/CHROME_PROFILE_LIMITATION.md)                             | Profile locking (solved in v1.3.6+)                                                                                               |
| [Adding a language](./docs/ADDING_A_LANGUAGE.md)                                             | i18n system for multilingual UI support                                                                                           |

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for planned features and version history.

**Latest releases:**

- **v3.0.1** — Interactive Google login as a first-class CLI command (`notebooklm-mcp setup-auth`) for global / stdio-client installs; `setup_auth` / `re_auth` accept a top-level `headless` (#27)
- **v3.0.0** — Major refactor: **dual transport** (NotebookLM's internal `batchexecute` RPC API with automatic DOM fallback), 10-100× faster and immune to UI rebrands; **5 new tools** (notebook sharing, study aids, mind maps, source labels, web research)
- **v2.3.0** — Full support for Google's **"Gemini Notebook" rebrand**: create / list / rename / delete, sources, and every Studio generation type re-verified end-to-end (#23, #21)
- **v2.2.1** — Recognize both NotebookLM hosts so **Google Workspace** accounts authenticate (the `notebook.google.com` alias); notebook listing no longer wastes ~30s after the "Gemini Notebook" rebrand; HTTP banner reads the real version. Diagnosis + patch by @kpietkaa (#19)
- **v2.2.0** — Fix new-answer detection timing out when an answer repeats an earlier one (position-based identity, not text-hash); graceful shutdown on stdio disconnect; **Japanese** UI locale
- **v2.1.1** — Thai UI selectors for `notebook_create` (partial, #18)
- **v2.1.0** — `note_list` and `note_get` MCP tools (#17)
- **v2.0.4** — German UI selectors (closes #14)
- **v2.0.0** — Tools renamed to a namespaced tree (`notebook_ask`, `source_add`, `session_list`, `server_health`, `vault_batch`…) across 9 namespaces; `tools/list` advertises only the canonical names. **Backward compatible — the legacy flat names still work as aliases**, so existing scripts and configs keep running. Also adds MCP `annotations` (read-only / destructive / idempotent / open-world hints) and `outputSchema` + `structuredContent` on every tool. Published on the [Smithery registry](https://smithery.ai/servers/roomifields/notebooklm-mcp).
- **v1.7.0** — `batch_to_vault` exposed as a first-class MCP tool (parity with the HTTP endpoint, no localhost server required); shared `runBatchToVault` helper deduplicates the loop across both transports
- **v1.6.0** — `/batch-to-vault` endpoint + RTFM integration (`nblm-answer-v1` JSON Schema published at [schemas.roomi-fields.com/nblm-answer-v1.json](https://schemas.roomi-fields.com/nblm-answer-v1.json)) for caching NotebookLM answers as a searchable markdown vault
- **v1.5.8** — NotebookLM 2026 UI adaptations (icon-label sanitization, Discussion-panel recovery, count-based source detection) — PR #5 by @KhizarJamshaidIqbal
- **v1.5.7** — Citation extraction selector fix (`.highlighted`) and Docker multi-stage build — PR #1 by @JulienCANTONI
- **v1.5.6** — Citation extraction major rewrite (97% success rate), browser-verified auth at startup, profile auto-sync
- **v1.5.0** — Complete Studio content generation (video, infographic, presentation, data_table) + Notes management + Delete sources
- **v1.4.0** — Content management (sources, audio, generation) + Multi-account

_Intermediate patch and hardening releases (1.5.x–1.7.x) are in the full [CHANGELOG](./CHANGELOG.md)._

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

## Acknowledgments

Thanks to everyone who has contributed code, ideas, and bug reports:

- **Khizar Jamshaid Iqbal** — [@KhizarJamshaidIqbal](https://github.com/KhizarJamshaidIqbal), 2025 UI selector fixes, doctor script, PII scrub
- **Kazik Pietka** — [@kpietkaa](https://github.com/kpietkaa), `notebook.google.com` rebrand support
- **Rui Ruiberriz** — [@Excauboi](https://github.com/Excauboi), `hl=<uiLocale>` on app URLs + click-through scrape fallback
- **[@he0xwhale](https://github.com/he0xwhale)** — `note_list` / `note_get` MCP tools
- **[@eminsnow](https://github.com/eminsnow)** — canonical tool names (`_` over `.`)
- **Julien Cantoni** — [@JulienCANTONI](https://github.com/JulienCANTONI)

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
