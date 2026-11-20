# MCP Directories & Registries

Tracking of all directories where `@roomi-fields/notebooklm-mcp` is listed or submitted, plus the release/distribution process that pushes changes to them.

**Current version:** `1.7.9` · **Directory landscape re-scanned:** 2026-05-14

## Currently Listed

### Primary distribution channels (we control)

| Channel                      | URL                                                                                                                  | Notes                                                                                                                                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **npm**                      | [npmjs.com/package/@roomi-fields/notebooklm-mcp](https://www.npmjs.com/package/@roomi-fields/notebooklm-mcp)         | Canonical install. Auto-published on tag push by `.github/workflows/release.yml`.                                                                                                                                                                                        |
| **GitHub releases**          | [github.com/roomi-fields/gemini-notebook-mcp/releases](https://github.com/roomi-fields/gemini-notebook-mcp/releases) | Release notes extracted from `CHANGELOG.md` per version, created automatically alongside the npm publish.                                                                                                                                                                |
| **Claude Code marketplace**  | [github.com/roomi-fields/claude-plugins](https://github.com/roomi-fields/claude-plugins)                             | Aggregated marketplace (NotebookLM + RTFM). Upstream plugin manifest lives here at `.claude-plugin/plugin.json`. Install: `/plugin marketplace add roomi-fields/claude-plugins` + `/plugin install notebooklm@roomi-fields`.                                             |
| **Official MCP Registry**    | [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/)                                        | `io.github.roomi-fields/notebooklm-mcp`. Last manual publish via `mcp-publisher` (see process section). `mcpName` declared in `package.json`.                                                                                                                            |
| **Docs site (GitHub Pages)** | [notebooklm.roomi-fields.com](https://notebooklm.roomi-fields.com/)                                                  | Docusaurus, auto-deployed on push to `main` by `.github/workflows/deploy-docs.yml`. Source under `website/`.                                                                                                                                                             |
| **Smithery**                 | [smithery.ai/servers/roomifields/notebooklm-mcp](https://smithery.ai/servers/roomifields/notebooklm-mcp)             | Published 2026-05-14, quality score 60/100 (Metadata 35/35, Config UX 25/25, Capability 0/40 — Smithery can't introspect tools, the server needs a browser + Google auth to boot). Namespace is `roomifields` (no hyphen). Publish process below.                        |
| **Schema host**              | [schemas.roomi-fields.com/nblm-answer-v1.json](https://schemas.roomi-fields.com/nblm-answer-v1.json)                 | Canonical home of the `nblm-answer-v1` JSON Schema, mirrored from `schemas/nblm-answer-v1.json` in this repo. Also embedded in `deployment/docs/14-RTFM-INTEGRATION.md` and referenced by `src/utils/vault-writer.ts`. Bump to v2 on breaking changes — never mutate v1. |

### Auto-indexed third-party directories

| Directory                        | URL                                                                                                                        | Notes                                                                                                                                                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Glama.ai**                     | [glama.ai/mcp/servers/@roomi-fields/notebooklm-mcp](https://glama.ai/mcp/servers/@roomi-fields/notebooklm-mcp)             | Security A, Quality A, License A. Auto-indexed. Tries to build their own Dockerfile (pnpm + Node 24) — see "Glama build" in process section below.                                                                                                  |
| **PulseMCP**                     | [pulsemcp.com/servers/pleaseprompto-notebooklm](https://www.pulsemcp.com/servers/pleaseprompto-notebooklm)                 | ~14.9k servers tracked, largest hand-reviewed directory. Auto-aggregated.                                                                                                                                                                           |
| **mcpservers.org**               | [mcpservers.org/servers/roomi-fields/gemini-notebook-mcp](https://mcpservers.org/servers/roomi-fields/gemini-notebook-mcp) | Full listing. Auto-indexed. **This is the source for [`wong2/awesome-mcp-servers`](https://github.com/wong2/awesome-mcp-servers) (~3.6k★)** — that repo no longer takes PRs, it pulls from mcpservers.org/submit. So we're already in wong2's list. |
| **MCPMarket.com**                | [mcpmarket.com/server/notebooklm](https://mcpmarket.com/server/notebooklm)                                                 | Has Top 100 leaderboard.                                                                                                                                                                                                                            |
| **LobeHub**                      | [lobehub.com/mcp/roomi-fields-notebooklm-mcp](https://lobehub.com/mcp/roomi-fields-notebooklm-mcp)                         | Auto-indexed.                                                                                                                                                                                                                                       |
| **Cursor Directory**             | [cursor.directory/mcp/notebooklm-mcp](https://cursor.directory/mcp/notebooklm-mcp)                                         | Submitted via web form. Live.                                                                                                                                                                                                                       |
| **punkpeye/awesome-mcp-servers** | [github.com/punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)                                 | ~79.6k stars. Merged via [PR #2467](https://github.com/punkpeye/awesome-mcp-servers/pull/2467).                                                                                                                                                     |
| **best-of-mcp-servers**          | [github.com/tolkonepiu/best-of-mcp-servers](https://github.com/tolkonepiu/best-of-mcp-servers)                             | Auto-ranked weekly from GitHub + package-manager metrics. No submission — **verify we appear** once stars/downloads cross their threshold.                                                                                                          |

## Pending Review

| Directory             | Submission                         | Date       | Link / Notes                                                                                                                                                  |
| --------------------- | ---------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cline Marketplace** | Issue + logo posted                | 2026-05-14 | [Issue #703](https://github.com/cline/mcp-marketplace/issues/703). Logo `assets/notebooklm-mcp-logo-400.png` posted on the issue; awaiting maintainer review. |
| **mcp.so**            | Comment on Issue #1 (never landed) | 2026-02-27 | ~19.7k servers, largest by volume. The old issue-comment route stalled — **resubmit via their current web form** at mcp.so.                                   |

## Closed to Submissions

| Directory                         | Notes                                                                                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **appcypher/awesome-mcp-servers** | ~5k★ but **PRs and Issues are both disabled** by the owner (verified 2026-05-14). No submission path. A ready branch sits on the `roomi-fields/awesome-mcp-servers-2` fork if it ever reopens. |

## Not Yet Submitted (Tier 2)

| Directory              | How to Submit                                                                                | Priority |
| ---------------------- | -------------------------------------------------------------------------------------------- | -------- |
| **mcp.directory**      | Web form at mcp.directory — ~3k servers, one-click install for Cursor/VS Code/Claude/ChatGPT | High     |
| **FindMCP.dev**        | Web form at findmcp.dev (~2 min)                                                             | Medium   |
| **MCPIndex.net**       | Contact form at mcpindex.net/en/contact                                                      | Medium   |
| **MCPList.ai**         | Web form                                                                                     | Medium   |
| **Docker MCP Catalog** | PR on github.com/docker/mcp-registry (needs Docker image)                                    | Medium   |
| **Windsurf Directory** | windsurf.run/mcp                                                                             | Low      |

### Verified low-value (2026-05-14 scan) — deprioritised

- **best-of-mcp-servers** — we don't appear; it's threshold-ranked, revisit once stars/downloads grow.
- **mcp-awesome.com** — the "1.2k servers" claim is marketing; the live site listed ~18. Skip.
- **PopularAiTools.ai** — already listed, but the entry is low-quality and ranks below PleasePrompto. Not worth chasing; would need their editorial process to improve.

## Not Yet Submitted (Tier 3)

| Directory                                       | How to Submit                            |
| ----------------------------------------------- | ---------------------------------------- |
| **MCPServerFinder.com**                         | Web form                                 |
| **MCPServer.dev**                               | Web form                                 |
| **MCPServe.com**                                | Web form at mcpserve.com/submit          |
| **MCP-Server-Directory.com**                    | Web form                                 |
| **MCPServers.com**                              | Web form                                 |
| **MCPDir.dev**                                  | Web form (open source, 8k+ servers)      |
| **MCPServerHub.net**                            | Web form                                 |
| **MCPServerHub.com**                            | Web form                                 |
| **MCP-Servers-Hub.net**                         | Web form at mcp-servers-hub.net/submit   |
| **AIAgentsList.com**                            | Web form at aiagentslist.com/mcp-servers |
| **APITracker.io**                               | Web form at apitracker.io/mcp-servers    |
| **ClaudeMCP.org**                               | Web form                                 |
| **ClaudeMCP.com**                               | Web form                                 |
| **UBOS.tech**                                   | GitHub PR                                |
| **TensorBlock/awesome-mcp-servers** (471 stars) | GitHub PR                                |

## Other Actions

| Action                     | Status                                                  | Notes                                                                       |
| -------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| **GitHub fork detachment** | Requested via GitHub Support Virtual Agent (2026-02-27) | Detach from PleasePrompto/notebooklm-mcp. Will enable Contributors sidebar. |
| **GitHub notifications**   | Enabled on all 13 public repos                          | Watch → All Activity                                                        |
| **Cline logo**             | Not yet created                                         | 400x400 PNG needed for Cline Marketplace submission                         |

## Release & Distribution Process

### 1. Version bump (one source, propagated)

The version number lives in **5 places** that must stay in sync. Run `npm run version:sync` after editing `package.json`:

| File                           | Field                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `package.json`                 | `version` (source of truth)                                                           |
| `.claude-plugin/plugin.json`   | `version` AND `mcpServers.notebooklm.args[1]` (the `@<version>` pin — see note below) |
| `website/docusaurus.config.ts` | `softwareVersion` in the SoftwareApplication JSON-LD                                  |
| `README.md`                    | Latest-version mention in the hero / latest-releases bullets                          |

CI gate: `.github/workflows/release.yml` runs `npm run version:check` before publish — release fails if anything drifts. The sync script uses **regex replace** on the target fields, not `JSON.parse + JSON.stringify`, to avoid fighting prettier's array layout (see `feedback_version_sync_prettier.md`).

> ⚠️ **The `@<version>` pin in `plugin.json.mcpServers.notebooklm.args` is mandatory, not cosmetic.** Without it, `/plugin marketplace update` does NOT actually upgrade the running MCP server — npx reuses the `_npx/<hash>/` cache. Bit us in 1.7.4 → users stuck on 1.7.2.

### 2. Tag → CI → npm + GitHub release

```bash
git tag v1.7.9
git push --tags
```

That triggers `.github/workflows/release.yml`:

1. `npm ci` (lockfile-aware; `overrides` block forces ip-address ≥10.2.0 for GHSA-v2v4-37r5-5v8g)
2. `npm run version:check` — fails the build if any of the 5 sync targets drifted
3. `npm run build` (tsc + i18n copy + `chmod 755` on `dist/index.js` and `dist/stdio-http-proxy.js`)
4. `npm publish --access public`
5. Extract CHANGELOG section for this version → create GitHub release with notes

### 3. Official MCP Registry (manual publish)

npm publish does **not** propagate to `registry.modelcontextprotocol.io` — that registry needs an explicit publish via the `mcp-publisher` CLI. Do this after a notable release:

```bash
cd /mnt/d/path/to/notebooklm-mcp

# 1. Login (opens browser for GitHub device flow)
./mcp-publisher login github

# 2. Publish (reads server.json + package.json mcpName)
./mcp-publisher publish

# 3. Verify
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.roomi-fields/notebooklm-mcp"
```

### 4. Claude Code marketplace propagation

The aggregated marketplace at `roomi-fields/claude-plugins` references the upstream `.claude-plugin/plugin.json` in this repo. End users upgrade with:

```
/plugin marketplace update roomi-fields
/reload-plugins
```

> ⚠️ There is **no** `/plugin update <name>` command — that's a common mistake (see `feedback_claude_code_plugin_commands.md`). The marketplace must be updated, then plugins reloaded.

If a user is stuck on an old npx cache: the `@<version>` pin in `plugin.json.mcpServers.notebooklm.args` fixes this for new installs starting from 1.7.5+. For pre-1.7.5 installs, the user has to manually clear `~/.npm/_npx/`.

### 5. Glama build (auto-rebuild, occasionally flaky)

Glama auto-rebuilds the Docker image on each release commit using **their own** Dockerfile (not ours):

- Base: `debian:bookworm-slim`
- Node 24 + `pnpm@10.14.0` + `mcp-proxy@6.4.3` globally
- `pnpm install && pnpm run build`
- CMD: `mcp-proxy node dist/index.js`

**Known infra fragility**: their builder can ECONNRESET while pulling `docker.io/library/debian:bookworm-slim` metadata. When that happens, the build aborts before `pnpm install` even runs. Retry from the admin UI at `https://glama.ai/mcp/servers/roomi-fields/gemini-notebook-mcp/admin/dockerfile/` (re-save the build spec to relaunch, or click Retry on the failed test detail page).

**Latent pnpm/npm gap**: our `overrides` block in `package.json` is **npm-only**. pnpm reads `pnpm.overrides`. Without a mirror, the Glama image would resolve `ip-address@10.1.0` (vulnerable) instead of the pinned `^10.2.0`. Add a `pnpm.overrides` mirror if/when Glama enables vulnerability scanning on their image, or migrate to a `pnpm-lock.yaml` in-repo.

### 6. Smithery (manual, MCPB bundle)

Smithery lists this as a **local stdio** server (`remote: false`). It is **not** hosted — users still run it locally.

1. Build the bundle from the committed source:
   ```bash
   npx @anthropic-ai/mcpb pack mcpb notebooklm-mcp.mcpb
   ```
2. Publish (needs Node ≥ 20 — the upload uses `globalThis.File`):
   ```bash
   npx @smithery/cli auth login
   npx @smithery/cli mcp publish notebooklm-mcp.mcpb -n roomifields/notebooklm-mcp
   ```
3. Push server-level metadata (the bundle manifest does **not** populate the listing's description/homepage/icon):
   ```bash
   TOKEN=$(npx @smithery/cli auth token --policy '{"namespaces":"roomifields","ttl":"30m"}' | jq -r .token)
   curl -X PATCH "https://registry.smithery.ai/servers/roomifields%2Fnotebooklm-mcp" \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"description":"...","homepage":"https://notebooklm.roomi-fields.com/","iconUrl":"https://raw.githubusercontent.com/roomi-fields/gemini-notebook-mcp/main/mcpb/icon.png"}'
   ```

**Gotchas:**

- Namespace is **`roomifields`** (no hyphen) — `roomi-fields` returns 403.
- The MCPB manifest **must declare at least one `user_config` option** or the publish fails with `400 "No values to set"`. We declare `data_dir` → `NOTEBOOKLM_DATA_DIR`.
- **Capability Quality stays 0/40**: Smithery can't introspect the tool list because the server boots a browser and needs Google auth — it can't run in their introspection sandbox. Metadata (35/35) + Config UX (25/25) → 60/100, which is the realistic ceiling for this server.

## Files Related to Distribution

| File                                | Purpose                                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `package.json`                      | Source of truth for version. Contains `mcpName`, `bin`, `files`, `overrides`, build scripts.                   |
| `package-lock.json`                 | Lockfile — required to be in sync with `package.json` for `npm ci` to succeed in CI.                           |
| `server.json`                       | Official MCP Registry metadata (consumed by `mcp-publisher`).                                                  |
| `.claude-plugin/plugin.json`        | Claude Code plugin manifest. Pinned version in `mcpServers.notebooklm.args` is load-bearing.                   |
| `scripts/sync-version.mjs`          | Propagates `package.json` version to plugin manifest, docusaurus config, README.                               |
| `.github/workflows/release.yml`     | Tag-driven: `version:check` → build → npm publish → GitHub release.                                            |
| `.github/workflows/deploy-docs.yml` | Push-to-main: builds Docusaurus, deploys to `gh-pages` branch.                                                 |
| `Dockerfile`                        | Our local image (not used by Glama — Glama auto-generates its own).                                            |
| `smithery.yaml`                     | Smithery discovery config — declares the stdio launch command (`npx -y @roomi-fields/notebooklm-mcp@latest`).  |
| `CHANGELOG.md`                      | Per-version release notes. Section between `## [x.y.z]` headings is extracted into GitHub release notes by CI. |
