use std::fmt;

/// What can go wrong between a Rust program and the local server.
///
/// The variants separate three situations a single error type usually blurs:
/// the request never arrived, the server refused the request and said why, and
/// the server answered in a shape we cannot read. Only the second is the
/// caller's fault, and only the third is ours.
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum Error {
    /// The request never completed: nothing listening, TLS, timeout, DNS.
    #[error("the server at {base} could not be reached: {source}")]
    Transport {
        /// The address the client was pointed at.
        base: String,
        #[source]
        /// What the HTTP stack reported.
        source: reqwest::Error,
    },

    /// The server answered the envelope with `success: false` and a reason.
    /// The reason is the server's own wording, meant to be shown to a human.
    #[error("the server refused the request: {0}")]
    Refused(String),

    /// The server reported success but sent no payload — a contract breach on
    /// its side, reported rather than unwrapped into a panic.
    #[error("the server reported success with no payload")]
    EmptyPayload,

    /// The body did not match the shape this version of the client expects,
    /// which usually means the client and the server are different versions.
    #[error("could not read the server's answer to {route}: {source}")]
    Shape {
        /// Which call could not be read.
        route: &'static str,
        #[source]
        /// What the HTTP stack reported.
        source: reqwest::Error,
    },

    /// The base address could not be parsed, or a route could not be joined
    /// onto it.
    #[error("invalid server address: {0}")]
    Address(#[from] url::ParseError),

    /// The blocking façade could not start its own runtime.
    #[cfg(feature = "blocking")]
    #[error("could not start a runtime for the blocking client: {0}")]
    Runtime(#[source] std::io::Error),

    /// The api key held a byte that cannot travel in an HTTP header.
    #[error("the api key cannot be sent as a header: {0}")]
    ApiKey(#[from] reqwest::header::InvalidHeaderValue),
}

/// The result of every call in this crate.
pub type Result<T> = std::result::Result<T, Error>;

impl Error {
    /// True when retrying could plausibly succeed: the request never arrived.
    /// A refusal is not retryable — the server already decided.
    pub fn is_transport(&self) -> bool {
        matches!(self, Error::Transport { .. })
    }
}

/// The envelope every route answers with: a flag, then the payload or a
/// reason. Typing it once means no route has to be checked by hand.
#[derive(serde::Deserialize)]
#[serde(bound(deserialize = "T: serde::Deserialize<'de>"))]
pub(crate) struct Envelope<T> {
    success: bool,
    #[serde(default)]
    data: Option<T>,
    #[serde(default)]
    error: Option<String>,
}

impl<T> Envelope<T> {
    pub(crate) fn into_data(self) -> Result<T> {
        match (self.success, self.data, self.error) {
            (true, Some(data), _) => Ok(data),
            (_, _, Some(reason)) => Err(Error::Refused(reason)),
            _ => Err(Error::EmptyPayload),
        }
    }
}

/// Written out so a `Debug` of the client never prints the api key.
pub(crate) struct Redacted;

impl fmt::Debug for Redacted {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("<redacted>")
    }
}
