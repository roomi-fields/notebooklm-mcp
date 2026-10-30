---
name: notebooklm
description: This skill should be used when the user wants to query their Google NotebookLM notebooks for citation-backed, source-grounded answers, or manage notebooks, sources, and Studio content (audio, report, video, infographic, presentation, data table, flashcards, quiz, mind map). It drives the @roomi-fields/notebooklm-mcp engine — via the notebooklm MCP tools when they are available in the session, otherwise via its HTTP REST API — and covers Google login, citation formats, the daily-quota-aware batch/ingestion pattern, and source discovery.
---

# NotebookLM

## Overview

NotebookLM answers questions **only from the sources uploaded to a notebook**,
with inline citations to the exact passages used — no open-web knowledge, so
answers are hallucination-resistant and fully traceable. This skill drives the
`@roomi-fields/notebooklm-mcp` engine to query notebooks, manage sources, and
generate Studio content, and encodes the patterns that make NotebookLM usable at
research scale (citation formats, the ~50-queries/day quota, batch-to-cache).

## Choosing the transport

Two ways reach the same engine — pick per what the session already has:

1. **notebooklm MCP tools** — if tools such as `notebook_ask` / `source_add` /
   `server_health` (or `mcp__notebooklm__*`) are available in the session, call
   them directly. This is the preferred path and needs no server.
2. **HTTP REST API** — otherwise, use the bundled `scripts/nblm.sh`, which talks
   to a running NotebookLM MCP server (default `http://localhost:3000`,
   override with `NOTEBOOKLM_SERVER_URL`). If no server is reachable, ask the
   user to start one (`npm run start:http` from a clone) or to install the MCP.

Both are backed by the same account and session, so the choice is purely about
which is already wired up.

## Prerequisite: one Google login

NotebookLM needs a signed-in Google session (saved once, reused across runs).
Verify with `nblm.sh health` (or the `server_health` tool) — look for
`authenticated: true`. If not authenticated, run the interactive login **in a
terminal** (a visible Chrome window opens):

```bash
notebooklm-mcp-setup-auth          # global install
# or:  scripts/nblm.sh auth
```

Run the login in a terminal rather than through an in-client tool: interactive
Google login can take minutes and a stdio client's tool-call timeout may cut it
off.

## Core tasks

Use `scripts/nblm.sh` for the REST path (or the equivalent MCP tool):

```bash
scripts/nblm.sh health                       # reachability + auth status
scripts/nblm.sh notebooks                     # list notebooks (id + name)
scripts/nblm.sh ask "<question>" <notebook_id>   # citation-backed answer (JSON citations)
scripts/nblm.sh search "<query>" <notebook_id> [limit]  # ranked passages, no answer, no quota
scripts/nblm.sh generate <notebook_id> report   # audio|report|video|infographic|presentation|data_table|flashcards|quiz|mind_map
```

- **Search before you ask.** `search` returns the indexed passages matching a
  query, ranked best first, and **spends no chat quota** because nothing is
  generated. When you intend to reason over the evidence yourself, it is both
  cheaper and faster than asking. Rank is global across sources and lower is
  better; `start`/`end` are offsets into that source's full text, and are null
  when the server gave none.
- **Ask**: the script requests `source_format: json`, so the answer carries
  source names + cited excerpts. For a human-facing answer, prefer `expanded`
  (see `references/rest-api.md` to vary the format).
- **Generate**: `flashcards`/`quiz` route to the study-aid endpoint and
  `mind_map` to the mind-map endpoint automatically.

## Working effectively (read before large runs)

For anything beyond a few questions, load `references/research-workflows.md`. Key
points:

- **Quota**: free accounts cap at ~50 chat queries/day. Rotate accounts
  (`/re-auth`) or, better, **ingest once and retrieve offline**.
- **Batch → cache**: for literature reviews / SOTA surveys, run an exhaustive
  question set through `/batch-to-vault` (writes markdown + `nblm-answer-v1` JSON
  sidecars with citations), then answer repeated questions from the cache
  (e.g. with [RTFM](https://github.com/roomi-fields/rtfm)) — unlimited, offline.
- **Fresh vs. follow-up**: omit `session_id` for independent questions (fastest);
  pass a stable one to continue a conversation.

## References

- `references/rest-api.md` — endpoint + body reference for the HTTP path.
- `references/research-workflows.md` — citation formats, quota strategy, the
  batch/ingestion pattern, source discovery.

## Installing the engine

If neither the MCP tools nor a server are present, the engine is the npm package
[`@roomi-fields/notebooklm-mcp`](https://github.com/roomi-fields/notebooklm-mcp)
(also a Claude Code plugin via the `roomi-fields/claude-plugins` marketplace).
Point the user there, then run the one-time login above.
