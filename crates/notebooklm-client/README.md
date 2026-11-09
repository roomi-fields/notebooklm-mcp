# notebooklm

[![crates.io](https://img.shields.io/crates/v/notebooklm.svg)](https://crates.io/crates/notebooklm)
[![docs.rs](https://img.shields.io/docsrs/notebooklm)](https://docs.rs/notebooklm)
[![CI](https://github.com/roomi-fields/notebooklm-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/roomi-fields/notebooklm-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Rust client for **Gemini Notebook** (formerly NotebookLM): citation-backed
answers, passage retrieval, Studio generation, and the whole of a local
server's REST API with types rather than `serde_json::Value`.

## Features

- **All 57 operations**, generated from the server's OpenAPI specification, so
  a route added upstream reaches this crate on the release that ships it —
  rather than whenever someone remembers to add a method.
- **Citation-backed answers**: `ask_question` returns the answer and the quoted
  passage behind every marker.
- **Retrieval that spends no allowance**: `search_passages` returns the indexed
  passages for a query without generating anything.
- **The indexed text itself**: `read_source` returns what the service actually
  extracted from a PDF or a page, which the web interface only shows in
  fragments.
- **Studio generation** — audio, video, infographic, report, presentation, data
  table — plus study aids, mind maps, labels and notes.
- **The UTCP manual**: `get_utcp_manual` returns the document a
  [UTCP](https://www.utcp.io/) client reads to call the API with no types at
  all.
- **Honest optionality**: a passage with no offset deserializes to `None`, not
  to `0`. Guessing a zero is how a quotation gets attributed to the top of a
  long document.
- **A refusal keeps its words**: the server's own explanation travels in the
  error rather than being flattened into a status code, and a request that
  never arrived is a different variant from one that was declined.
- **Synchronous twin** behind one feature flag, generated from the same source
  so it can never cover less.

## Usage

```toml
[dependencies]
notebooklm = "4.7"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```

```rust,no_run
use notebooklm::{AskRequest, Client, SearchPassagesRequest};

#[tokio::main]
async fn main() -> notebooklm::Result<()> {
    let client = Client::local()?;

    if !client.get_health().await?.authenticated {
        println!("no Google session yet — run the setup command once");
        return Ok(());
    }

    let library = client.list_notebooks().await?;
    let notebook = &library.notebooks[0];

    // Retrieval: the evidence, with no generation allowance spent.
    let found = client
        .search_passages(&notebook.id, &SearchPassagesRequest::new("ikigai").limit(5))
        .await?;
    for passage in &found.passages {
        println!("{} — {}", passage.rank, passage.text);
    }

    // Or an answer, with the quotations behind it.
    let answer = client
        .ask_question(&AskRequest::new(&notebook.id, "How is ikigai defined?"))
        .await?;
    println!("{}", answer.answer);
    for citation in answer.citations() {
        println!("  [{}] {}", citation.number, citation.source_text);
    }
    Ok(())
}
```

## It needs a server, and that is deliberate

Google publishes no API for the consumer product. Everything any tool does
rides on the endpoints the web application itself calls, and those require a
logged-in Google session. Keeping one means three things that are easy to
underestimate:

- the session is **bound to the machine** it was created on — copied cookies
  are refused even while their local expiry still looks valid;
- Google **expires sessions server-side** while those cookies look fine, so the
  only reliable check is navigating and seeing where you land;
- an unpatched automated browser **gets flagged**, and the patches have to be
  maintained against a moving target.

So this crate owns no browser. It talks to a process that does:

```bash
npx -y @roomi-fields/notebooklm-mcp                                # the server
npx -y -p @roomi-fields/notebooklm-mcp notebooklm-mcp-setup-auth   # once
```

On loopback the server needs no token. As soon as you expose it, it refuses to
start without one — pass it with `Client::builder().api_key(…)`.

## Crate features

- `rustls` (default) — TLS through [rustls](https://github.com/rustls/rustls).
- `native-tls` — TLS through the platform's own stack instead.
- `blocking` — a synchronous `blocking::Client` with the same 56 calls, for
  programs with no async runtime.

## Versions

The crate version is the server version it speaks to. There is one release per
server release, and `4.6` works against a 4.6 server; a mismatch is the one
thing this crate cannot type-check for you.

The minimum supported Rust version is **1.88**, verified by building with it.
Raising it is a minor-version change.

## Documentation

- [API reference](https://docs.rs/notebooklm)
- [Server documentation](https://notebooklm.roomi-fields.com/)
- [Driving it from Rust](https://notebooklm.roomi-fields.com/blog/notebooklm-rust)
  — why the crate is shaped this way
- [REST API reference](https://notebooklm.roomi-fields.com/notebooklm-rest-api)

## License

MIT. See [LICENSE](https://github.com/roomi-fields/notebooklm-mcp/blob/main/LICENSE).

### Contribution

Issues and pull requests go to
[roomi-fields/notebooklm-mcp](https://github.com/roomi-fields/notebooklm-mcp),
which holds the server and this crate together. The typed surface is generated:
change `deployment/docs/openapi.yaml` and run `npm run rust:sync`, never
`src/generated.rs` by hand.
