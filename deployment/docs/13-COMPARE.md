# Migrating from PleasePrompto/notebooklm-mcp

**`PleasePrompto/notebooklm-mcp` was archived on 10 September 2026.** Its
README says so plainly: no updates, no bug fixes, no support, and no further
npm releases. It still works today, and it may keep working for a while — but
it will break the next time Google changes anything, and nobody will fix it.

This page is for its users. It is written by the maintainer of a project that
**grew out of that one**: Gérôme Dexheimer is credited first in our licence,
and 17 of his 19 tool names still work here unchanged. We are not neutral, so
everything below is checkable.

## Is migrating urgent?

No. Nothing breaks on a schedule. The reasons to move are that the upstream
service changes under all of us — it was rebranded in July 2026 and its
internal API shifts without notice — and that an archived repository cannot
absorb that.

## What carries over unchanged

**17 of the 19 tools keep their exact names**, so most agent prompts and
scripts need no edit at all:

`add_notebook` · `add_source` · `ask_question` · `cleanup_data` ·
`close_session` · `get_health` · `get_library_stats` · `get_notebook` ·
`list_notebooks` · `list_sessions` · `re_auth` · `remove_notebook` ·
`reset_session` · `search_notebooks` · `select_notebook` · `setup_auth` ·
`update_notebook`

The two that changed, because this project generates more than audio:

| His tool         | Here                                            |
| ---------------- | ----------------------------------------------- |
| `generate_audio` | `generate_content` with `content_type: "audio"` |
| `download_audio` | `download_content` with `content_type: "audio"` |

## What does NOT carry over

**Read this before you set anything.** One variable exists in both projects
with a different meaning:

| Variable               | His meaning                                 | Our meaning                          |
| ---------------------- | ------------------------------------------- | ------------------------------------ |
| `NOTEBOOKLM_TRANSPORT` | `stdio` or `http` — how the client connects | `rpc` or `dom` — how we reach Google |

Carrying `NOTEBOOKLM_TRANSPORT=http` across will not give you an HTTP server;
use `HTTP_PORT` and run `start:http` instead.

The rest:

| His variable                          | Here                                                           |
| ------------------------------------- | -------------------------------------------------------------- |
| `NOTEBOOKLM_PORT` / `NOTEBOOKLM_HOST` | `HTTP_PORT` / `HTTP_HOST`                                      |
| `NOTEBOOKLM_BROWSER_CHANNEL`          | `BROWSER_CHANNEL`                                              |
| `NOTEBOOKLM_PROFILE` (tool profiles)  | no equivalent — all 53 tools are exposed                       |
| `NOTEBOOKLM_DISABLED_TOOLS`           | no equivalent yet                                              |
| `NOTEBOOKLM_ACCOUNT`                  | a different multi-account system — see the multi-account guide |
| `NOTEBOOKLM_AI_MARKER` / `_PREFIX`    | no equivalent                                                  |
| `NOTEBOOKLM_FOLLOW_UP_REMINDER`       | no equivalent                                                  |

**And one thing he got right that we did not, until recently:** his HTTP mode
bound `127.0.0.1` by default. Ours bound every interface with no credentials
until 4.0.0, which was a real vulnerability
([GHSA-p69m-c5rf-g2c3](https://github.com/roomi-fields/notebooklm-mcp/security/advisories/GHSA-p69m-c5rf-g2c3)).
It is fixed, and exposing the API now requires `NOTEBOOKLM_API_KEY` — see
[Securing the HTTP API](./15-SECURITY.md). You should know that history before
trusting this project with a port.

## Install

```bash
npx @roomi-fields/notebooklm-mcp@latest
```

You will have to log in again: sessions are tied to a browser profile and
cannot be transplanted. Node 22 or newer is required.

---

## Feature comparison

The sections below compare the two projects feature by feature. His column
describes v2.0.0, the last release, frozen since 1 May 2026.

> **TL;DR**
>
> - You want a quick **MCP server** for Claude Code / Cursor / Codex with citations and audio overviews → either works; PleasePrompto v2 is a clean, MCP-spec-first build.
> - You need a **REST API** to call from n8n / Zapier / Make / curl / any non-MCP client → use this project. PleasePrompto v2 ships MCP-over-HTTP (Streamable HTTP transport) which is **not** a REST API.
> - You generate **video / infographic / presentation / data table** from NotebookLM Studio → use this project. PleasePrompto v2 ships audio only, and the follow-up it deferred them to will not come — the project is archived.
> - You run **long batches** (PhD research, market reports, content pipelines) and need **auto-reauth with TOTP** → use this project. PleasePrompto v2 explicitly does not store credentials.
