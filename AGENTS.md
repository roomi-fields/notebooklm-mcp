# AGENTS.md

This repository exposes NotebookLM through MCP and an optional local HTTP server.
If you are an AI agent, use this file as the canonical onboarding guide.

## What You Can Assume

- The repo is intended to be installed locally from source.
- The safest default path is: install, build, authenticate manually, register with the MCP client, verify.
- A human must complete the Google sign-in step. Do not claim you can silently finish Google auth without user interaction.
- Do not overwrite an existing user MCP client configuration unless the user explicitly asks you to do that.
- Do not assume any notebook URL, account, cookies, or local auth state already exists.

## Golden Path

1. Clone the repository.
2. Run `npm install`.
3. Run `npm run build`.
4. Run `npm run setup-auth`.
5. Pause and tell the human to finish Google login in the opened browser window.
6. Register the MCP server in the target client using the repo's `dist/index.js`.
7. Verify the install:
   - `npm run doctor:basic`
   - `npm run start:http` in a separate shell if HTTP verification is needed
   - `npm run doctor:http`
   - `npm run doctor:http -- --notebook-url "https://notebooklm.google.com/notebook/<your-notebook-id>"`

## Exact Auth Pause Point

When `npm run setup-auth` opens a browser:

- Stop and ask the user to sign in to Google manually.
- Tell them to open NotebookLM and wait until their notebooks are visible.
- Tell them to close the browser window when the auth flow is complete.

Do not continue as if auth is complete until that browser step is finished.

## Verification Order

1. Confirm Node.js meets the repo requirement.
2. Confirm build artifacts exist.
3. If using HTTP mode, confirm `http://127.0.0.1:3000/health` succeeds.
4. If a notebook URL is available, verify `/content` and `/ask`.

## Common Failure Signatures

- `/health` unreachable:
  - The HTTP server is not running, or the wrong port is in use.
- `authenticated: false`:
  - Manual Google login has not been completed or the saved session expired.
- `/content` or `/ask` fails after auth:
  - The notebook URL may be invalid, inaccessible, or the NotebookLM UI language does not match selector settings.
- Browser/profile lock errors:
  - Close all Chrome processes that are using the same profile and rerun the auth or server command.

## First Files To Read

- `README.md`
- `deployment/docs/00-AI-ONBOARDING.md`
- `deployment/docs/01-INSTALL.md`
- `deployment/docs/05-TROUBLESHOOTING.md`

## Client Registration Rule

Only provide copy-paste MCP registration snippets.
Do not silently edit Codex, Claude, Cursor, or other client configuration files unless the user asks for that exact mutation.
