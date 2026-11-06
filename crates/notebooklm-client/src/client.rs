use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::de::DeserializeOwned;
use serde::Serialize;
use url::Url;

use crate::error::{Envelope, Error, Redacted, Result};
use crate::types::{
    Answer, AskRequest, Health, Library, Manual, PassageSearch, SearchRequest, SourceList,
    SourceText,
};

/// A client for one local server.
///
/// Cloning is cheap: the underlying connection pool is shared.
#[derive(Clone)]
pub struct Client {
    base: Url,
    http: reqwest::Client,
}

// The connection pool holds the api key; naming it here, redacted, is the
// point of the manual implementation.
#[allow(clippy::missing_fields_in_debug)]
impl std::fmt::Debug for Client {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Client")
            .field("base", &self.base.as_str())
            .field("api_key", &Redacted)
            .finish()
    }
}

/// Builds a [`Client`] when the defaults are not enough.
#[derive(Debug, Default)]
pub struct ClientBuilder {
    base: Option<String>,
    api_key: Option<String>,
    timeout: Option<std::time::Duration>,
}

impl ClientBuilder {
    /// Where the server listens. Defaults to `http://127.0.0.1:3000`.
    #[must_use]
    pub fn base(mut self, base: impl Into<String>) -> Self {
        self.base = Some(base.into());
        self
    }

    /// The token the server requires as soon as it is exposed beyond
    /// loopback. Sent as a bearer header, and never printed by `Debug`.
    #[must_use]
    pub fn api_key(mut self, api_key: impl Into<String>) -> Self {
        self.api_key = Some(api_key.into());
        self
    }

    /// How long to wait for one call. A question can legitimately take a
    /// minute, so there is no default beyond the HTTP stack's own.
    #[must_use]
    pub fn timeout(mut self, timeout: std::time::Duration) -> Self {
        self.timeout = Some(timeout);
        self
    }

    /// Builds the client.
    pub fn build(self) -> Result<Client> {
        let base = Url::parse(self.base.as_deref().unwrap_or("http://127.0.0.1:3000"))?;
        let mut headers = HeaderMap::new();
        if let Some(key) = self.api_key {
            let mut value = HeaderValue::from_str(&format!("Bearer {key}"))?;
            value.set_sensitive(true);
            headers.insert(AUTHORIZATION, value);
        }
        let mut http = reqwest::Client::builder().default_headers(headers);
        if let Some(timeout) = self.timeout {
            http = http.timeout(timeout);
        }
        let http = http.build().map_err(|source| Error::Transport {
            base: base.to_string(),
            source,
        })?;
        Ok(Client { base, http })
    }
}

impl Client {
    /// A client for a server on the given address, with no token.
    pub fn new(base: impl Into<String>) -> Result<Self> {
        ClientBuilder::default().base(base).build()
    }

    /// A client for the usual loopback address and port.
    pub fn local() -> Result<Self> {
        ClientBuilder::default().build()
    }

    /// Start a builder.
    pub fn builder() -> ClientBuilder {
        ClientBuilder::default()
    }

    /// Whether a Google session exists on the machine running the server, and
    /// how many chats are open. Every other call fails while
    /// [`Health::authenticated`] is false.
    pub async fn health(&self) -> Result<Health> {
        self.get_enveloped("health", "/health").await
    }

    /// The local library: the notebooks registered with this server.
    pub async fn library(&self) -> Result<Library> {
        self.get_enveloped("library", "/notebooks").await
    }

    /// Ask a question and get the answer with its quotations.
    pub async fn ask(&self, request: &AskRequest) -> Result<Answer> {
        self.post_enveloped("ask", "/ask", request).await
    }

    /// The indexed passages matching a query, best rank first. Generates
    /// nothing, so it spends no generation allowance.
    pub async fn search_passages(
        &self,
        notebook_id: &str,
        request: &SearchRequest,
    ) -> Result<PassageSearch> {
        self.post_enveloped(
            "search",
            &format!("/notebooks/{notebook_id}/search"),
            request,
        )
        .await
    }

    /// Every source in a notebook, with the ids the other source calls take.
    pub async fn sources(&self, notebook_id: &str) -> Result<SourceList> {
        self.get_enveloped("sources", &format!("/notebooks/{notebook_id}/sources"))
            .await
    }

    /// The indexed text of one source. Long sources arrive in pages: follow
    /// [`SourceText::next_cursor`] while [`SourceText::has_more`] is true.
    pub async fn source(
        &self,
        notebook_id: &str,
        source_id: &str,
        cursor: Option<u64>,
    ) -> Result<SourceText> {
        let route = match cursor {
            Some(cursor) => {
                format!("/notebooks/{notebook_id}/sources/{source_id}?cursor={cursor}")
            }
            None => format!("/notebooks/{notebook_id}/sources/{source_id}"),
        };
        self.get_enveloped("source", &route).await
    }

    /// The UTCP manual: all 56 operations, named, with their addresses rebased
    /// onto the address this call was made to.
    pub async fn manual(&self) -> Result<Manual> {
        let response = self.send(self.http.get(self.route("/utcp")?)).await?;
        response.json().await.map_err(|source| Error::Shape {
            route: "utcp",
            source,
        })
    }

    fn route(&self, path: &str) -> Result<Url> {
        Ok(self.base.join(path)?)
    }

    async fn send(&self, request: reqwest::RequestBuilder) -> Result<reqwest::Response> {
        request.send().await.map_err(|source| Error::Transport {
            base: self.base.to_string(),
            source,
        })
    }

    async fn get_enveloped<T: DeserializeOwned>(
        &self,
        name: &'static str,
        path: &str,
    ) -> Result<T> {
        let response = self.send(self.http.get(self.route(path)?)).await?;
        Self::read(name, response).await
    }

    async fn post_enveloped<T: DeserializeOwned, B: Serialize>(
        &self,
        name: &'static str,
        path: &str,
        body: &B,
    ) -> Result<T> {
        let response = self
            .send(self.http.post(self.route(path)?).json(body))
            .await?;
        Self::read(name, response).await
    }

    /// The envelope carries the refusal, so an HTTP status is not consulted:
    /// a refused call answers 4xx *and* `success: false`, and the body is the
    /// half that says why.
    async fn read<T: DeserializeOwned>(
        name: &'static str,
        response: reqwest::Response,
    ) -> Result<T> {
        response
            .json::<Envelope<T>>()
            .await
            .map_err(|source| Error::Shape {
                route: name,
                source,
            })?
            .into_data()
    }
}
