use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::de::DeserializeOwned;
use serde::Serialize;
use url::Url;

use crate::error::{Envelope, Error, Redacted, Result};

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

    /// One request, for the generated surface: the route, an optional body,
    /// an optional query block, and the envelope unwrapped.
    ///
    /// `name` is only ever used to say which call could not be read, which is
    /// the difference between "the server changed" and "my code is wrong".
    pub(crate) async fn send_json<T, B, Q>(
        &self,
        name: &'static str,
        method: reqwest::Method,
        path: &str,
        body: Option<&B>,
        query: Option<&Q>,
    ) -> Result<T>
    where
        T: DeserializeOwned,
        B: Serialize + ?Sized,
        Q: Serialize + ?Sized,
    {
        let mut request = self.http.request(method, self.route(path)?);
        if let Some(body) = body {
            request = request.json(body);
        }
        if let Some(query) = query {
            request = request.query(query);
        }
        let response = self.send(request).await?;
        Self::read(name, response).await
    }

    /// Two routes answer with their own document rather than the envelope:
    /// the server banner and the UTCP manual. Reading those through the
    /// envelope fails on a missing `success` field, which is a confusing way
    /// to say "this route was never wrapped".
    pub(crate) async fn send_raw<T, Q>(
        &self,
        name: &'static str,
        method: reqwest::Method,
        path: &str,
        query: Option<&Q>,
    ) -> Result<T>
    where
        T: DeserializeOwned,
        Q: Serialize + ?Sized,
    {
        let mut request = self.http.request(method, self.route(path)?);
        if let Some(query) = query {
            request = request.query(query);
        }
        let response = self.send(request).await?;
        response.json().await.map_err(|source| Error::Shape {
            route: name,
            source,
        })
    }

    /// The same, for a call with no body — spelled out so the generated code
    /// never has to name a body type it does not have.
    pub(crate) async fn send_empty<T, Q>(
        &self,
        name: &'static str,
        method: reqwest::Method,
        path: &str,
        _body: Option<&()>,
        query: Option<&Q>,
    ) -> Result<T>
    where
        T: DeserializeOwned,
        Q: Serialize + ?Sized,
    {
        self.send_json::<T, (), Q>(name, method, path, None, query)
            .await
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
