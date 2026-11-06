# notebooklm

An async Rust client for a local **Gemini Notebook** (NotebookLM) server:
citation-backed answers, passage search that spends no generation allowance,
the indexed text of any source, and the UTCP manual describing all 56
operations.

```toml
[dependencies]
notebooklm = "4.6"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```

```rust,no_run
use notebooklm::{AskRequest, Client};

#[tokio::main]
async fn main() -> notebooklm::Result<()> {
    let client = Client::local()?;

    if !client.health().await?.authenticated {
        println!("no Google session yet — run the setup command once");
        return Ok(());
    }

    let library = client.library().await?;
    let notebook = &library.notebooks[0];

    let answer = client
        .ask(&AskRequest::new(&notebook.id, "What is this notebook about?"))
        .await?;

    println!("{}", answer.answer);
    for citation in answer.citations() {
        println!("  [{}] {}", citation.number, citation.source_text);
    }
    Ok(())
}
```

## It needs a server, and that is the point

Google ships no public API for the consumer product. Everything any tool does
rides on the endpoints the web app itself calls, and those need a logged-in
Google session. Getting one means driving a real browser through a real login;
keeping one means three things that are easy to underestimate:

- the session is **bound to the machine** it was created on — copied cookies
  are refused even while their local expiry still looks valid;
- Google **expires sessions server-side** while those cookies look fine, so
  the only reliable check is navigating and seeing where you land;
- an unpatched automated browser **gets flagged**, and the patches have to be
  maintained against a moving target.

This crate deliberately does not own a browser. It talks to a process that
does:

```bash
npx -y @roomi-fields/notebooklm-mcp          # the server
npx -y -p @roomi-fields/notebooklm-mcp notebooklm-mcp-setup-auth   # once
```

The server listens on loopback and needs no token there. As soon as you expose
it, it refuses to start without one — pass it with
[`ClientBuilder::api_key`].

## What it covers

| Call                 | What it does                                                 |
| -------------------- | ------------------------------------------------------------ |
| `health`             | whether a Google session exists, and how many chats are open |
| `library`            | the notebooks registered with this server                    |
| `ask`                | a question, with the quotations behind the answer            |
| `search_passages`    | retrieval only: the indexed passages, no allowance spent     |
| `sources` / `source` | a notebook's sources, and the exact indexed text             |
| `manual`             | the UTCP manual: all 56 operations, named                    |

The server exposes 56 operations in all. `manual` returns the
[UTCP](https://www.utcp.io/) document describing every one of them, which a
UTCP client can call natively without any of the types in this crate.

## Features

- `rustls` (default) / `native-tls` — which TLS stack to use.
- `blocking` — a synchronous façade, for programs with no async runtime.

## Links

- [Documentation](https://notebooklm.roomi-fields.com/)
- [Driving it from Rust](https://notebooklm.roomi-fields.com/blog/notebooklm-rust)
- [Repository](https://github.com/roomi-fields/notebooklm-mcp)

MIT.
