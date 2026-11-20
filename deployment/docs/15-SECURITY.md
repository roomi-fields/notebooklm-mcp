# Securing the HTTP API

The HTTP wrapper exposes 45 routes that read your notebooks, ask questions as
you, and delete things. Treat the port as equivalent to your NotebookLM
session, because that is what it hands out.

## The defaults, as of 4.0.0

| Control      | Default     | Effect                                                           |
| ------------ | ----------- | ---------------------------------------------------------------- |
| Bind address | `127.0.0.1` | Only this machine can reach the API                              |
| Cross-origin | denied      | A web page cannot call the API unless its origin is allow-listed |
| Token        | none        | Not required while the server is loopback-only                   |

Running `npm run start:http` with no configuration is safe on a single-user
machine: nothing off the machine can reach it, and no page you visit can read
it.

## Exposing it to other machines

A bind wider than loopback requires a token. Without one the server refuses to
start rather than serving your library to the network.

```bash
# Generate a token
openssl rand -hex 32

# Run exposed
HTTP_HOST=0.0.0.0 NOTEBOOKLM_API_KEY=<token> npm run start:http
```

Every route then requires the token:

```bash
curl -H "Authorization: Bearer <token>" http://host:3000/notebooks
# or
curl -H "X-API-Key: <token>" http://host:3000/notebooks
```

`/health` stays reachable without one so monitors and container health checks
keep working, and answers them with `{"status":"ok","version":"…"}` only. The
full report, which names your active notebook, needs the token.

The bundled stdio proxy and `npm run doctor:http` both send
`NOTEBOOKLM_API_KEY` when it is set in their own environment.

## Letting a browser page call the API

Cross-origin requests are refused unless you name the origin:

```bash
NOTEBOOKLM_ALLOWED_ORIGINS=https://app.example,https://staging.example npm run start:http
```

There is no wildcard. A page served from an origin you did not list gets `403`,
whether it is reading or writing.

## The host names the server answers to

A browser omits the `Origin` header on a request it believes is same-origin, so
origin checking alone cannot tell a local client apart from a page whose
hostname has been re-pointed at your loopback address. The server therefore
also checks which name a request claims to be addressing, and refuses anything
it does not serve:

```bash
NOTEBOOKLM_ALLOWED_HOSTS=notebooks.internal.example npm run start:http
```

Loopback names and the address the server is bound to are always accepted, so
the default posture needs no configuration and `curl`, n8n and the stdio proxy
are unaffected. Name a host here when you reach the server under some other
name — through a reverse proxy, for instance. A bind to every interface names
no host to pin, so the check stands down there unless you list one; that bind
already refuses to start without a token.

## Files the caller can name

Three parameters take a filesystem path: `file_path` on `add_source`,
`output_path` on `download_content`, and `vault_dir` on the batch writer. An
agent driving this server acts on text it was handed, so a poisoned document
can tell it which file to add as a source. Those paths are treated as hostile.

Every one of them is resolved first, then checked. Symlinks are followed as far
as the path exists, and containment is compared segment by segment, so a link
pointing out of an allowed directory and a sibling like `/data-evil` are both
refused.

**The session store is never reachable**, whatever else is allowed:

| Path                               | Holds                         |
| ---------------------------------- | ----------------------------- |
| `<data>/browser_state/`            | the live Google session       |
| `<data>/chrome_profile/`           | the logged-in browser profile |
| `<data>/chrome_profile_instances/` | per-account profiles          |
| `<data>/accounts.json`             | stored account credentials    |

That matters because the data directory is otherwise a legitimate place to read
and write: downloads land there. Without the rule, `add_source` could upload
your own Google session into a notebook, and `share_notebook` could then make
it public.

By default a caller may name a path under the working directory or the data
directory. Narrow it when the server runs anywhere untrusted:

| Variable                   | Narrows                            |
| -------------------------- | ---------------------------------- |
| `NOTEBOOKLM_UPLOAD_ROOT`   | where `add_source` may read        |
| `NOTEBOOKLM_DOWNLOAD_ROOT` | where `download_content` may write |
| `NOTEBOOKLM_VAULT_ROOT`    | where the batch writer may write   |

A vault is somewhere you chose, often outside the project, so `vault_dir` has
no default containment — but it is still refused the session store.

## Docker

The container binds `0.0.0.0` — a published port is useless otherwise — so it
requires `NOTEBOOKLM_API_KEY` and exits with an explanation if it is missing.

```bash
docker run -e NOTEBOOKLM_API_KEY=$(openssl rand -hex 32) -p 3000:3000 …
```

## Reporting a vulnerability

Use **Security → Report a vulnerability** on the repository. That channel is
private until a fix ships.

Past advisories:

- [GHSA-p69m-c5rf-g2c3](https://github.com/roomi-fields/gemini-notebook-mcp/security/advisories/GHSA-p69m-c5rf-g2c3)
  — ≤ 3.2.0 bound `0.0.0.0`, sent `Access-Control-Allow-Origin: *`, and required
  no credentials, so any page the user visited could drive the API. Fixed in 4.0.0.
- [CVE-2026-61647](https://github.com/roomi-fields/gemini-notebook-mcp/security/advisories/GHSA-jjhp-8crj-mppq)
  — path traversal in the vault batch writer (affected 1.6.0 – 2.0.2). Fixed in 2.0.3.
