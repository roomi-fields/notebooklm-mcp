//! The payload shapes, named as the server names them.
//!
//! Field names follow the wire, not Rust habit, where the two disagree: the
//! server sends `sourceText` and `notebookId`, and a rename attribute here is
//! cheaper than a surprise at runtime. Every struct is `non_exhaustive`, so a
//! field the server adds later is not a breaking change for callers.

use serde::{Deserialize, Serialize};

/// What `/health` reports: the Google session, not the build. The version
/// lives on the root route.
#[derive(Debug, Clone, Deserialize)]
#[non_exhaustive]
pub struct Health {
    /// `ok` when the server is up. It says nothing about the Google session.
    pub status: String,
    /// False until a Google login has been done on this machine. Every route
    /// that reaches Gemini Notebook fails while this is false.
    pub authenticated: bool,
    /// How many chats are currently open.
    pub active_sessions: u32,
    /// How many the server will hold at once before refusing a new one.
    pub max_sessions: u32,
}

/// The local library the server keeps: the notebooks you registered, which is
/// not the same as everything in your Google account.
#[derive(Debug, Clone, Deserialize)]
#[non_exhaustive]
pub struct Library {
    /// Every notebook registered with this server.
    pub notebooks: Vec<Notebook>,
    /// The one a question falls back to when none is named.
    pub active_notebook_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[non_exhaustive]
/// One registered notebook.
pub struct Notebook {
    /// The identifier the other calls take.
    pub id: String,
    /// The display name.
    pub name: String,
    /// The notebook's address in the web app.
    pub url: String,
    #[serde(default)]
    /// What knowledge the notebook holds, as registered.
    pub description: String,
    #[serde(default)]
    /// The topics it was registered under.
    pub topics: Vec<String>,
}

/// How the quotations behind an answer should be returned.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceFormat {
    /// Markers only, nothing extracted. The fastest, and the default.
    None,
    /// Quotations beside the answer, as structured data. The one shape worth
    /// parsing.
    Json,
    /// Quotations spliced into the answer text.
    Inline,
    /// Quotations appended under the answer.
    Footnotes,
    /// Markers replaced by the full quoted text.
    Expanded,
}

/// A question, and the few knobs worth having on it.
#[derive(Debug, Clone, Serialize)]
pub struct AskRequest {
    /// The question, as a human would write it.
    pub question: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    /// A notebook in the local library.
    pub notebook_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    /// A notebook by address, for one that is not in the library.
    pub notebook_url: Option<String>,
    /// Reuse an earlier answer's `session_id` to ask a follow-up in the same
    /// chat. Without it every question starts a new one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    /// How the quotations should come back.
    pub source_format: SourceFormat,
}

impl AskRequest {
    /// A question against a notebook in the local library, with the
    /// quotations as structured data.
    pub fn new(notebook_id: impl Into<String>, question: impl Into<String>) -> Self {
        Self {
            question: question.into(),
            notebook_id: Some(notebook_id.into()),
            notebook_url: None,
            session_id: None,
            source_format: SourceFormat::Json,
        }
    }

    /// Continue an earlier chat instead of starting a new one.
    #[must_use]
    pub fn in_session(mut self, session_id: impl Into<String>) -> Self {
        self.session_id = Some(session_id.into());
        self
    }

    /// Ask a notebook by address, for one that is not in the library.
    #[must_use]
    pub fn at_url(mut self, notebook_url: impl Into<String>) -> Self {
        self.notebook_url = Some(notebook_url.into());
        self.notebook_id = None;
        self
    }

    /// Change how the quotations come back.
    #[must_use]
    pub fn with_source_format(mut self, format: SourceFormat) -> Self {
        self.source_format = format;
        self
    }
}

#[derive(Debug, Clone, Deserialize)]
#[non_exhaustive]
/// An answer, with the chat it belongs to and the quotations behind it.
pub struct Answer {
    /// The answer text, with citation markers left in place.
    pub answer: String,
    /// Pass this back in [`AskRequest::in_session`] to ask a follow-up.
    pub session_id: String,
    /// The notebook the answer came from.
    pub notebook_url: String,
    /// Absent unless the question asked for a source format other than
    /// [`SourceFormat::None`].
    #[serde(default)]
    pub sources: Option<Sources>,
}

#[derive(Debug, Clone, Deserialize)]
#[non_exhaustive]
/// The quotations behind an answer.
pub struct Sources {
    /// The format that was asked for, echoed back.
    pub format: String,
    #[serde(default)]
    /// One entry per marker the extraction resolved.
    pub citations: Vec<Citation>,
    /// False when the answer carried markers the extraction could not resolve.
    #[serde(default)]
    pub extraction_success: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[non_exhaustive]
/// One marker in an answer, and the passage it points at.
pub struct Citation {
    /// The marker as it appears in the answer, for example `[1]`.
    pub marker: String,
    /// The marker's number.
    pub number: u32,
    /// The quoted passage. Empty when the citation resolved to a source with
    /// no excerpt — reported as empty rather than filled with the filename.
    #[serde(rename = "sourceText", default)]
    pub source_text: String,
}

/// Retrieval instead of generation: the indexed passages matching a query.
/// Nothing is generated, so no generation allowance is spent.
#[derive(Debug, Clone, Default, Serialize)]
pub struct SearchRequest {
    /// The query, echoed back.
    pub query: String,
    /// Restrict to these source ids. Empty searches every source.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub source_ids: Vec<String>,
    /// Restrict by source title. An ambiguous title is refused with the
    /// candidates named, never resolved by guessing.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub source_names: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    /// Keep at most this many passages.
    pub limit: Option<u32>,
}

impl SearchRequest {
    /// A search across every source in the notebook.
    pub fn new(query: impl Into<String>) -> Self {
        Self {
            query: query.into(),
            ..Default::default()
        }
    }

    /// Keep at most this many passages.
    #[must_use]
    pub fn limit(mut self, limit: u32) -> Self {
        self.limit = Some(limit);
        self
    }

    /// Restrict the search to these source ids.
    #[must_use]
    pub fn in_sources(mut self, source_ids: impl IntoIterator<Item = String>) -> Self {
        self.source_ids = source_ids.into_iter().collect();
        self
    }
}

#[derive(Debug, Clone, Deserialize)]
#[non_exhaustive]
/// What a passage search returns.
pub struct PassageSearch {
    #[serde(rename = "notebookId")]
    /// The notebook the reply is about.
    pub notebook_id: String,
    /// The query, echoed back.
    pub query: String,
    /// How many items the reply carries.
    pub count: u32,
    /// The matching passages, best rank first.
    pub passages: Vec<Passage>,
}

#[derive(Debug, Clone, Deserialize)]
#[non_exhaustive]
/// One matching passage of a source.
pub struct Passage {
    #[serde(rename = "sourceId")]
    /// The source it came from.
    pub source_id: String,
    /// The indexed text of the passage.
    pub text: String,
    /// Rank is global across the notebook, best first. The server sorts before
    /// applying a limit, so the order you receive is the ranking.
    pub rank: u32,
    /// Character offsets into the source's indexed text. A passage starting at
    /// zero arrives with the field absent, so absent is reported as `None`
    /// rather than guessed as zero.
    #[serde(default)]
    pub start: Option<u32>,
    #[serde(default)]
    /// The offset just past the passage, absent when the server omitted it.
    pub end: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[non_exhaustive]
/// Every source in a notebook.
pub struct SourceList {
    #[serde(rename = "notebookId")]
    /// The notebook the reply is about.
    pub notebook_id: String,
    /// How many items the reply carries.
    pub count: u32,
    /// Every source in the notebook.
    pub sources: Vec<SourceSummary>,
}

#[derive(Debug, Clone, Deserialize)]
#[non_exhaustive]
/// A source, named and identified.
pub struct SourceSummary {
    /// The identifier the other calls take.
    pub id: String,
    /// The source's title.
    pub title: String,
}

/// The exact text Gemini Notebook indexed for a source — what it reasons
/// over, which the web interface only ever shows in fragments.
#[derive(Debug, Clone, Deserialize)]
#[non_exhaustive]
pub struct SourceText {
    /// The identifier the other calls take.
    pub id: String,
    /// The source's title.
    pub title: String,
    #[serde(rename = "notebookId")]
    /// The notebook the reply is about.
    pub notebook_id: String,
    /// The indexed text itself, or this page of it.
    pub content: String,
    #[serde(rename = "totalChars")]
    /// How long the whole indexed text is.
    pub total_chars: u64,
    #[serde(rename = "hasMore", default)]
    /// True when this is a page rather than the whole text.
    pub has_more: bool,
    /// Pass as the cursor to read the next page.
    #[serde(rename = "nextCursor", default)]
    pub next_cursor: Option<u64>,
}

/// The UTCP manual: every operation the server exposes, named, with the
/// address and authentication a client needs. Not wrapped in the envelope —
/// its shape belongs to the UTCP client, not to this server.
#[derive(Debug, Clone, Deserialize)]
#[non_exhaustive]
pub struct Manual {
    /// The protocol version the manual is written for.
    pub utcp_version: String,
    /// The server version that generated it.
    pub manual_version: String,
    /// Every operation the server exposes, named.
    pub tools: Vec<Tool>,
}

#[derive(Debug, Clone, Deserialize)]
#[non_exhaustive]
/// One named operation in the manual.
pub struct Tool {
    /// The display name.
    pub name: String,
    #[serde(default)]
    /// What knowledge the notebook holds, as registered.
    pub description: String,
    /// How to call it: method, address and authentication.
    pub tool_call_template: CallTemplate,
}

#[derive(Debug, Clone, Deserialize)]
#[non_exhaustive]
/// How a client should call an operation.
pub struct CallTemplate {
    /// Always `http` for this server.
    pub call_template_type: String,
    /// The method to call the operation with.
    pub http_method: String,
    /// Rebased by the server onto the address the request arrived at, so a
    /// reverse-proxied install needs no configuration.
    pub url: String,
}
