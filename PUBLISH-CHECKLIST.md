# Publish Checklist

Use this checklist before making the repository public on GitHub.

## Goal

Make sure the public repo is:

- safe to publish
- easy for AI agents to install
- clear for humans to verify
- free of local credentials, notebook URLs, and machine-specific assumptions

## AI Entry Points

These are the first files an AI agent should read:

1. `README.md`
2. `AGENTS.md`
3. `CODEX.md`
4. `CLAUDE.md`
5. `deployment/docs/00-AI-ONBOARDING.md`

Confirm they still describe the same golden path:

1. `npm install`
2. `npm run build`
3. `npm run setup-auth`
4. manual Google login
5. MCP registration
6. verification with doctor scripts

## Do Not Publish

Confirm none of these are tracked or embedded with live values:

- `.env`
- cookies
- browser state
- Chrome profiles
- local auth/session files
- real notebook URLs tied to private work
- machine-specific absolute paths
- local screenshots or debug logs
- plaintext passwords or TOTP secrets

## Pre-Publish Safety Checks

### 1. Ignore rules

Verify `.gitignore` still excludes:

- `.env`
- `Data/`
- browser/session directories
- logs
- local test config

### 2. Placeholder examples only

Spot-check docs and scripts for placeholders such as:

- `/absolute/path/to/notebooklm-mcp`
- `https://notebooklm.google.com/notebook/<your-notebook-id>`
- `http://127.0.0.1:3000`

### 3. MCP config rule

Confirm docs tell agents to provide copy-paste snippets instead of silently editing an existing user MCP config.

### 4. Manual auth is explicit

Confirm the docs clearly state:

- `npm run setup-auth` launches the flow
- a human must finish Google login manually
- the browser must reach NotebookLM before auth is considered complete

## Functional Checks

Run these from the repo root:

```bash
npm run doctor:basic
```

If you want HTTP verification on a machine with a valid local session:

```bash
npm run start:http
```

In a second shell:

```bash
npm run doctor:http
```

If you also want notebook-aware verification:

```bash
npm run doctor:http -- --notebook-url "https://notebooklm.google.com/notebook/<your-notebook-id>"
```

## Public Repo UX Checks

Before publishing, confirm:

- the first screen of `README.md` explains what the repo does
- the local source install path appears before Docker or WSL branches
- Codex and Claude wrappers exist at the repo root
- deeper docs are linked, not hidden
- troubleshooting points to the doctor flow first

## Final GitHub Checks

Before clicking public:

1. review changed files one more time
2. confirm no local-only files are staged
3. confirm the repo description matches the public README
4. confirm license and upstream attribution remain intact
5. confirm package metadata still points to the intended public repo

## Suggested Final Review Prompt

Use this prompt with another AI agent as a last-pass reviewer:

```text
Review this repository as if you only have the public repo link.

Check:
- can you identify the recommended install path immediately
- is the manual Google auth pause point clear
- can you determine the exact next command at each step
- do the docs avoid assuming an existing MCP setup
- do you see any private notebook URLs, auth data, local paths, or secrets

Report only real blockers, confusing instructions, or public-safety issues.
```

## Ready To Publish When

You can publish when all of these are true:

- `doctor:basic` passes
- docs consistently point to the same install flow
- no tracked file leaks private local data
- placeholders are used instead of live values
- AI entrypoint files are present and easy to follow
