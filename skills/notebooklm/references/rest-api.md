# NotebookLM MCP — HTTP REST API reference

The `@roomi-fields/notebooklm-mcp` HTTP server (default `http://localhost:3000`,
override with `NOTEBOOKLM_SERVER_URL`). All bodies are JSON. Every notebook op
accepts either `notebook_id` (a UUID) or `notebook_url`. Only the endpoints most
relevant to research are listed; see the project README for the full 54.

## Health & auth

| Method | Path          | Body               | Purpose                                                       |
| ------ | ------------- | ------------------ | ------------------------------------------------------------- |
| GET    | `/health`     | —                  | Reachability + `{ authenticated, headless, current_account }` |
| POST   | `/setup-auth` | `{ show_browser }` | Interactive Google login (visible browser)                    |
| POST   | `/re-auth`    | `{ show_browser }` | Switch account / fresh login (e.g. after daily quota)         |
| POST   | `/de-auth`    | —                  | Log out, clear session                                        |

Interactive login is usually better run as the CLI command
`notebooklm-mcp-setup-auth` in a terminal (a stdio client's tool timeout can cut
off the up-to-10-minute login).

## Query (the core)

| Method | Path   | Body                                                    | Purpose                |
| ------ | ------ | ------------------------------------------------------- | ---------------------- |
| POST   | `/ask` | `{ question, notebook_id, source_format, session_id? }` | Citation-backed answer |

- `source_format`: `none` \| `inline` \| `footnotes` \| `json` \| `expanded`.
  Use `json` for machine-readable citations (source names + cited excerpts),
  `expanded` for human-readable footnotes with excerpts.
- Omit `session_id` for a fresh question (fastest, uses the internal RPC path);
  pass a stable `session_id` to continue a multi-turn conversation.

## Notebooks & sources

| Method  | Path                                     | Body                                                          | Purpose                                                   |
| ------- | ---------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| GET     | `/notebooks`                             | —                                                             | List notebooks (id + name)                                |
| POST    | `/notebooks`                             | `{ title }`                                                   | Create a notebook                                         |
| GET     | `/notebooks/scrape`                      | —                                                             | Force a live scrape of the account                        |
| POST    | `/content/sources`                       | `{ source_type, url\|text\|file_path, title?, notebook_url }` | Add a source (`url`/`text`/`file`/`youtube`)              |
| GET/PUT | `/notebooks/:id/share`                   | `{ public }`                                                  | Read / set public-link status                             |
| POST    | `/notebooks/:id/search`                  | `{ query, source_ids?, source_names?, limit? }`               | Ranked passages from the index — no generation, no quota  |
| GET     | `/notebooks/:id/summary`                 | —                                                             | The notebook's own summary + suggested questions          |
| GET     | `/notebooks/:id/freshness`               | `?source_id=`                                                 | Which URL/Drive sources drifted (`stale: null` = unknown) |
| GET     | `/notebooks/:id/sources/:sourceId/guide` | —                                                             | NotebookLM's summary + key topics for one source          |

## Chat history

Read back what was already asked instead of paying to ask it again. NotebookLM
exposes only the **most recent** conversation per notebook, and has no per-turn
delete — clearing removes the whole conversation.

| Method | Path                  | Query                      | Purpose                                     |
| ------ | --------------------- | -------------------------- | ------------------------------------------- |
| GET    | `/notebooks/:id/chat` | `?limit=&conversation_id=` | Turns, newest first (`question` / `answer`) |
| DELETE | `/notebooks/:id/chat` | `?conversation_id=`        | Clear the history                           |

## Content generation

| Method | Path                 | Body                              | Purpose                                                                                   |
| ------ | -------------------- | --------------------------------- | ----------------------------------------------------------------------------------------- |
| POST   | `/content/generate`  | `{ notebook_id, content_type }`   | Studio: `audio` \| `report` \| `video` \| `infographic` \| `presentation` \| `data_table` |
| POST   | `/content/study-aid` | `{ notebook_id, kind, focus? }`   | `kind`: `flashcards` \| `quiz`                                                            |
| POST   | `/content/mind-map`  | `{ notebook_id, title? }`         | Interactive mind map, saved to the notebook                                               |
| POST   | `/content/research`  | `{ notebook_id, query, import? }` | Web/Drive source discovery (fast/deep)                                                    |
| GET    | `/content`           | `?notebook_id=`                   | List generated artifacts                                                                  |
| GET    | `/content/download`  | `?notebook_id=&type=`             | Download audio/video/infographic bytes                                                    |

## Batch → vault (for large research runs)

| Method | Path              | Body                                                                   | Purpose                                                                                                   |
| ------ | ----------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| POST   | `/batch-to-vault` | `{ questions[], vault_dir, notebook_id, source_format, slug_prefix? }` | Run many questions, write each answer as markdown + JSON sidecar (`nblm-answer-v1`) for offline retrieval |
