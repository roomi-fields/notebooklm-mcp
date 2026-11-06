# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### A Rust client, in this repository

`crates/notebooklm-client` publishes to crates.io as **`notebooklm`**: a typed
async client for this server's REST API, with a `blocking` feature for programs
that have no runtime. It covers health, the local library, questions with their
quotations, passage search and a source's indexed text, and returns the UTCP
manual for the other operations.

The crate deliberately owns no browser. The Google session is bound to the
machine it was created on, expires server-side while local cookies still look
valid, and needs a driver kept patched against detection — three problems this
server already solves, and three a crate would have to re-solve and then
maintain against Google's redesigns. So the crate is a client, and says so.

Its types encode the two shapes a careless client gets wrong: a passage
starting at offset zero arrives with the field absent, and is reported as
absent rather than guessed at; and a refusal arrives in the envelope with the
server's own wording, which the error type carries through instead of
flattening into a status code.

It is held to the server's own bar — formatted, clippy-pedantic clean, twelve
tests against a stubbed server — by a CI job, and its version is kept equal to
the server's by the release chain. Publishing uses crates.io trusted
publishing, so no token is stored; the first version needs one disposable
token, exactly as npm did, because a crate that does not exist yet cannot have
a trusted publisher.

### The README stopped telling the truth about its own releases

The "Latest releases" list was hand-written, and had stopped at 3.0.1 while the
package shipped 4.6.0 — nine releases missing, three of them security
releases, on the page most readers never scroll past. It is generated from the
changelog now, and a guard fails the build if it drifts or loses its markers.

### A release can finish even when npm holds it back

npm accepted 4.6.0, answered that the package was being processed, and then did
not serve it for eighty minutes. The registry job waits ten, so it failed; and
a re-run could not help, because npm refuses a republish over a version it has
merely staged (`409 Cannot publish over previously staged version`). The
release was neither lost nor recoverable by retrying — only by waiting.

So the wait is now thirty minutes, its error says what is actually happening
rather than implying the publish failed, and the registry half can be started
on its own from the Actions tab against a version npm is already serving. The
npm publish is skipped on that manual run, so it cannot collide with a staged
upload.

Four names were missing from the acknowledgments, and one was wrong: the open
HTTP API was reported by @shinjiyu, not by @ghostnshells, who reported the
other two advisories. Nils Friedrichs and Teodor Tenev are credited for their
merged work, and a test checks each reporter and contributor is still named.

---

## [4.6.0] - 2026-11-06

### Retry a failed generation without losing its id

`retry_content`, and `POST /content/:id/retry`, re-queue a failed Studio
artifact in place. A failed generation used to be final: the only recourse was
to delete and regenerate, which mints a new id and invalidates every reference
the caller held — a stored id, a poll loop already watching it, a queued
download. The retry keeps the id, so all of those survive.

Shipping it uncovered the half that made it unusable. `list_content` filtered
on completed artifacts, so a failed generation vanished from the listing:
indistinguishable from never having been asked for, and its id unreachable,
which left the new tool with nothing to be called with. The status has carried
three values since it was written — the filter was narrower than the type it
was filling. The listing now reports all three.

Two refusals rather than cheerful lies: a reply with no artifact row throws,
naming the artifact, instead of reporting a queued retry the caller would then
poll forever; and a media address is handed over only for a finished artifact,
because a half-written one is a download that fails later for no stated reason.

Protocol details read from `teng-lin/notebooklm-py` (MIT) and cited in the
code; the implementation is ours.

### A UTCP interface, and 56 named operations

[UTCP](https://www.utcp.io/) inverts MCP: there is no protocol server. A
client reads a manual once, then calls this REST API natively, with no
intermediary. `GET /utcp` serves that manual, generated from our own OpenAPI
specification and rebased on whatever address the request arrived at, so one
document serves a loopback install and a reverse-proxied one alike.

The manual exists because auto-conversion is not enough. A UTCP client will
convert an OpenAPI document it fetches, in JSON or YAML — but the reference
implementation keeps an operation **only if it carries an `operationId`**, and
every one of our 56 operations was unnamed. Pointed at our specification, a
client found no tools at all. All 56 are now named, with the names our MCP
tools already use, so `search_passages` is `search_passages` on both sides
rather than something synthesised from a URL path.

The second gap the manual closes is authentication. Our specification declares
a bearer scheme; the reference converter maps `apiKey`, `basic` and `oauth2`,
not that one, so a converted manual calls everything unauthenticated and every
call comes back 401. The published manual asks for the key as `X-API-Key`,
which this server has always accepted alongside the bearer form, in the exact
shape the client's own model defines. The key itself is never in the document —
only the literal `${NOTEBOOKLM_API_KEY}`, which is how a client asks for a
value from its own environment.

Field names were taken from the reference client's source, not its prose: the
RFC and the published documentation disagree with each other on them. A
release guard regenerates the manual and fails on any difference, and refuses
outright an operation added without a name.

### Releases update the published documents by themselves

`npm version <x>` now propagates the new version to all ten places that
restate it — the plugin manifest, the registry manifest, the site config, the
README, `llms.txt`, the AI catalogue, the roadmap, the OpenAPI specification
and the UTCP manual — and stages them into the version commit. Pushing that
commit triggers the docs deploy, which regenerates the specification and the
manual into the published static files. Nothing in the chain is a step anyone
has to remember, and three guards fail the release if one of them is skipped.

### Gemini Notebook, written where people and crawlers read

Google renamed NotebookLM to Gemini Notebook in July 2026. Both names are now
in prose on every surface that advertises us — the README, the registry
manifest, the site metadata, `llms.txt`, the AI catalogue and all twelve blog
posts — because the old name is still what people search for and the new one
is what the product is called.

Three use-case posts, one per interface: calling the API from a UTCP client,
driving it from Python, and a literature-review agent over the MCP tools.
Every response shape in them was read out of the handlers before publishing.
A test holds each post to a contract — title and description lengths, a slug
matching its filename, tags, keywords, a summary break and at least one
internal link — so a post cannot ship unfit to be found.

### Fixed

- **The site's social preview image was a 404 on every page.** `og:image` and
  `twitter:image` had pointed at a file that was never committed, so every
  share of every page rendered blank. The card now exists, and a test fails if
  the configured image is absent from disk.
- **The published OpenAPI specification was frozen at version 1.5.9, with 27
  of the 56 routes.** `website/static/openapi.yaml` was a hand-maintained
  second copy that nobody had regenerated since 24 October, so the document an
  AI client or a UTCP converter actually fetches described an API two years of
  releases behind the code. A copy nobody regenerates is worse than no copy,
  because it answers confidently and wrongly. The duplicate is gone; the site
  now generates it, and the manual, on every build.

---

## [4.5.0] - 2026-10-30

### Search the sources without paying for an answer

`search_passages`, and `POST /notebooks/:id/search`, return the indexed
passages matching a query, best rank first. Nothing is generated, so **no chat
quota is spent** — which matters on a free account capped near fifty questions
a day. This is the retrieval half of research, the half an agent cannot
perform for itself; when you mean to reason over the evidence yourself, ask
for the evidence rather than for prose.

Filter by `source_ids`, or by `source_names` — an ambiguous title is an error
naming the candidates, never a silent guess. `limit` trims the reply to the
context you are willing to spend.

Two properties of the response are worth knowing, because both are easy to
misread. **Rank is global across the notebook while the reply is grouped by
source**, so the order the server sends is not the ranking; we sort before
applying `limit`. And **a passage starting at offset zero arrives with the
slot absent** rather than set to 0, so absent offsets are reported as absent:
guessing a zero is how a quote gets attributed to the top of a long document.

The bundled skill gained `nblm.sh search` to match, and says to prefer it over
asking when the evidence is what you want.

Protocol details read from `teng-lin/notebooklm-py` (MIT) and cited in the
code; the implementation is ours.

### Also

- Three production advisories closed (`qs`, `@hono/node-server`, and `express`
  which was only reported through `qs`): the overrides named a floor a
  published fix had already passed.
- A version-sync rule that matched nothing used to print a green tick. Rules
  now run against normalised line endings, and a rule that has lost its target
  fails the run by name. It had let the REST spec ship a release behind.
- `dist/notebooklm.zip` in the skill repo had been carrying the August files
  through several changes, and is rebuilt.

---

## [4.4.0] - 2026-10-24

### Two security fixes, both reported by Umar Ahmed (ghostnshells)

**The server now checks which host a request claims to be addressing**
(GHSA-2fgr-6pf3-3hcx). The origin guard shipped in 4.0.0 let a request with no
`Origin` header through, on the stated assumption that only a direct client
omits that header. A browser omits it too, on any request it believes is
same-origin — which is what a re-pointed hostname produces. A page the user
merely visited could therefore read the library, sessions and the full health
report, unauthenticated. The new host guard runs before every other control
and refuses any name the server does not serve; loopback names and the bound
address are always accepted, so no local client is affected.
`NOTEBOOKLM_ALLOWED_HOSTS` names any further host, such as one behind a
reverse proxy.

**A caller can no longer steer the browser anywhere but the notebook app**
(GHSA-q565-44p7-45pv). Twelve routes and one tool accepted a notebook URL and
handed it to a browser that holds the user's Google session, with no check
beyond the scheme; exactly one route validated the host. The check now lives
at the chokepoint they all share, so routes written later inherit it.

Also: `/health` documented a behaviour it did not have. With no token
configured it returns the full report, and the comment now says so and says
why that posture is safe.

---

## [4.3.0] - 2026-10-22

### Eight tools for calls the server already knew how to make

Eight method ids had sat in the RPC table since v3 with nothing exposing them.
The protocol details came from reading `teng-lin/notebooklm-py` (MIT) rather
than from capturing traffic.

| Tool                     | What it answers                                                |
| ------------------------ | -------------------------------------------------------------- |
| `get_chat_history`       | What was already asked in this notebook, newest first          |
| `delete_chat_history`    | Clear it — the web UI's "Delete history"                       |
| `get_notebook_summary`   | What is in this notebook, and what it suggests asking          |
| `get_source_guide`       | NotebookLM's own summary and key topics for one source         |
| `check_source_freshness` | Which URL / Drive sources have drifted from what they point at |
| `rename_source`          | Fix a source title in place                                    |
| `export_artifact`        | Send a finished artifact to Google Docs or Sheets              |
| `revise_slide`           | Change one slide instead of regenerating the deck              |

The matching REST endpoints take the server from 45 to 53. Reading history
back matters most for agents: one resuming work could not see its own earlier
answers, so it paid to ask them again.

### Two things the backlog had wrong

Reading the reference before writing the code corrected the plan twice:

- **There is no way to list conversations.** The call returns the most recent
  conversation id and ignores the limit it accepts. The tool is named for that
  rather than for the listing the backlog assumed.
- **There is no per-turn delete.** Clearing history removes the whole
  conversation.

A third entry — re-syncing a stale source — was dropped rather than shipped:
the singular refresh call is rejected by the server for every payload shape
the reference tried. `check_source_freshness` reports the drift; the resync
waits for a payload we can verify instead of a tool that always fails.

### Fixed

- `check_source_freshness` reports `stale: null` for a reply it does not
  recognise. A confident "current" for an unparsed answer is the failure that
  makes a caller skip the refresh it needed.
- The source-by-name resolver is now one implementation shared by every tool
  that accepts `source_name`, instead of a copy inside `read_source`.
- `npm run facts:sync` now also guards the **tool count** in the comparison
  table and the roadmap, not just the endpoint count.

---

## [4.2.0] - 2026-10-18

### Security — the session store is no longer reachable through a file path

Three parameters take a path from the caller: `file_path` on `add_source`,
`output_path` on `download_content`, and `vault_dir` on the batch writer. An
agent driving this server acts on text it was handed, so those paths are
attacker-reachable — a poisoned document can tell the agent which file to add
as a source.

The data directory was an allowed root, and it holds `browser_state/`,
`chrome_profile/` and `accounts.json`. Adding one of those as a source uploaded
a live Google session into a notebook, which `share_notebook` could then make
public. `output_path` was worse: it was written verbatim, anywhere on disk,
including over those same files.

All three now go through one guard:

- the path is resolved before it is checked, not after;
- symlinks are followed as far as the path exists, so a link inside an allowed
  directory cannot walk out of it;
- containment compares whole path segments, so `/data-evil` no longer passes a
  check for `/data`;
- the session store is refused whatever the allowed roots say;
- callers receive the resolved path, and that is what gets opened.

Operators can narrow the defaults with `NOTEBOOKLM_UPLOAD_ROOT` and
`NOTEBOOKLM_DOWNLOAD_ROOT`, alongside the existing `NOTEBOOKLM_VAULT_ROOT`.
Without them, a caller may name a path under the working directory or the data
directory, minus the session store.

No API change. A path that was legitimate before is still legitimate.

---

## [4.1.0] - 2026-10-18

### Changed — Node 22 is the floor, and the last four advisories left with it

The declared floor of Node 18 had become fiction: three production
dependencies — the browser engine, the file globber and the data-directory
resolver — already required Node 20 or newer. The CI matrix kept passing on
18 because the tests never exercised them, which made the green tick an
assurance of nothing.

Node 18 has had no security release since March 2025, and Node 20 reached end
of life in April 2026, so moving to 20 would have been a migration onto a dead
version. The matrix now tests 22 and 24; the container moves to 22. Nothing
breaks for anyone on a supported runtime, and `engines` is a warning rather
than a gate, so no install is blocked — it simply stops claiming support we no
longer had.

The reason to do it now: the third-party file globber could go. Its dependency
chain carried four advisories with no patched version upstream, documented as
reviewed exceptions in 4.0.0. Node's built-in search replaces it, the
exception list is empty, and the audit runs clean with no allowances at all.

That search had **no test coverage whatsoever** before this release — the
suite passed identically with it present or absent. It now has its own tests
over a real directory tree: wildcard expansion, `**` across levels, the
file/directory split, and a missing tree returning nothing instead of
throwing.

Also removed: four type suppressions that Node 22's own typings made
unnecessary.

---

## [4.0.0] - 2026-10-18

### Security — the HTTP API is no longer open to the network or to any web page

Reported privately on 2026-10-16 through the disclosure channel opened two
weeks earlier ([GHSA-p69m-c5rf-g2c3](https://github.com/roomi-fields/notebooklm-mcp/security/advisories/GHSA-p69m-c5rf-g2c3)),
found with [MCP Guard](https://github.com/dshoneys/mcp_guard).

Up to and including 3.2.0 the HTTP wrapper bound `0.0.0.0`, answered every
origin with `Access-Control-Allow-Origin: *`, and asked for no credentials on
any of its 45 routes. Two consequences, both real once an account was
connected: any page the user visited could read their whole library and drive
every route through `127.0.0.1`, and on a shared network so could anyone else.
The routes include bulk notebook deletion, so this was not read-only.

The reporter rated it low because their test had no account connected. With an
account, the same routes serve the library and `/ask`.

Three changes, each closing one leg:

- **`HTTP_HOST` now defaults to `127.0.0.1`.** A bind wider than loopback
  requires `NOTEBOOKLM_API_KEY`; without it the server refuses to start rather
  than serving the library to the network.
- **No wildcard origin, ever.** A request carrying an `Origin` header is
  refused with `403` unless that origin is listed in
  `NOTEBOOKLM_ALLOWED_ORIGINS`. Refusing — rather than merely withholding the
  CORS header — also stops the blind writes a simple form POST could trigger.
  Direct clients (curl, n8n, the bundled proxy) send no `Origin` and are
  unaffected.
- **Bearer token on every route** once `NOTEBOOKLM_API_KEY` is set, compared in
  constant time, accepted as `Authorization: Bearer` or `X-API-Key`.

`/health` stays reachable without a token so monitors and container health
checks keep working; unauthenticated it answers liveness only, since the full
report names the active notebook.

### Breaking

- **Remote access now requires a token.** `HTTP_HOST=0.0.0.0` without
  `NOTEBOOKLM_API_KEY` exits at startup with instructions.
- **The Docker image requires `NOTEBOOKLM_API_KEY`.** A container must bind
  every interface for a published port to work, so the entrypoint refuses to
  start without one.
- **Browser clients need `NOTEBOOKLM_ALLOWED_ORIGINS`.** Anything that called
  the API from a page relied on the wildcard and will now get `403`.
- Unauthenticated `/health` no longer reports `authenticated`, `notebook_url`
  or session counts.

Local use through `npm run start:http`, the stdio MCP server, and the bundled
proxy need no change: the proxy and `doctor:http` forward the token when one is
set. New guide: [Securing the HTTP API](./deployment/docs/15-SECURITY.md).

### Fixed — an account could vanish on creation

Account ids were built from the millisecond clock alone, so two accounts
created inside the same millisecond shared an id and the second silently
replaced the first. No error, no warning, one account simply gone — rare by
hand, routine from a script. Ids now carry a random suffix; existing ids are
untouched.

It surfaced as a Node 18 test failure that looked like flakiness. It was the
bug reporting itself.

### Fixed — dependency advisories, and the four that have no fix

Raised past new advisories on `fast-uri`, `hono`, `ip-address`, a critical
IP-spoofing one on `proxy-addr`, and an OAuth credential leak in the MCP SDK
(now 1.32.1).

Four remain in the file-search chain (`braces`, `micromatch`, `fast-glob`,
`globby`) with no patched version upstream; npm's only suggestion is a
two-major downgrade. Every pattern we pass is a string literal in the cleanup
manager, so the attacker-supplied pattern the advisory needs has no way in.
Rather than lower the audit bar and hide the next real one, the audit step now
requires each unfixable advisory to be named, justified and given a review
date — an exception past its date fails the build.

---

## [3.2.0] - 2026-09-03

### Added — `content_delete`: generated content can finally be removed

`DELETE_STUDIO` had sat in the RPC id table since v3, declared and called by
nothing. Content could be generated and listed but never deleted, so a notebook
accumulated every draft anyone ever asked for and the only way out was the web
UI. This is the second piece of dead configuration this area has turned up, and
the second one found by needing it rather than by reading.

`content_delete` (`DELETE /content/:contentId`) removes an audio overview,
video, report, infographic, presentation, data table, flashcard set or quiz.
RPC-backed, no browser, single id per call — batch shapes were probed against
the live server and refused. Verified by deleting nine real artifacts and
confirming the notebook came back empty with its source untouched.

Note-backed mind maps are deliberately out of scope: they live in the notes
system rather than the Studio library, and deleting one only clears it. Payload
and that carve-out from teng-lin/notebooklm-py (MIT).

### Closed — both open issues, settled by measurement rather than by waiting

**#34** (generated content in the wrong language) is verified end to end on the
path the reporter was actually running: an audio overview requested in Spanish,
on the browser transport, from a notebook with no Spanish sources, came back as
_"Física del magma y formas volcánicas"_. That was the last unproven case, and
it needed 3.1.2 — 3.1.1's fix handled the report-shaped dialog and missed the
audio one, which was the filed case.

**#30** (idle server accumulating CPU) is closed on a measurement instead of an
unfalsifiable hypothesis. A bare launch with stdin held open and silent, on
3.1.2:

| elapsed | cumulative CPU |
| ------: | -------------: |
|   130 s |            1 s |
|   592 s |            1 s |
|   671 s |            1 s |

That one second is startup and it does not grow — against the 360 minutes over
six hours in the report. Every libuv worker idle, no browser spawned alongside,
clean shutdown on SIGTERM.

---

## [3.1.2] - 2026-08-21

### Fixed — 3.1.1's browser-path language fix covered one dialog shape out of two

It was written against the report dialog, where the language menu hides behind
each format tile's pencil, and it looked for that pencil first. **Audio Overview
and Video Overview have no pencil** — their card opens straight onto a
customisation panel with the language menu already on it. So the very case the
original report was about, an audio overview in the wrong language, was still
not fixed.

The menu is now used when it is already present, and the pencil is only sought
when it is not. Verified live on the audio dialog: 80 options listed, the
control moved from `English` to `español`.

Two more faults found by testing it rather than trusting it:

- **The wait was far too short.** These dialogs have been measured taking more
  than ten seconds to render, and a three-second check does not report "no
  language menu" — it invents one, and then generates in the wrong language
  while claiming to know why.
- **The generate button was searched page-wide**, so it matched a stray button
  behind the overlay and the panel was declared to have none. The language had
  in fact been set, so the caller got a warning about a failure that had not
  happened — the same false-report defect this whole release is about, produced
  by the fix for it.

Verified end to end across both dialog shapes and four languages: data table in
Italian, report in Japanese and Brazilian Portuguese, audio menu selection in
Spanish.

### Added — an unapplied language is now said out loud

When a language is requested and NotebookLM's browser UI offers no way to set
it for that content type, the result carries a `warnings` entry saying the
content came back in the account's default language and that the RPC transport
can set it. Content still generated, caller still told.

---

## [3.1.1] - 2026-08-21

### Fixed — generated content came out in the server's interface language, not the one you asked for

Reported in #34 by @Javiergomezdev: a Spanish notebook, a Spanish account and
`language: "Spanish"` produced a French audio overview and a French mind map,
while the tool reported `status: "ready"`. Nothing signalled the artifact was
unusable; it surfaced only when someone opened the file.

Three separate faults were stacked here.

**The interface locale was choosing the content language.** `uiLocale` exists so
the browser fallback's text selectors match the page they are reading. It has no
business deciding what language an artifact is written in, yet
`content_generate` fell back to it, and `generate_study_aid` used it outright
with no way to override. Output language is now its own setting —
`NOTEBOOKLM_CONTENT_LANGUAGE`, defaulting to English — and every generator takes
a per-call `language`.

**The `language` argument was documented in a form NotebookLM never accepts.**
The tool told callers to pass `"Spanish"`; NotebookLM identifies an output
language by a BCP-47 code. A name landed in the payload slot, matched nothing,
and the request's `hl` silently decided instead. All 81 supported languages are
now resolved from a code (`es`, `pt_BR`, `zh_Hans`), an English name
(`"Spanish"`), or a native name (`"Español"`), and anything unrecognised is
**refused** rather than quietly generated in another language. The browser path
gets the native name, which is what NotebookLM's language menu actually
lists — an English name never matched an option there either.

**`hl` on the request outranks the payload.** Verified live: a mind map carrying
`"es"` in exactly the slot the protocol specifies came back in German, because
the request went out as `hl=de`. Generation calls now send the content language
as `hl`; the same request that returned German now returns Spanish. The mind-map
payload was also sending an empty language slot and an empty prompt slot, both
of which are now filled — `generate_mind_map` gains `language` and `focus`.

**`NOTEBOOKLM_UI_LOCALE` no longer discards an unsupported value in silence.**
Setting it to `es` left you on `fr` without a word, which is what made this take
a long debugging session to pin down. It now says so, and says where the
content-language setting lives.

**The default interface locale is now English, not French.** The old default was
justified in a comment as "the most common Google Account language", which was
never true. If you were relying on French output, set
`NOTEBOOKLM_CONTENT_LANGUAGE=fr`.

### Fixed — the browser fallback ignored `language` too (#36)

On the browser path the language argument never reached NotebookLM: the format
dialog has no language control, and the code never went deeper. It sits one
level down, behind each format tile's pencil button, next to a free-text
description field. Generation now goes through that panel whenever a language
is asked for, and falls back to the plain preset click if the panel is not
offered.

Verified on the same call, same notebook, same transport:

```
before → "Analysis of Volcanic Formation and Structural Classifications"
after  → "Análisis de la Formación y Tipología de los Volcanes"
```

Nine names in the language catalog were corrected against the menu as it
actually renders — it says `Indonesia` where the reference says
`Bahasa Indonesia`, `Latin` where it says `Latina`. A name that does not match
the option text is a language silently not applied, which is the bug this
release exists to remove. Options are matched on their own text rather than by
substring, so `Español` can no longer select `Español (Latinoamérica)`.

### Fixed — a citation with no excerpt claimed the filename as its quotation

When the excerpt behind a citation marker could not be extracted, the source
_name_ was put in the excerpt field. Callers could not tell a real quotation
from a stand-in, and the formatters printed the filename inside quotation
marks — `[1: "Paper.pdf"]` reads as though the source says "Paper.pdf".

An absent excerpt is now absent: `sourceText` is empty, and each format says so
in its own way (`[1: Paper.pdf — no excerpt]`, `(no excerpt extracted)`). The
vault writer already handled the empty case correctly, so its output becomes
accurate with no schema change.

### Fixed — `manage_labels` was calling the wrong RPC and never worked

Every label operation returned `RPC "LABEL_MANAGE" returned no result — the id
likely rotated`, listing included. The id had not rotated: listing labels is its
own RPC (`I3xc3c` / GetLabels) and we were using the create id (`agX4Bc`) for
both, then reading the result at the wrong index — create echoes the label list
one slot further along than list does. Found while investigating #34, fixed and
verified live: create, list and delete now round-trip.

### Fixed — "the id likely rotated" was reported for calls the server had simply refused

`content_generate`, `generate_study_aid` and `generate_mind_map` were failing
with `RPC "CREATE_STUDIO" returned no result — the id likely rotated`, pointing
at `NOTEBOOKLM_RPC_OVERRIDES` and a replacement id to go and find.

There was no rotated id, and nothing upstream was broken. NotebookLM was
answering normally and **refusing the call** — `PERMISSION_DENIED`, because the
notebook was shared with the account rather than owned by it, and NotebookLM
only lets you generate content in your own notebooks. The refusal travels in the
`wrb.fr` envelope at index 5 as a gRPC status code, and the client was throwing
that away: it only looked for a string payload, found none, and concluded the
id was unknown.

A refusal and a rotated id are now different errors, because they carry
different evidence — a refusal comes with an envelope for the id, a rotated id
comes with none at all. Refusals name the status and what it means for you
(`PERMISSION_DENIED`, `RESOURCE_EXHAUSTED` when a daily quota is spent,
`NOT_FOUND`, `UNAUTHENTICATED`, …), and are no longer retried, since a verdict
does not change in a second — except `UNAUTHENTICATED`, which is exactly the
stale-token case the retry was built for.

The same message had already caused one wrong diagnosis, and the label bug above
was found under it too. Status-code semantics confirmed against
teng-lin/notebooklm-py's decoder (MIT).

---

## [3.1.0] - 2026-08-20

### Added — read what NotebookLM actually indexed (`source_list`, `source_read`)

Two new tools, both RPC-backed (no browser):

- **`source_list`** (`GET /notebooks/:id/sources`) — every source in a notebook
  with its ID and title. Until now nothing exposed source IDs, so nothing could
  address an individual source; a 153-source notebook answers in about a second.
- **`source_read`** (`GET /notebooks/:id/sources/:sourceId`) — a source's full
  indexed content: the exact text NotebookLM reasons over, which the web UI
  only ever shows in fragments. Quote a source verbatim, verify what a PDF or a
  web page really yielded, or pass the raw material to another tool.

`source_read` takes `source_id` or `source_name` (partial, case-insensitive). A
name matching several sources is an error naming the first few, never a guess —
silently reading the wrong document is worse than being asked again.

`format: text` (default) returns the plain-text rendition; `format: html` keeps
headings, lists and links but inlines images as base64, so it is markedly
bigger.

**Long sources are paginated.** The first PDF measured here ran to 157,716
characters — enough to spend a caller's whole context before it could judge
whether it wanted the document. So `source_read` returns 20,000 characters at a
time by default, alongside `totalChars`, `nextCursor` and a `continue`
instruction naming the exact next call. Pages are cut at the nearest line break
(the nearest tag close, in HTML) so none ends mid-word, and concatenating every
page reproduces the document byte for byte — verified live across nine pages of
that 157,716-character source. `paginate: false` returns the whole thing in one
response, and `max_chars` sets the page size.

The `GET_SOURCE` render selectors and envelope positions were read from
[teng-lin/notebooklm-py](https://github.com/teng-lin/notebooklm-py) (MIT), which
documents this endpoint; the implementation is our own. Verified live against a
153-source notebook.

### Fixed — `GET /` reported version 1.5.2 and linked to someone else's repo

The server descriptor read `process.env.npm_package_version`, which is only set
when the server starts through an npm script; started as `node dist/http-wrapper.js`
— the documented way, and what the Docker image does — it fell back to a
hardcoded `1.5.2`. It now reads the real version, and its `docs` link points at
this project's documentation instead of the upstream fork it was copied from.

### Fixed — the OpenAPI spec was missing 12 endpoints and stuck at 1.5.9

`deployment/docs/openapi.yaml` documented 31 of the 44 REST endpoints: every v3
extension (sharing, labels, study aids, mind maps, research), the notes
read/list routes, and `/batch-to-vault` were absent, and `info.version` had
never moved past 1.5.9. Spec and code now match endpoint for endpoint, and
`version:sync` keeps `info.version` in step so CI blocks the drift from
returning.

---

## [3.0.4] - 2026-08-19

### Fixed — the RPC transport was silently dead since the rebrand

Every RPC call reported `Not authenticated — session expired` on a perfectly
valid session and fell back to the DOM scrape, so **the headline feature of
3.0.0 — driving NotebookLM's internal `batchexecute` API, 10-100x faster than
scraping — has been inert**. The dual-transport design masked it completely:
answers stayed correct, only slower, so nothing looked broken from outside.

Cause: the July 2026 rebrand moved accounts to `notebook.google.com`, but the
client collected its cookie jar for `notebooklm.google.com` and talked to that
host, which answers a logged-out homepage for such an account. The jar and the
target host have to match.

Fixed by trying `notebook.google.com` first and falling back to the legacy host
for tenants still served there, keeping whichever bootstraps. Verified live on
an authenticated account: `notebook_list` logged `RPC list failed … falling
back to DOM scrape` before, and `RPC transport bootstrapped` with no fallback
after.

Anyone on 3.0.0-3.0.3 has been running the browser path for every operation.
This restores the advertised performance with no configuration change.

---

## [3.0.3] - 2026-08-19

### Fixed — wrong answer returned in long conversations (virtualized chat list)

`notebook_ask` with a `session_id` could return an **older, unrelated answer**
instead of the one just generated, on any notebook with enough chat history.
Diagnosed by @Astraktes (#29): NotebookLM's chat list is virtualized, so the
mounted DOM window does not keep order in sync with message recency — a freshly
generated answer was observed at index 8 of 11, with older, already-known
answers at 9 and 10. Every position rule (last container, or index past a
pre-submission baseline count) therefore picks the wrong container.

Reverting to plain hash dedup was not an option: that is what 2.2.0 replaced,
because a repeated answer text (two questions both answered "Yes") collides
with a known hash and times out after the full 5-minute budget.

**Both are fixed by counting occurrences instead of testing membership.** The
baseline is now a multiset (`snapshotAnswerTexts` → text hash to occurrences),
and a mounted answer is new when its text occurs _more often_ than the baseline
recorded. A second "Yes" goes 1 to 2 and is detected; an unchanged older answer
does not move and is not. DOM position is never consulted.

- `countAnswerContainers` and `baselineContainerCount` removed outright, call
  sites in `browser-session` and `content-generator` migrated in the same change.
- Both failure modes are now regression-tested.
- Known residual: a message unmounted when the baseline was captured is absent
  from it and reads as new when it scrolls into view. This now logs a warning
  naming the incomplete baseline instead of failing silently.

Only the browser path was affected — one-shot `notebook_ask` calls go over RPC
and were always correct.

---

## [3.0.2] - 2026-08-19

### Fixed — `--help` started a server instead of printing help (#30)

`notebooklm-mcp --help` booted a full stdio MCP server and stayed alive until
killed, because the subcommand dispatch added in 3.0.1 matched bare words only
(`!subcommand.startsWith('-')`), so every flag fell past the dispatch table into
the server. `help` worked; `--help` could not. Launched from a terminal, stdin
never reaches EOF, so nothing shut the stray server down.

- **`--help` / `-h` and `--version` / `-v`** are handled before the subcommand
  table and exit; an unknown subcommand still exits 1.
- **An unrecognised flag no longer passes silently** — it is reported on stderr
  and the server still starts, since MCP clients sometimes append flags of their
  own and aborting would break them. Warnings stay on stderr; stdout is the
  JSON-RPC channel.
- **Help text now documents the installed-binary commands**, not only the
  `npm run` forms that apply to a cloned repo.

### Fixed — Docker image failed to start when built from a Windows clone

The image runs `scripts/docker-entrypoint.sh` as its CMD. Cloned with
`core.autocrlf=true` (the Git for Windows default), the script was checked out
with CRLF, the kernel read the shebang as `/bin/bash\r`, and the container died
immediately with `exec: /app/scripts/docker-entrypoint.sh: not found` (exit 127).
A `.gitattributes` now pins `*.sh` to LF at checkout on every platform.

---

## [3.0.1] - 2026-08-06

### Fixed — interactive Google login on global installs / stdio clients (#27)

The interactive login could not be completed on a global (`npm install -g`)
install driven by a stdio MCP client (e.g. Claude Desktop): the visible-browser
login only shipped as an internal script with no exposed command, so users were
forced to trigger it through the in-client MCP tool — where the client's
tool-call timeout kills the up-to-10-minute Google login before it can finish.
`get_health` reporting `headless: true` (the runtime query default, unrelated to
the setup browser) and a bare `headless: false` param being silently dropped
compounded the confusion.

- **New `notebooklm-mcp-setup-auth` bin** and a `notebooklm-mcp setup-auth`
  subcommand (also `de-auth`, `accounts`, `help`) so the interactive login runs
  as a first-class terminal command — no clone, no in-client tool, no timeout.
- **`setup_auth` / `re_auth` now accept a top-level `headless`** boolean (inverse
  alias of `show_browser`) instead of silently ignoring it.
- **Docs** updated to tell stdio-client users to run the login in a terminal
  rather than asking the assistant to "log me in".

## [3.0.0] - 2026-07-30

### Changed — major refactor: dual transport (internal RPC API + DOM fallback)

The data plane no longer scrapes the browser DOM for every operation. It now
drives NotebookLM's **internal `batchexecute` RPC API** — the same JSON-RPC
endpoint the web app itself calls — with the Playwright browser retained as an
**automatic fallback** and for login / auto-reauth. Both paths ship
**permanently**: the client tries RPC first and falls back to DOM automation if
an internal endpoint shifts, so a future UI rebrand degrades gracefully instead
of breaking.

- **Immune to UI rebrands** — the operations that broke in the "Gemini Notebook"
  rebrand (list / create / delete / sources / ask / Studio) run over stable
  internal ids, independent of the DOM.
- **10-100× faster** — list notebooks ~1 s (was ~30 s), generate a report ~13 s
  and a data table ~18 s (was minutes). Adding a URL source returns the source
  id directly instead of polling up to 60 s.
- **More correct** — `list_notebooks` returns every notebook (the DOM path
  missed notebooks hidden by homepage filter/view state); `ask` returns
  **structured citations** (source id + citation number + cited passage) parsed
  from the streaming query response rather than reconstructed from DOM
  highlights.
- **Force the transport** with `NOTEBOOKLM_TRANSPORT=dom` (global DOM) or hot-patch
  a rotated RPC id via `NOTEBOOKLM_RPC_OVERRIDES` (JSON map) without a release.
- **Download** tries the RPC binary fetch, detects the HTML viewer page Google
  serves for Studio media, and falls back to the DOM downloader automatically.

### Added — 5 new tools (RPC only)

- **`share_notebook`** — read/set a notebook's public-link status and list
  collaborators.
- **`generate_study_aid`** — generate flashcards or a quiz from the sources.
- **`generate_mind_map`** — generate and save an interactive mind map.
- **`manage_labels`** — list / create / rename / delete source labels.
- **`research_sources`** — run NotebookLM's web research (fast or deep) to
  discover and optionally import new sources.

All five are exposed over MCP, the HTTP REST API, and `src/index.ts` dispatch.

### Notes

- No breaking changes to existing tool names or the REST surface; the RPC
  migration is transparent. The major bump reflects the architectural change and
  the new permanent dual-transport contract.

## [2.3.0] - 2026-07-30

### Fixed — the "Gemini Notebook" rebrand rebuilt the whole UI; create / list / rename / delete / sources / Studio all repaired (#23, #21)

Google's rebrand of NotebookLM to "Gemini Notebook" rebuilt the homepage and
Studio DOM, breaking most browser operations. All of the following were
diagnosed and re-verified end-to-end against a live authenticated account:

- **`create_notebook`** — the SPA polls the network forever, so
  `waitUntil: 'networkidle'` never fired (30 s hang). Switched to
  `domcontentloaded`; also dismiss the first-run onboarding overlay.
- **rename in `create_notebook`** — the title is now
  `input.title-input` inside `<editable-project-title>` (no aria-label /
  placeholder), and the auto-opened add-source dialog blocked it. Dismiss the
  overlay, then fill the input. Verified the name persists.
- **`list_notebooks`** — `project-{UUID}` ids and `/notebook/<id>` hrefs only
  render in **grid view**; a list-view account returned 0 on a non-empty
  account. Force grid view before scraping (removes the slow list-view
  click-through and its recency-resort race, #21).
- **`delete_notebooks`** — the tile walk overshot to a shared container and
  deleted the **wrong** notebook while mis-reporting it. Target the enclosing
  `<project-button>` tile, scope the confirm to the dialog, and **verify the id
  is gone before reporting success** (data-loss safety).
- **`add_source` (URL)** — false "upload failed" for URL sources that fetch
  server-side (20-40 s); the check waited ~5 s. Now polls up to 60 s.
- **`generate_content` (Studio)** — Studio became a grid of generation cards.
  Trigger by the card's language-independent mat-icon (forced past a hover
  tooltip), handle the per-type preset / customization dialog, and detect
  completion via a new `<artifact-library-item>`. All six types verified:
  audio, report, data table, presentation, infographic, video.
- **`list_content` / `download_content`** — rewritten on the `artifact-library`
  model; download opens the artifact's ⋮ menu → "Télécharger" (NotebookLM now
  serves audio as `.m4a`).

Also extends `NOTEBOOKLM_UI_LOCALE` to fr / en / de / ja. Thanks to
@Excauboi (#21) and @KolinEchout (#23) for the reports.

## [2.2.1] - 2026-07-25

### Fixed — Workspace accounts whose app lives on `notebook.google.com` were not recognized (#19)

NotebookLM is reachable at two hosts: `notebooklm.google.com` (Google's
documented canonical host) and `notebook.google.com` (the "Gemini Notebook"
alias). Which one an **authenticated** session resolves to is account-dependent
— some Workspace tenants land on `notebook.google.com` (their service-session
cookie is bound there). The tool hard-coded `notebooklm.google.com` in every
detection/validation check, so for those accounts it rejected pasted notebook
URLs and never detected login success ("session expired server-side" with valid
cookies).

All host checks now accept **both** hosts via a single `isNotebookHost` /
`isNotebookUrl` module; navigation still targets the documented canonical host
and follows Google's redirect. URL parsing also replaces a substring
`includes()` that could false-match an `accounts.google.com` sign-in URL
carrying `?continue=…notebooklm.google.com`. Validated end-to-end on a real
personal account (interactive login + `notebook_ask` on live notebooks).
Thanks to @kpietkaa, who diagnosed the Workspace host-scoping and drove the
revised patch.

### Fixed — notebook listing was ~30s slower after the "Gemini Notebook" rebrand

The rebrand changed the homepage notebook-card title wrapper from a `<button>`
to an `<a>`. The scrape's initial `waitForSelector` still targeted the
`<button>`, so on any account that owns notebooks it timed out a full 30s
before the (already tag-agnostic) id-based scan found them. Listing was correct
but took ~34s; it now resolves in ~5s. The wait now matches the stable
`project-{uuid}-title` id instead of a specific tag.

### Fixed — HTTP startup banner showed a hard-coded version

`http-wrapper.ts` printed `v1.5.3` regardless of the real package version. It
now reads `package.json` at runtime (same as the MCP entrypoint), so the banner
can never drift again.

---

## [2.2.0] - 2026-07-11

### Fixed — new-answer detection could time out on a repeated answer text

`waitForLatestAnswer` (used by `notebook_ask` and every Studio content
generation flow) identified "the new answer" by hashing its text and
comparing against the texts captured before the question was submitted.
If NotebookLM answered the new question with the exact same text as an
earlier answer in the same notebook (e.g. two questions both answered
"Yes", or repeated short/deterministic test prompts), the new answer's
hash collided with an already-known one and was skipped as "seen" —
the wait then timed out after the full 5-minute budget despite the
answer being stable and visible in the page.

Fixed by identifying the new answer via DOM position instead: NotebookLM
adds exactly one new `.to-user-container` per submitted question, so
"any container added after a pre-submission baseline count" is immune
to text collisions. New `countAnswerContainers()` helper in
`page-utils.ts`; the position baseline is threaded through
`notebook_ask`, `content_generate`'s chat-fallback path, and the audio
overview chat-fallback path. Falls back to the previous hash-based
comparison when no baseline is supplied (unchanged behavior for that
case). 4 new regression tests reproduce the exact hash-collision
scenario and assert the position-based path resolves it.

Root cause identified while reviewing a similar diagnosis in
[PleasePrompto/notebooklm-mcp#61](https://github.com/PleasePrompto/notebooklm-mcp/pull/61)
— thanks to [@macho715](https://github.com/macho715) for the writeup;
this fix is our own implementation, adapted to this project's
architecture.

### Fixed — orphan process on stdio disconnect

The server only handled `SIGINT`/`SIGTERM` for graceful shutdown. MCP
clients (Claude Desktop, Claude Code, Codex, …) signal disconnect by
closing the stdio pipe, not by sending a signal — without a handler for
that, the process could stay alive as an orphan with its browser session
still open. Now also shuts down on stdin `end`/`close`. Inspired by
[PleasePrompto/notebooklm-mcp#47](https://github.com/PleasePrompto/notebooklm-mcp/pull/47)
(credit: [@altristech2025](https://github.com/altristech2025)).

### Added — Japanese UI locale

New `src/i18n/ja.json`, registered alongside fr/en/de. Best-effort
translations, not runtime-validated against a live Japanese NotebookLM
account — open an issue if any string is off. Inspired by
[PleasePrompto/notebooklm-mcp#51](https://github.com/PleasePrompto/notebooklm-mcp/pull/51)
(credit: [@toshieji](https://github.com/toshieji)), reimplemented against
this project's i18n system rather than ported directly (different
codebase architecture).

---

## [2.1.1] - 2026-07-11

### Added — Thai locale selectors for `notebook_create` (#18, partial)

Added Thai text/`aria-label` selectors (`สร้าง`, `สร้างใหม่`, `สร้างโน้ตบุ๊ก`) to the
"Create notebook" button detection, contributed by
[@nontakiat](https://github.com/nontakiat). Without this, notebook creation
failed on Thai-language NotebookLM accounts, the same class of issue German
hit in [2.0.4].

Only the selector addition from #18 is included in this release. The PR's
second change — treating a NotebookLM notebook-redirect during text-source
upload as success — was not merged: it reports `success: true` even though
the source lands in the wrong (auto-created) notebook, not the one the
caller asked for. See the PR discussion for details.

---

## [2.1.0] - 2026-06-26

### Added — `note_list` and `note_get` MCP tools (#17)

Two new Studio-panel tools, contributed by [@he0xwhale](https://github.com/he0xwhale):

- `note_list` (legacy alias `list_notes`) — scrolls the Studio panel to
  trigger lazy-load of older notes, then scrapes the note cards. Returns
  `{ id?, title, details? }` per note (timestamp lives in `details`).
- `note_get` (legacy alias `get_note`) — opens a note by title (or ID)
  and serializes its DOM to markdown. Includes a structural walker over
  `element-list-renderer` that preserves tables (with header row),
  ordered/unordered lists, headings, code blocks, and inline
  bold/italic/code/link spans. Falls back to the ProseMirror editor and
  then to the legacy text-only extractor if the structural walker comes
  back empty.

Both tools are exposed over HTTP at `POST /content/notes/list` and
`POST /content/notes/get`. Selectors use the durable
`artifact-library-note` + `artifact-title` pattern, consistent with the
id-pattern convention used elsewhere in the scraper.

Minor release: additive only, no behavioural change to any existing tool.

---

## [2.0.4] - 2026-06-20

### Added — German UI selectors (closes #14 deferred item)

The selector pipeline used to iterate only `fr` + `en`, so NotebookLM
accounts running in German (any selector-based action — `add_source`,
`generate_content`, the Studio tab, the source-type chips) would silently
fall through and report "Could not find …" errors.

- New `src/i18n/de.json` with the full string set (tabs, buttons, source
  types, content types, status, errors, placeholders, content options).
- `'de'` registered as a `SupportedLocale` so `SelectorBuilder`, `tAll()`
  and every dialog/chip lookup now emit German variants alongside FR/EN.
- New `src/__tests__/i18n.test.ts` asserts every locale ships the same
  leaf-key shape as the EN reference — catches the "new locale missing a
  translation key" regression class.

The German strings are best-effort and not runtime-validated against a
live German NotebookLM account — open an issue / PR if any string is off
and we'll fix it in a patch.

---

## [2.0.3] - 2026-06-20

### Security — `vault.batch` path-traversal hardening (issue #15)

The `vault_batch` tool (and the equivalent `POST /batch-to-vault` HTTP
endpoint) previously passed the caller-supplied `vault_dir` straight to
`path.resolve()` + `fs.mkdir()`, with no containment check. A caller (or a
prompt-injected LLM driving the MCP) could therefore create directories and
write `.md` / `.json` files anywhere the server process can write.

The fix is opt-in to stay backward-compatible:

- **`NOTEBOOKLM_VAULT_ROOT` env var** — when set, every `vault_dir` is
  resolved relative to this root and the resolved path must stay inside
  `realpath(NOTEBOOKLM_VAULT_ROOT)`. Any attempt to escape via an absolute
  path or a `..` segment is rejected with a clear error.
- **`slug_prefix` is now sanitized** — path separators (`/`, `\`), `..`
  sequences and NUL bytes are stripped, and the prefix is capped at 64
  chars, so a caller can no longer smuggle path traversal through the
  filename component.

Existing users who do not set `NOTEBOOKLM_VAULT_ROOT` see no behaviour
change; the `slug_prefix` sanitization is always on but only strips bytes
that were never valid filename characters anyway.

### Fixed — CI security audit no longer fails on dev-only advisories

The `Security` job now runs `npm audit --omit=dev --audit-level=moderate`.
Vulnerabilities reported in the jest / babel toolchain (which never ship in
the published package) no longer turn the main branch red while letting
production-dep regressions through. Also bumps `hono` override to
`^4.12.25` to clear GHSA-88fw-hqm2-52qc (CORS wildcard with credentials)
and the related cluster of `hono` advisories.

---

## [2.0.2] - 2026-06-20

### Fixed — canonical tool names use `_` instead of `.`

The v2 canonical tool names were a dot-separated tree (`notebook.ask`,
`source.add`, …), but the MCP / Anthropic tool-name pattern is
`^[a-zA-Z0-9_-]{1,64}$` — **dots are not allowed**. Claude Code silently
rewrote the dots, masking the problem, but Claude Desktop validates remote
tool definitions strictly and rejected the whole server with:

```
tools.<n>.FrontendRemoteMcpToolDefinition.name: String should match pattern '^[a-zA-Z0-9_-]{1,64}$'
```

Every canonical name now uses `_` as the namespace separator: `notebook.ask`
→ `notebook_ask`, `source.add` → `source_add`, `vault.batch` → `vault_batch`,
and so on across all 9 namespaces. This is what Claude Code already displayed,
so its users see no change. The legacy flat names remain accepted as aliases,
and a regression test now asserts every advertised name matches the pattern.

---

## [2.0.1] - 2026-05-27

### Fixed

- **`add_source` for URL sources** — the 2026 NotebookLM add-source dialog
  redesign broke URL uploads on three fronts: the "Websites" tile is now an
  Angular Material chip (`mat-chip` / `mat-mdc-chip`), the URL textarea ships
  `aria-label="Enter URLs"` instead of a `placeholder` containing "URL", and
  the verification path's `Escape` keypress was landing mid-ingest and
  canceling the add. The dialog also closes asynchronously now, so the
  baseline source count was being captured _after_ the new row already
  appeared and the count-based detection never tripped. Threading the
  pre-baseline count from `addSource()` and waiting for the dialog to settle
  before verification fixes the false-negative. (Reported by
  [@assistantthatskywalker](https://github.com/assistantthatskywalker) in
  [#14](https://github.com/roomi-fields/notebooklm-mcp/issues/14).)
- **Answer wait timeout 2 min → 5 min** in `waitForLatestAnswer` — long
  NotebookLM answers with many citations regularly exceed 2 minutes and were
  timing out as false negatives. (Cherry-picked from
  [@LScelza-synapse](https://github.com/LScelza-synapse)'s fork.)
- **Spanish profile-lock locale detection** — added "Abriendo en una sesión
  existente" to the regex that triggers the singleton-profile fallback, so
  Spanish-locale Chrome installs no longer hard-fail on a locked profile.

### Security

- Override `brace-expansion@^5.0.6` (scoped to the `^5.0.0` range so the older
  `1.x` line in eslint deps is untouched) — fixes
  [GHSA-jxxr-4gwj-5jf2](https://github.com/advisories/GHSA-jxxr-4gwj-5jf2).
- Override `qs@^6.15.2` — fixes
  [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26)
  in the express / body-parser transitive chain.

---

## [2.0.0] - 2026-05-14

### Changed — tool names are now a namespaced tree

Every tool was renamed from a flat `snake_case` list to a navigable
`namespace_action` tree (9 namespaces): `notebook_*`, `library_*`, `session_*`,
`source_*`, `content_*`, `note_*`, `auth_*`, `server_*`, `vault_*`. For
example `ask_question` → `notebook_ask`, `add_source` → `source_add`,
`list_sessions` → `session_list`, `get_health` → `server_health`,
`batch_to_vault` → `vault_batch`. `tools/list` now advertises only the
canonical names. This aligns with MCP naming best practice and is the reason
for the major version bump.

> Note: 2.0.0–2.0.1 shipped these names with a `.` separator
> (`notebook.ask`), which the MCP tool-name pattern forbids; 2.0.2 corrected
> the separator to `_`. See the [2.0.2] entry.

**Backward compatible — nothing breaks.** Both the stdio server and the HTTP
proxy still accept the legacy flat names as aliases: the dispatch layer
normalises any accepted name (canonical or legacy) before routing. Existing
scripts, Claude Code / Cursor / n8n configs, and batch jobs that hard-code the
old names keep working unchanged. New integrations should use the canonical
names — the legacy aliases are supported but no longer advertised.

The legacy ↔ canonical mapping lives in one place: `src/tools/tool-names.ts`.

### Added

- **MCP `annotations` on every tool** — accurate `readOnlyHint` /
  `destructiveHint` / `idempotentHint` / `openWorldHint` / `title` per tool,
  from a central table in `src/tools/index.ts`.
- **MCP `outputSchema` on every tool** — the shared `{ success, data?, error? }`
  result envelope every handler returns. The stdio dispatch now also returns
  `structuredContent` matching that schema, not just text.
- `smithery.yaml` + `mcpb/` bundle source — the server is now published on the
  [Smithery registry](https://smithery.ai/servers/roomifields/notebooklm-mcp).

### Security

- Resolve two new transitive advisories pulled in via
  `@modelcontextprotocol/sdk@1.26.0`: **`fast-uri ≤3.1.1`** (high — path
  traversal / host confusion, GHSA-q3j6-qgpj-74h6, GHSA-v39h-62p7-jpjc) and
  **`hono ≤4.12.17`** (moderate — several, incl. cache cross-user leakage
  GHSA-p77w-8qqv-26rm). Added `overrides` for `fast-uri ^3.1.2` and
  `hono ^4.12.18`; `npm audit` reports `0 vulnerabilities`.

---

## [1.7.9] - 2026-05-06

### Security

- Resolve transitive moderate XSS advisory **GHSA-v2v4-37r5-5v8g** in `ip-address ≤10.1.0` (reachable via `@modelcontextprotocol/sdk@1.26.0` → `express-rate-limit@8.x` → `ip-address`). Added `overrides: { "ip-address": "^10.2.0" }` to `package.json` to force the patched version regardless of upstream re-resolution. `npm audit` now reports `0 vulnerabilities`. CI `security` job (audit gate) was failing on 1.7.8 because of this advisory; this release unblocks it.

---

## [1.7.8] - 2026-05-06

### Fixed (this time properly tested at runtime, MCP attached)

**`add_source` returned `Timeout waiting for source processing` for uploads that actually succeeded — false negative.**

Verified in a live MCP session against my own NotebookLM account. After the upload, `list_content` immediately reported the source as `status: "ready"` while `add_source` reported `success: false`. Root cause traced in `waitForSourceProcessing`: NotebookLM 2026 keeps the upload dialog open after a successful upload (it lets the user chain more uploads), and the count-based success detection in the polling loop was gated behind `if (!dialogVisible)` — so the loop ran for the full 90s timeout while the dialog stayed open, and the early success signal (the source-list count growing by 1) was never tripped. Fix: lift the count-based detection out of the dialog-state branch and run it on every poll cycle. As soon as the source-list count grows, return success regardless of whether NotebookLM has dismissed the dialog or not.

**Packaging: `dist/index.js` and `dist/stdio-http-proxy.js` were published in mode 644 (no executable bit) since at least 1.7.3.**

The shebang `#!/usr/bin/env node` was present, but without the executable bit npm-published archives only worked on systems where the npm install step happened to re-chmod (e.g. the `bin` symlink machinery). Sandbox bash environments that don't re-chmod silently failed with `Permission denied`. Fix: new `build:chmod-bin` step in the `build` script that explicitly chmod-755s both binaries before they get tarballed by `npm publish`. Verified locally — `ls -la dist/index.js` now shows `-rwxr-xr-x` after `npm run build`.

---

## [1.7.7] - 2026-05-06

### Defensive (not yet validated runtime)

**`add_source` `Could not find "Add source" button` — possibly fixed, definitely better diagnosed.**

Reported by an end-user agent against a freshly-created notebook. Root cause is uncertain without runtime visibility from a Claude Code session — but two things are now in place:

- **Selectors broadened** to cover the empty-notebook layout NotebookLM shows for fresh notebooks (centered "Upload sources" / "Choose files" CTA in EN, "Téléverser" / "Importer" in FR), in addition to the per-panel "+" button. Both aria-label and visible-text variants are tried.
- **Error is now actionable.** Previously the failure surfaced as just `Could not find "Add source" button`. The error now embeds a JSON dump of what the page contains: URL, document title, total button count, and up to 25 buttons with their `aria-label`, text content, mat-icon presence, class list, and visibility flag. Plus the path of the debug screenshot. So when this error reaches the calling agent, it can either pick the right selector itself or paste the dump back to a maintainer for a precise fix.

I do not have runtime access to a NotebookLM session in this environment, so I cannot confirm the broadened selectors actually resolve the error. If the issue persists, the enriched payload is designed to make the next iteration definitive instead of speculative.

---

## [1.7.6] - 2026-05-06

### Fixed

**Two bugs in tools that 1.7.4 exposed without runtime validation. Honest disclosure: I shipped both `create_notebook` and `delete_notebooks_from_nblm` in 1.7.4 without exercising them against a live NotebookLM session — only checked that the handler methods existed and the dispatch was wired. Both had latent issues that surfaced as soon as a real user ran them.**

#### `create_notebook`

Two regressions, both reported by an end-user agent that ran the tool against the live UI:

- The tool returned a transitional URL like `https://notebooklm.google.com/notebook/creating/c` instead of the final notebook URL. Root cause: the `waitForURL` regex (`/notebook\//`) matched the transitional URL immediately rather than waiting for the redirect to the UUID-based URL. **Fix:** require a full v4 UUID in the URL pattern, then wait for `networkidle` before reading the URL.
- The `name` parameter was silently ignored — every notebook came back as "Untitled notebook". Root cause: the rename used a generic `[contenteditable="true"], .notebook-title, h1` selector, took the first match (often the wrong element), typed via `Control+a`+`type`, and never verified the result. **Fix:** target ordered, specific selectors (aria-label / placeholder containing "title"/"Untitled"), use `fill` for `<input>` and `evaluate`+keystroke for contenteditable, then **read back the title** to verify the rename took. The tool now returns `name_applied: boolean` and `actual_name: string` so the caller knows whether to retry via the UI.

#### `delete_notebooks_from_nblm`

The handler used `button[aria-labelledby*="project-"]` as its primary selector — the same pattern that broke `list_notebooks_from_nblm` and was rewritten in 1.7.5. So the delete tool was very likely non-functional on the current NotebookLM DOM. **Fix:** locate each notebook tile through its stable `id="project-{UUID}-title"` element (a `page.evaluate()` walks up to the nearest card-like ancestor and stamps it with `data-nblm-target-card`), then resolve the menu button inside that marked card. Same id-pattern strategy that already powers `list_notebooks_from_nblm`.

### Process note

I am updating the project memory to require either a runtime smoke test or a full read of the handler implementation (selectors, `waitForURL`, post-action verification) before exposing any handler as a new MCP tool. Skipping that audit in 1.7.4 cost two extra releases.

---

## [1.7.5] - 2026-05-06

Three bugs reported by an end-user agent against 1.7.2–1.7.4. All three are fixed in this release.

### Fixed

**#1 — `/plugin marketplace update` + `/reload-plugins` did not actually upgrade the running MCP server (cache-poisoning by `npx -y` without a version pin).**

`mcpServers.notebooklm.args` was `["-y", "@roomi-fields/notebooklm-mcp"]`. Without a version specifier, `npx` reused the existing `_npx/<hash>/` cache regardless of which version the marketplace just refreshed to. Symptom: plugin manifest showed 1.7.4 but the live MCP server was still 1.7.2 and rejected newly-added tools (`create_notebook` etc.) with `Unknown tool`.

Fix: pin the version inside the args (`"@roomi-fields/notebooklm-mcp@1.7.5"`). `scripts/sync-version.mjs` now propagates the package version to both the manifest's `version` field AND the npx pin in `mcpServers.notebooklm.args`. The CI `version:check` validates both. From now on every release ships with a manifest that points npx at exactly the version the marketplace just resolved to.

**#2 — `list_notebooks_from_nblm` returned every notebook with `name: "Notebook"`.**

The Strategy 1 selector (`button[aria-labelledby*="project-"]`) no longer matches the current NotebookLM DOM, so it returned 0. The Strategy 2 fallback then scraped UUIDs out of the raw HTML and **hardcoded `name: 'Notebook'`** for each — making the API report N notebooks all named "Notebook" instead of an empty result or real titles.

Fix: replace the brittle button selector with a DOM-agnostic `page.evaluate()` that walks every element whose `id` matches `project-{UUID}-title` and reads its `textContent`. The id-based naming is intrinsic to NotebookLM's data model and stable across UI rewrites. Strategy 2 (raw HTML fallback) now returns `name: ''` for ids it can only discover from HTML — never the misleading hardcoded placeholder.

**#3 — `get_health.current_account` reported the previous account after `re_auth` succeeded with a different Google account.**

`handleReAuth` ran de-auth + `performSetup()` (manual browser login) but never touched the `current-account.txt` marker. Since `performSetup()` does not know which Google account the user picks during browser login, the marker stayed stale and `get_health` kept returning the old email.

Fix: new `AccountManager.clearCurrentAccountId()` method, called after a successful `re_auth`. `get_health` now truthfully omits `current_account` rather than returning a wrong value. Detecting the new account from the post-login browser state is a richer follow-up — for now we choose honest absence over misleading presence.

---

## [1.7.4] - 2026-05-06

### Added

**Two previously orphaned NotebookLM management tools are now exposed via MCP:**

- `create_notebook({ name?, show_browser? })` — creates a brand-new empty notebook directly in NotebookLM (no pre-existing share URL required, unlike `add_notebook` which only registers an already-created notebook into the local library). Returns the freshly minted `notebook_url` and `notebook_id` so the caller can chain `add_source`, `ask_question`, etc.
- `delete_notebooks_from_nblm({ notebook_ids[], show_browser? })` — bulk-delete notebooks at the NotebookLM UI level (not just from the local library). Returns `{ deleted, failed, message }`. Pair it with `list_notebooks_from_nblm` to discover IDs.

### Internal

Audited the full tool surface: 30 `ToolHandlers` methods are now aligned 1:1 with 30 tool definitions and 30 dispatch cases. No more declared-but-unwired tools, no more handlers without a tool definition.

---

## [1.7.3] - 2026-05-06

### Fixed

- `list_notebooks_from_nblm` MCP tool was declared in the tool list but missing from the dispatch switch in `src/index.ts`, so calling it returned `Unknown tool`. Added the missing case → the tool now resolves and runs `handleListNotebooksFromNblm`.

### Known orphans (not fixed in this patch)

- `handleCreateNotebook` and `handleDeleteNotebooksFromNblm` exist as `ToolHandlers` methods but are not exposed via either a tool definition or a switch case. They are unreachable today and have no effect on user-visible behaviour. A follow-up will decide whether to expose them or remove them.

---

## [1.7.2] - 2026-05-06

### Added

**Claude Code plugin manifest + cross-file version sync:**

- New `.claude-plugin/plugin.json` at the repo root — Claude Code plugin manifest (single source of truth for plugin metadata, including `mcpServers` config). Lets the [`roomi-fields/claude-plugins`](https://github.com/roomi-fields/claude-plugins) aggregated marketplace source this project directly via `source: github` instead of maintaining a duplicated wrapper.
- New `scripts/sync-version.mjs` + npm scripts `version:sync` / `version:check` — propagates `package.json.version` to the plugin manifest, `website/docusaurus.config.ts` (`softwareVersion`), and the README hero line. Uses an in-place regex replace for the plugin manifest so prettier-controlled formatting is preserved across releases (no phantom drift in CI).
- README: new "Option 0 — Claude Code marketplace" Quick Start section pointing at the aggregated marketplace one-liner.

### Changed

- `.github/workflows/release.yml`: added a "Verify version sync" step before build/publish — so a release can never ship with a stale plugin manifest or website badge.

### Fixed

- 1.7.1 was tagged but the publish failed when the version-sync check rejected a prettier-induced JSON-formatting drift. This release supersedes that aborted tag.

---

## [1.7.0] - 2026-05-06

### Added

**`batch_to_vault` is now a first-class MCP tool — no HTTP server required:**

- New MCP tool `batch_to_vault` exposed alongside `ask_question`, `add_source`, etc. Same parameters and output as the HTTP endpoint (`questions[]`, `vault_dir`, `notebook_id`/`notebook_url`, `slug_prefix`, `source_format`, `sleep_between_ms`, `session_id`). MCP clients (Claude Code, Cursor, Codex…) can now run a batch directly without starting `npm run start:http` or hitting `localhost:3000`.
- Shared helper `runBatchToVault` in `src/utils/vault-writer.ts` — single source of truth for the batch loop. Both the MCP tool (`ToolHandlers.handleBatchToVault`) and the HTTP `/batch-to-vault` endpoint call it with the same `askQuestion` injection. Eliminates the previous duplicated loop in `http-wrapper.ts`.

### Changed

- `POST /batch-to-vault` is now a thin wrapper over `ToolHandlers.handleBatchToVault`. Behaviour and response shape are unchanged; the implementation is just no longer duplicated.

---

## [1.6.0] - 2026-05-04

### Added

**RTFM integration — NotebookLM as one-shot ingestion, RTFM as retrieval layer:**

- `POST /batch-to-vault` endpoint: runs a list of questions and writes each answer as a markdown file (YAML frontmatter + answer + sources block) and a JSON sidecar in a vault directory, ready for ingestion by [RTFM](https://github.com/roomi-fields/rtfm) or any markdown vault tool (Obsidian, Foam, Dendron). Removes the 50-queries/day quota and 10–30s latency for repeat queries on academic / SOTA workflows.
- `src/utils/vault-writer.ts`: `formatAnswerMarkdown`, `formatAnswerJson`, `makeSlug` helpers with NFD-normalised slugs and YAML escape.
- `nblm-answer-v1` JSON Schema published at the canonical, immutable URL [https://schemas.roomi-fields.com/nblm-answer-v1.json](https://schemas.roomi-fields.com/nblm-answer-v1.json) (served as `application/schema+json` with open CORS, JSON-LD Dataset entry for AI-crawler discovery, 24h immutable cache). Source-of-truth copy in `schemas/nblm-answer-v1.json`.
- New documentation page [`14-RTFM-INTEGRATION.md`](./deployment/docs/14-RTFM-INTEGRATION.md) — full pattern, schema reference, RTFM wiring, recommended layout for academic batches, question-generation prompt.
- README: RTFM listed as the 4th Integration Option alongside MCP, HTTP REST, and Docker.

### Changed

- Root `/` endpoint now lists `batch_to_vault` in its endpoint registry.

---

## [1.5.9] - 2026-04-22

### Fixed

- Restore `mcpName` field in `package.json` (accidentally dropped during the 1.5.8 release). This field is required by the official MCP Registry to verify npm-package ownership; without it the registry refuses to update server metadata. v1.5.9 re-enables registry updates for `io.github.roomi-fields/notebooklm-mcp`.

---

## [1.5.8] - 2026-04-19

### Fixed

**NotebookLM UI adaptations for 2026 (PR #5 by @KhizarJamshaidIqbal):**

- `sanitizeResponseText()`: strip leaked Material-icon labels (`more_vert`, `more_horiz`) and adjacent citation artifacts from answer text
- `ensureDiscussionReady()` / `navigateToDiscussion()`: recover the Discussion panel before asking when the chat composer has been unmounted or disabled
- Count-based source detection: use `.single-source-container` row counts instead of relying on source names, so URL sources (which surface as page titles, not URLs) are still detected correctly
- New UI selectors for the "Add source" flow (`.cdk-overlay-pane`, `role=menu`, `role=menuitem`)
- Chat-input detection now skips visible-but-disabled composers
- Regression tests added in `src/__tests__/{page-utils,browser-session,content-manager}.test.ts`

### Added

**Doctor scripts (PR #6 by @KhizarJamshaidIqbal):**

- `npm run doctor:basic` — repo + build artifacts + Node engine check
- `npm run doctor:http` — `/health`, optional `/content` and `/ask` verification (pass `--notebook-url`)
- `.env.example` documenting the project's config knobs

### Security

- Credentials, personal paths, test-account emails, and real notebook UUIDs scrubbed from archived scripts and docs (PR #4 by @KhizarJamshaidIqbal and follow-up commits)
- Two tracked debug PNGs with literal Windows paths in their filenames removed from the index
- `npm audit fix` applied: hono 4.12.14, @hono/node-server 1.19.14, express-rate-limit 8.3.2, handlebars 4.7.9, brace-expansion, flatted, ip-address bumped to patched versions (no direct-dependency changes)

---

## [1.5.7] - 2026-02-26

### Fixed

**Citation Extraction:**

- Fixed `.highlighted` selector: use `.highlighted` class (not `i.highlighted`) for citation excerpt extraction
- Scoped citation button detection to last `.to-user-container .message-text-content` container — fixes multi-question sessions picking up buttons from all previous answers

### Changed

**Docker (PR #1 by @JulienCANTONI):**

- Dockerfile now builds TypeScript from source inside the container instead of copying pre-built `dist/`
- Multi-stage: install all deps → build → prune devDeps → install browser (cleaner CI/CD)
- `.dockerignore` updated to allow `src/` and `tsconfig*.json` for in-container build
- `docker-entrypoint.sh` now supports `PORT` env var (Render PaaS compatibility)

### Security

- Updated `@modelcontextprotocol/sdk` to fix vulnerabilities
- Updated `qs` dependency to fix prototype pollution vulnerability

---

## [1.5.6] - 2026-02-15

### Fixed

**Citation Extraction (Major Rewrite):**

- Rewrote citation excerpt extraction using `page.evaluate()` string expressions — eliminates all `ElementHandle` stale reference errors
- Source names extracted from `span[aria-label]` in a single DOM scan (100% reliable)
- Source excerpts extracted by clicking each citation → reading `i.highlighted` + parent `.paragraph` for full passage context
- Added `Escape` dismiss between each citation click to prevent stale highlight contamination
- Improved from ~50% to **97% success rate** (30/31 citations in real-world test)
- Removed all debug screenshots and verbose logging from production code

**Authentication & Session Recovery:**

- Fixed false "Authenticated" at startup: `verifyWithBrowser()` now does real browser navigation to NotebookLM to check if Google session is truly valid (not just local cookie expiry dates)
- Fixed mid-session `SESSION_EXPIRED`: auto-reauth now uses `AutoLoginManager` with stored credentials (fills email + password automatically), falls back to manual `performSetup()` if needed
- Fixed profile sync direction bug: after `performSetup()`, uses `syncMainToAccount()` (not the reverse) to avoid overwriting fresh auth with stale account cookies
- Fixed `setup-auth --force` flag to bypass cookie check and always open browser

**Port Management:**

- Added `EADDRINUSE` handling: detects ghost processes on port 3000, attempts auto-kill, provides clear error message if port cannot be freed

### Added

**Chrome Profile Auto-Sync:**

- `syncProfileToMain(accountId)`: copies account-specific state/profile → main `chrome_profile/`
- `syncMainToAccount(accountId)`: reverse sync after interactive re-auth
- Both called automatically at the right points in startup and mid-session flows

**Startup Browser Verification (Step 4):**

- New `verifyWithBrowser()` method launches headless browser, navigates to NotebookLM, checks actual URL
- If redirected to `accounts.google.com` → triggers auto-reauth with `AutoLoginManager` (automatic) or `performSetup()` (manual fallback)

---

## [1.5.5] - 2026-01-31

### Fixed

**Authentication State Path Mismatch (Critical Bug):**

- Fixed `/health` endpoint and session recovery checking wrong path for authentication cookies
- **Root cause:** Multi-account system saves cookies to `accounts/{id}/browser_state/state.json` but code was checking legacy global path `CONFIG.browserStateDir/state.json`
- Fixed in 4 files:
  - `src/startup/startup-manager.ts` - Now uses account-specific state path at startup
  - `src/tools/index.ts` - Health endpoint checks account-specific state with fallback
  - `src/session/shared-context-manager.ts` - Context recreation loads from correct path
  - `src/session/browser-session.ts` - Session recovery uses account-specific state
- All files maintain fallback to legacy AuthManager path for backward compatibility

**Health Endpoint Improvements:**

- Added `current_account` field to health response showing active account email
- Added `accountCheckDone` flag to ensure proper fallback to AuthManager in tests

### Added

**Windows Startup Scripts:**

- `scripts/start-server-hidden.vbs` - VBScript to launch HTTP server silently at Windows startup
- `scripts/stop-server.bat` - Batch script to stop running server processes
- `scripts/mcp-proxy-hidden.ps1` - PowerShell script for hidden window MCP proxy

**Claude Code MCP Integration:**

- Hidden window configuration for MCP stdio proxy in Claude Code projects
- Uses `powershell -WindowStyle Hidden` to avoid shell window popup on each tool call
- Example `.mcp.json` configuration in documentation

---

## [1.5.4] - 2026-01-07

### Fixed

**Citation Source Format (Critical Bug):**

- Fixed `source_format` parameter not being passed from HTTP `/ask` endpoint to handler
- The parameter was defined in the schema but never extracted from `req.body` in `http-wrapper.ts`
- All source formats now work correctly: `none`, `inline`, `footnotes`, `json`, `expanded`

**Citation Extraction:**

- Updated `CITATION_SELECTORS` for current NotebookLM DOM (January 2026):
  - Primary: `button.citation-marker`, `button.xap-inline-dialog.citation-marker`
  - Fallback selectors for backwards compatibility
- Updated `TOOLTIP_SELECTORS` for source text extraction:
  - Primary: `i.highlighted`, `.paragraph i.highlighted`
- New `extractSourceFromElement()` function extracts both:
  - `sourceName`: from `aria-label` attribute (e.g., "17: Filename.pdf")
  - `sourceText`: from hover tooltip content

**Docker/noVNC:**

- Fixed Xvfb startup error: `_XSERVTransmkdir: ERROR: euid != 0`
- Added `/tmp/.X11-unix` directory creation with proper permissions (1777) in Dockerfile
- Changed exposed port from 5900 (raw VNC) to 6080 (noVNC web interface) in docker-compose.yml

### Added

- E2E tests for `source_format` parameter: `[T15]`, `[T16]`, `[T17]` in `tests/e2e/tests/03-ask.test.ts`

---

## [1.5.3] - 2026-01-05

### Added

**Docker Deployment with noVNC:**

- noVNC integration for visual browser authentication in Docker
- Xvfb + x11vnc + websockify for headless display server
- Port 6080 for web-based VNC access
- `scripts/start-vnc.sh` - VNC services startup script
- `scripts/docker-entrypoint.sh` - Container entrypoint combining VNC + Node.js
- NAS deployment support (Synology, QNAP) with export/import workflow

**Bulk Import Endpoint:**

- `POST /notebooks/import-from-scrape` - Bulk import notebooks from NotebookLM scrape
- Options: `notebook_ids` (array) to filter, `auto_discover` (boolean) for AI metadata
- Scrapes all notebooks from account and adds them to library in one call

**New Configuration Options:**

- `browserChannel` config: `chromium` (default) or `chrome`
- `ENABLE_VNC` environment variable for Docker
- `NOVNC_PORT` environment variable (default: 6080)

### Fixed

**Docker Compatibility:**

- Fixed locale configuration to use `CONFIG.uiLocale` instead of hardcoded `en-US`
- Fixed browser channel for Docker (chromium vs chrome)
- Fixed patchright browser installation in Dockerfile
- Fixed `show_browser` parameter passing to `performSetup`
- Added Docker-specific Chrome flags (`--no-sandbox`, `--disable-setuid-sandbox`, etc.)
- Fixed `page.goto` timeouts with `waitUntil: 'domcontentloaded'`

**HTTP Server:**

- Added root endpoint (`/`) returning API info

---

## [1.5.2] - 2026-01-01

### Added

**Notebook Scraping from NotebookLM:**

- New `list_notebooks_from_nblm` tool to scrape real notebooks from NotebookLM homepage
- Uses correct button selectors (`button[aria-labelledby*="project-"]`) matching NotebookLM's actual HTML structure
- Returns notebook IDs, names, and URLs for all notebooks on the account

**Bulk Notebook Deletion:**

- New `delete_notebooks_from_nblm` tool for bulk notebook deletion
- New `DELETE /notebooks/bulk-delete` HTTP endpoint for batch deletion
- Support for protected notebook IDs that won't be deleted
- Progress tracking during deletion operations

### Fixed

**Tool Description Builder:**

- Fixed `TypeError: Cannot read properties of undefined (reading 'map')` in `buildAskQuestionDescription`
- Added defensive checks with optional chaining for `active.topics` and `active.use_cases`
- Fallback values when notebook metadata is incomplete

---

## [1.5.1] - 2026-01-01

### Added

**Multilingual UI Support (i18n):**

- New internationalization system for NotebookLM UI selectors
- Support for French (fr) and English (en) UI languages
- `NOTEBOOKLM_UI_LOCALE` environment variable to set UI language
- Locale files in `src/i18n/` with translated selectors for all UI elements
- `SelectorBuilder` class for generating bilingual selectors
- `tAll()` function to get translations in all supported languages
- Documentation: `docs/ADDING_A_LANGUAGE.md` for adding new languages

**Language/Account Switching:**

- New `scripts/switch-account-language.sh` script for automated language switching
- Automated Chrome profile cache deletion and re-authentication
- Syncs new profile to main profile after language change
- Visual verification with `--show` flag

**E2E Test Infrastructure:**

- Complete E2E test suite with 76 tests (75 pass, 1 skip)
- Test categories: Health, Notebooks, Ask, Sessions, Sources, Content, Notes, CRUD, Errors
- Support for QUICK mode (55 tests) and FULL mode (76 tests)
- Multi-account test configuration with per-account notebook URLs
- Test tracking in `tests/e2e/TRACKING.md`

### Changed

- Updated all test files to use `currentNotebooks` from config for proper account isolation
- Jest configuration updated for ESM support with `--testPathPatterns`

---

## [1.4.2] - 2025-12-29

### Removed

**Fake Content Generation Features:**

- Removed `generate_content` endpoint for FAQ, Study Guide, Briefing Doc, Timeline, and Table of Contents
- These features were NOT real NotebookLM integrations - they were just sending prompts to the chat
- The only REAL content generation NotebookLM supports is Audio Overview (podcast)
- Updated all documentation to honestly reflect actual capabilities

**What was fake:**

- `briefing_doc` - Was just asking NotebookLM chat to generate a summary
- `study_guide` - Was just asking NotebookLM chat to create study materials
- `faq` - Was just asking NotebookLM chat to generate FAQs
- `timeline` - Was just asking NotebookLM chat to create a timeline
- `table_of_contents` - Was just asking NotebookLM chat to create a TOC

**What is real:**

- Audio Overview generation - Uses NotebookLM's actual podcast feature
- Audio download - Downloads the real generated audio file
- Q&A with citations - Uses NotebookLM's actual chat with source citations
- Source management - Uses NotebookLM's actual source upload features

---

## [1.4.1] - 2025-12-29

### Fixed

**Source Upload UI Compatibility:**

- Fixed URL source upload with textarea support (NotebookLM uses textarea, not input)
- Fixed YouTube source upload with textarea support
- Added French UI locale support (placeholders: "Collez des liens", buttons: "Insérer")
- Improved fallback detection for input/textarea elements in dialogs
- Added debug logging for unrecognized dialog elements

**Audio Download Improvements:**

- Added navigation to Audio Overview panel before attempting download
- Added Material Design icon selectors (download, file_download, get_app)
- Added fallback to extract audio source URL directly from audio element
- Improved debug logging for download button detection

### Changed

**Updated UI selectors for NotebookLM:**

- Updated `navigateToStudio()` with new Material Design tab selectors
- NotebookLM now uses `mdc-tab` / `mat-mdc-tab` Angular Material components
- Added tab structure: Sources | Discussion | Studio

### Added

**Comprehensive E2E Test Suite:**

- Full E2E test coverage: 22/22 endpoints tested and passing
- PowerShell-based test runner: `tests/e2e/run-e2e-tests.ps1`
- Individual test scripts for each endpoint
- WSL-to-Windows compatible via `cmd.exe /c powershell`

**Fully Functional Features (All Verified E2E):**

- ✅ `ask_question` - Q&A with source citations
- ✅ `list_notebooks`, `select_notebook`, `search_notebooks` - Library management
- ✅ `list_content` - View sources and existing artifacts
- ✅ `add_source` - Add files, URLs, text, YouTube (all types working)
- ~~`generate_content`~~ - Removed in v1.4.2 (was fake - just chat prompts)
- ✅ `generate_audio` - Audio overview generation
- ✅ Session management - Create, reset, close sessions
- ✅ Authentication - setup_auth, re_auth, de_auth

---

## [1.4.0] - 2025-12-24

### Added

**Content Management Module:**

- New content management system for NotebookLM notebooks
- Source management:
  - `add_source` - Add files, URLs, text, YouTube videos, Google Drive documents
  - `list_content` - View all sources and generated content
- Content generation:
  - `generate_audio` - Create podcast-style audio overviews
  - ~~`generate_content`~~ - Removed in v1.4.2 (was fake - just chat prompts, not real NotebookLM features)
  - `download_audio` - Download generated audio files
- Full HTTP REST API support with 6 new endpoints
- Complete documentation in `10-CONTENT-MANAGEMENT.md`

**Multi-Account Management:**

- New account management system for multiple Google accounts
- Account switching: `switch_account`, `list_accounts`, `get_current_account`
- Dedicated session per account for parallel operations
- HTTP endpoints for account management
- Documentation in `MULTI_ACCOUNT_SYSTEM.md`

---

## [1.3.7] - 2025-12-16

### Added

**Source Citation Extraction:**

- New `source_format` parameter for `ask_question` tool with 5 options:
  - `none`: No extraction (default, fastest)
  - `inline`: Insert source text inline: `[1: "source excerpt..."]`
  - `footnotes`: Append sources at the end as footnotes
  - `json`: Return sources as separate object in response
  - `expanded`: Replace markers with full quoted source text
- New `src/utils/citation-extractor.ts` module for hover-based citation extraction
- Extracts source citations by hovering over citation markers in NotebookLM responses
- No additional API calls required - pure DOM interaction

### Fixed

**Citation Detection:**

- Fixed `findCitationsByRegex` returning empty results - now properly finds DOM elements
- Added multiple detection strategies: CSS selectors, data attributes, XPath fallback
- Fixed citation replacement for all occurrence (was only replacing first match)
- Added descending sort to avoid replacing `[1]` before `[10]`
- Handle NotebookLM's various citation formats:
  - Bracketed: `[1]`, `[2]`
  - Superscript: `text1,2` or `text3`
  - Stuck together: `text123` (citations 1, 2, 3)

---

## [1.3.6] - 2025-11-29

### Changed

**Documentation Restructure:**

- Simplified README.md from 765 to 165 lines (-78%)
- Extracted roadmap section into dedicated `ROADMAP.md` file
- README now focuses on Quick Start with links to detailed docs
- Better separation of concerns: README for overview, docs/ for details

### Added

- New `ROADMAP.md` file with planned features and version history

---

## [1.3.5] - 2025-11-27

### Added

**Quality Tooling & CI/CD:**

- Added Jest testing framework with comprehensive test suite (327 tests)
- Added ESLint configuration for code quality enforcement
- Added Prettier for consistent code formatting
- Added Husky + lint-staged for pre-commit hooks
- Added GitHub Actions CI workflow with multi-Node version testing (18.x, 20.x, 22.x)
- Added Codecov integration for coverage tracking
- Added type-coverage tool (99.01% coverage)

**Test Coverage:**

- Unit tests for `logger.ts` (100% coverage)
- Unit tests for `errors.ts` and error types
- Unit tests for `config.ts` parsing and validation
- Unit tests for `stealth-utils.ts` timing functions
- Unit tests for `cleanup-manager.ts` core functionality
- Unit tests for `page-utils.ts` selectors and utilities
- Type system tests for `ToolResult<T>` discriminated union

### Fixed

- Fixed Prettier formatting issues in README.md and test files
- Fixed code style consistency across all source files

---

## [1.3.4] - 2025-11-26

### Fixed

**CLI Scripts:**

- Fixed `de-auth.ts` CLI script: added missing implementation
- Improved page load wait logic in authentication flow

**Test Reliability:**

- Improved `test-auth.ps1` reliability: reduced from 9 tests to 7 focused tests
- Smart cleanup test that checks auth status before attempting restore
- Cleanup test now passes regardless of whether manual re-auth is needed
- Removed strict type validation tests that were testing unimplemented server-side validation

---

## [1.3.3] - 2025-01-26

### Security

**CORS Hardening:**

- Added CORS whitelist configuration via `CORS_ORIGINS` environment variable
- Default whitelist allows only localhost origins (ports 3000, 5678, 8080)
- Blocked external origins no longer receive CORS headers
- Supports wildcard `*` for development when explicitly configured

**Input Validation:**

- Added Zod schema validation for all HTTP endpoints
- Validates request bodies with detailed error messages
- Schemas: AskQuestionSchema, AddNotebookSchema, UpdateNotebookSchema, AutoDiscoverSchema, CleanupDataSchema, ShowBrowserSchema

**Express Route Security:**

- Fixed route ordering: static routes (`/notebooks/search`, `/notebooks/stats`) now correctly matched before parameterized routes (`/notebooks/:id`)
- Prevents route hijacking vulnerabilities

### Fixed

**Error Handling:**

- Replaced 30+ empty catch blocks with proper `log.debug()` logging
- Improved error visibility for debugging without breaking functionality

**Type Safety:**

- Refactored `ToolResult<T>` to discriminated union type for compile-time safety
- Fixed `ServerState` types with proper `Browser`, `SessionManager`, `AuthManager` types
- Added `JSONSchemaProperty` type for MCP tool input schemas
- Added config validation with constraint checking (min/max ranges, positive values)
- Fixed `parseProfileStrategy` to avoid unsafe `as any` type assertions

### Added

**Test Coverage (25 → 72 tests, +188%):**

- `test-validation.ps1` (18 tests) - Zod schema validation testing
- `test-auth.ps1` (8 tests) - Authentication endpoint testing
- `test-cors.ps1` (10 tests) - CORS configuration testing
- `test-sessions.ps1` (10 tests) - Session management testing
- Fixed `test-errors.ps1` pattern matching for Zod validation messages

---

## [1.3.2] - 2025-01-24

### Added

**Authentication Management:**

- New MCP tool `de_auth` for secure logout (clears all credentials without re-authenticating)
- Separation of concerns: `de_auth` (logout only), `re_auth` (logout + re-authenticate), `setup_auth` (first-time)
- HTTP API endpoints for complete authentication lifecycle:
  - `POST /de-auth` - Logout and clear credentials
  - `POST /re-auth` - Re-authenticate with different account
  - `POST /cleanup-data` - Clean all data (requires confirmation)

**HTTP API Feature Parity:**

- Added 7 missing endpoints to achieve 100% parity with MCP stdio tools
- Authentication: `/de-auth`, `/re-auth`, `/cleanup-data`
- Notebooks: `PUT /notebooks/:id`, `/notebooks/search`, `/notebooks/stats`
- Sessions: `POST /sessions/:id/reset`
- All 22 endpoints now available via both HTTP REST API and MCP stdio

**Documentation:**

- Complete API reference updated with all 22 endpoints in `deployment/docs/03-API.md`
- Added curl examples and request/response schemas for all new endpoints
- Categorized endpoints by type (Authentication, Queries, Notebooks, Sessions)

### Fixed

**Authentication Preservation:**

- Critical fix: `setup_auth` no longer erases existing authentication
- Added check for existing auth before clearing credentials
- Users can now switch between HTTP and MCP stdio modes without re-authenticating
- Preserves user experience when switching interfaces

**Code Quality:**

- Refactored `re_auth` to use `de_auth` internally (DRY principle)
- Improved separation of concerns in authentication flow
- Better error handling in HTTP wrapper

### Changed

**Version Synchronization:**

- Updated all version references across codebase to 1.3.2
- Synchronized versions in package.json, src/index.ts, src/http-wrapper.ts, README.md
- Consistent versioning across all documentation files

---

## [1.3.1] - 2025-01-24

### Added

**MCP Auto-Discovery Tool:**

- New MCP tool `auto_discover_notebook` for Claude Desktop/Cursor integration
- Automatically generates notebook metadata via NotebookLM (30 seconds vs 5 minutes)
- Zero-friction notebook addition: just provide URL, metadata is auto-generated
- Parity with HTTP API: MCP clients now have same auto-discovery capability

**Documentation:**

- Added `docs/CHROME_PROFILE_LIMITATION.md` documenting Chrome profile conflict
- Documented current limitation: HTTP and MCP stdio modes cannot run simultaneously
- Added roadmap for v1.4.0: Separate Chrome profiles by mode

### Fixed

**Critical Compatibility Fix:**

- Disabled `CompleteRequestSchema` handler causing crashes with Claude Desktop
- Fixed: "Server does not support completions" error on connection
- Claude Desktop now connects successfully without modifications

### Changed

**Tool Documentation:**

- Updated `add_notebook` tool to recommend `auto_discover_notebook` first
- Clarified when to use manual entry vs auto-discovery
- Added fallback workflow if auto-discovery fails

**README Updates:**

- Added warning about HTTP/stdio mode conflict (temporary until v1.4.0)
- Added Chrome profile limitation to roadmap as priority feature
- Updated feature descriptions to mention MCP auto-discovery availability

### Known Issues

**Chrome Profile Locking:**

- HTTP server and MCP stdio modes cannot run simultaneously
- Both modes use same Chrome profile, causing "resource busy" errors
- **Workaround:** Choose one mode at a time, or stop HTTP daemon before using Claude Desktop
- **Fix planned:** v1.4.0 will use separate Chrome profiles automatically

---

## [1.3.0] - 2025-01-23

### Added

**Auto-Discovery Feature:**

- New endpoint `POST /notebooks/auto-discover` for autonomous resource discovery
- Automatic metadata generation by querying NotebookLM itself
- Progressive disclosure pattern inspired by Claude Skills best practices
- Validation of auto-generated metadata (kebab-case names, description length, tags count)
- Retry logic for metadata generation (max 2 attempts with 2s delay)
- New field `auto_generated: boolean` in Notebook schema
- Complete documentation in `deployment/docs/07-AUTO-DISCOVERY.md`

**Key Benefits:**

- Autonomous resource discovery: Orchestrators can find relevant documentation without manual intervention
- Zero-friction notebook addition (30 seconds vs 5 minutes manual setup)
- Self-organizing documentation library
- Progressive disclosure pattern optimizes token usage and API rate limits

### Changed

**Documentation:**

- Updated API documentation with auto-discovery endpoint details
- Added progressive disclosure pattern explanation
- Enhanced README with auto-discovery feature showcase
- Version bumped to 1.3.0 across all package files

---

## [1.1.2-http] - 2025-01-21

### Added

**HTTP REST API Wrapper:**

- Express.js server exposing the MCP API via HTTP REST
- 8 documented REST endpoints (see [docs/03-API.md](./docs/03-API.md))
- CORS support for n8n/Zapier/Make integration
- Network configuration via environment variables (`HTTP_HOST`, `HTTP_PORT`)
- Listening on `0.0.0.0` by default for network access
- Enhanced logs with version, configuration, and available endpoints

**Complete Documentation:**

- Step-by-step installation guide ([docs/01-INSTALL.md](./docs/01-INSTALL.md))
- Configuration and security guide ([docs/02-CONFIGURATION.md](./docs/02-CONFIGURATION.md))
- Complete API reference ([docs/03-API.md](./docs/03-API.md))
- n8n integration guide with workflows ([docs/04-N8N-INTEGRATION.md](./docs/04-N8N-INTEGRATION.md))
- Troubleshooting guide ([docs/05-TROUBLESHOOTING.md](./docs/05-TROUBLESHOOTING.md))
- Quick start guide ([QUICK-START.md](./QUICK-START.md))
- Navigation index ([INDEX.md](./INDEX.md))

**PowerShell Automation Scripts:**

- `scripts/install.ps1` - Automated installation with checks
- `scripts/start-server.ps1` - Startup with pre-checks
- `scripts/stop-server.ps1` - Clean server shutdown
- `scripts/test-server.ps1` - Validation tests (health, notebooks, ask)

**Deployment Package:**

- Isolated and clean `deployment/` directory
- `PACKAGE-FILES.txt` file listing required files
- Ready for distribution via Git or npm

### Fixed

**Critical Bug - Windows Authentication:**

- **Issue:** chrome_profile/ remained empty after Google authentication
- **Cause:** Windows filesystem does not immediately flush writes
- **Solution:** Added a 5-second delay before closing Chrome
- **File:** `src/auth/auth-manager.ts` line 966
- **Impact:** Persistent authentication now works on Windows

**Bug - Streaming Detection:**

- **Issue:** Truncated responses or placeholders returned ("Getting the context...")
- **Cause:** Stability threshold too low (3 polls) and missing NotebookLM placeholders
- **Solution:**
  - Added NotebookLM placeholders ("getting the context", "loading", "please wait")
  - Increased stability threshold to 8 polls (~8 seconds)
- **File:** `src/utils/page-utils.ts` lines 51-53 and 210
- **Impact:** Complete and reliable responses (tested up to 5964 characters)

**Bug - System Text in Responses:**

- **Issue:** Each response contained "\n\nEXTREMELY IMPORTANT: Is that ALL you need..."
- **Cause:** `FOLLOW_UP_REMINDER` constant added after text cleanup
- **Solution:** Removed the constant and its usage
- **File:** `src/tools/index.ts` lines 30-31 and 791
- **Impact:** Clean responses, only NotebookLM content

### Changed

**Log Improvements:**

- Added server version in startup banner
- Display of configuration (Host, Port, network accessibility)
- List of available endpoints at startup
- Colored and structured logs via `utils/logger.ts`
- Format: `log.success()`, `log.info()`, `log.warning()`, `log.error()`, `log.dim()`

**Configuration:**

- Documented and standardized environment variables
- `.env` support with dotenv (optional)
- Sane defaults: `HTTP_HOST=0.0.0.0`, `HTTP_PORT=3000`, `HEADLESS=true`

**Compatibility:**

- Maintained 100% compatibility with original MCP stdio mode
- No breaking changes to existing features

---

## [1.1.2] - 2025-01-20

### Added

- Support for Claude Code as MCP client
- Improved documentation for installation

### Fixed

- Executable permissions for npm binary
- Reference in package.json

---

## [1.1.0] - 2025-01-15

Initial version of the original NotebookLM MCP Server project by Please Prompto!

### Added

- MCP server for NotebookLM via stdio protocol
- Persistent Google authentication
- Browser session management with Playwright
- Multi-notebook support via library
- Streaming detection with stability
- Stealth mode anti-detection
- MCP tools: ask_question, setup_auth, get_health, etc.

---

## Legend of Change Types

- **Added** - New features
- **Changed** - Changes to existing features
- **Deprecated** - Features soon to be removed
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Vulnerability fixes

---

**Notes:**

The `1.1.2-http` version is a major extension of the original project that adds:

1. Complete HTTP REST API wrapper
2. Production-ready deployment package
3. Comprehensive documentation (5 guides + scripts)
4. Critical fixes for Windows
5. Ready for Git/npm publication

All changes respect the original MIT license and maintain compatibility with the original MCP stdio mode.
