//! A synchronous façade, for programs with no async runtime.
//!
//! It owns a single-threaded runtime and blocks on the async client, which is
//! the honest way round: the asynchronous calls are the real ones. Do not call
//! these from inside an async context — use [`crate::Client`] there.

use crate::error::{Error, Result};
use crate::types::{
    Answer, AskRequest, Health, Library, Manual, PassageSearch, SearchRequest, SourceList,
    SourceText,
};

/// The blocking twin of [`crate::Client`], with the same calls.
#[derive(Debug)]
pub struct Client {
    inner: crate::Client,
    runtime: tokio::runtime::Runtime,
}

impl Client {
    /// A blocking client for a server on the given address.
    pub fn new(base: impl Into<String>) -> Result<Self> {
        Self::from_async(crate::Client::new(base)?)
    }

    /// A blocking client for the usual loopback address and port.
    pub fn local() -> Result<Self> {
        Self::from_async(crate::Client::local()?)
    }

    /// Wrap a configured async client, so the builder does not need a twin.
    pub fn from_async(inner: crate::Client) -> Result<Self> {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(Error::Runtime)?;
        Ok(Self { inner, runtime })
    }

    /// See [`crate::Client::health`].
    pub fn health(&self) -> Result<Health> {
        self.runtime.block_on(self.inner.health())
    }

    /// See [`crate::Client::library`].
    pub fn library(&self) -> Result<Library> {
        self.runtime.block_on(self.inner.library())
    }

    /// See [`crate::Client::ask`].
    pub fn ask(&self, request: &AskRequest) -> Result<Answer> {
        self.runtime.block_on(self.inner.ask(request))
    }

    /// See [`crate::Client::search_passages`].
    pub fn search_passages(
        &self,
        notebook_id: &str,
        request: &SearchRequest,
    ) -> Result<PassageSearch> {
        self.runtime
            .block_on(self.inner.search_passages(notebook_id, request))
    }

    /// See [`crate::Client::sources`].
    pub fn sources(&self, notebook_id: &str) -> Result<SourceList> {
        self.runtime.block_on(self.inner.sources(notebook_id))
    }

    /// See [`crate::Client::source`].
    pub fn source(
        &self,
        notebook_id: &str,
        source_id: &str,
        cursor: Option<u64>,
    ) -> Result<SourceText> {
        self.runtime
            .block_on(self.inner.source(notebook_id, source_id, cursor))
    }

    /// See [`crate::Client::manual`].
    pub fn manual(&self) -> Result<Manual> {
        self.runtime.block_on(self.inner.manual())
    }
}
