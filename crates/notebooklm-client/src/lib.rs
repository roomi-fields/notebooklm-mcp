//! An async Rust client for a local Gemini Notebook (NotebookLM) server.
//!
//! Google ships no public API for the consumer product, and the part that
//! cannot live in a crate is the Google session: the login is bound to the
//! machine it was made on, the session expires server-side while local cookies
//! still look valid, and the browser driving it has to stay patched against
//! detection. So this crate does not own a browser. It talks to a process that
//! does — `npx -y @roomi-fields/notebooklm-mcp`, listening on loopback — and
//! gives you its API with types instead of `serde_json::Value`.
//!
//! ```no_run
//! use notebooklm::{AskRequest, Client};
//!
//! # async fn run() -> notebooklm::Result<()> {
//! let client = Client::local()?;
//!
//! let health = client.get_health().await?;
//! if !health.authenticated {
//!     // One setup command, once per machine.
//!     return Ok(());
//! }
//!
//! let library = client.list_notebooks().await?;
//! let notebook = &library.notebooks[0];
//!
//! let answer = client
//!     .ask_question(&AskRequest::new(&notebook.id, "What is this notebook about?"))
//!     .await?;
//! println!("{}", answer.answer);
//! for citation in answer.citations() {
//!     println!("  [{}] {}", citation.number, citation.source_text);
//! }
//! # Ok(())
//! # }
//! ```
//!
//! # Retrieval costs nothing
//!
//! [`Client::search_passages`] returns the indexed passages matching a query
//! without generating anything, so it spends no generation allowance. When you
//! mean to reason over the evidence yourself, ask for the evidence.
//!
//! # Everything else
//!
//! This crate covers reading and asking. The server exposes 59 operations in
//! all, and [`Client::get_utcp_manual`] returns the UTCP manual describing every one of
//! them — which a [UTCP](https://www.utcp.io/) client can call natively,
//! without any of the types here.
//!
//! # Features
//!
//! - `rustls` (default) / `native-tls` — which TLS stack to use.
//! - `blocking` — a synchronous façade, for programs with no async runtime.

#![forbid(unsafe_code)]
#![warn(missing_docs, clippy::pedantic)]
// `doc_markdown` wants product names in backticks. NotebookLM and Gemini
// Notebook are prose, not identifiers, and this documentation is meant to be
// read by people searching for those words.
#![allow(
    clippy::must_use_candidate,
    clippy::missing_errors_doc,
    clippy::doc_markdown
)]

mod client;
mod ergonomics;
mod error;
/// Every operation of the server's REST API, generated from its OpenAPI
/// specification so that a route added upstream reaches a Rust caller on the
/// release that ships it.
pub mod generated;

/// The synchronous twin of every call, behind the `blocking` feature.
#[cfg(feature = "blocking")]
pub mod blocking;

pub use client::{Client, ClientBuilder};
pub use ergonomics::SourceFormat;
pub use error::{Error, Result};
pub use generated::*;
