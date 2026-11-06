//! The few helpers the generated surface cannot have.
//!
//! Everything else in this crate comes out of the OpenAPI specification, which
//! is what keeps it complete. A generator cannot know that a question usually
//! wants its quotations as data, or that the session id of one answer is the
//! handle for the next — so those live here, as impls on the generated types
//! rather than as a second set of them.

use crate::generated::{
    AskQuestionData, AskQuestionDataSourcesCitationsItem, AskRequest, SearchPassagesRequest,
};

/// How the quotations behind an answer should come back.
///
/// The wire takes a string; this is the list the server accepts, so a typo
/// fails to compile instead of coming back as an answer with no citations.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceFormat {
    /// Markers only, nothing extracted. The fastest, and the server's default.
    None,
    /// Quotations beside the answer, as data. The one shape worth parsing.
    Json,
    /// Quotations spliced into the answer text.
    Inline,
    /// Quotations appended under the answer.
    Footnotes,
    /// Markers replaced by the full quoted text.
    Expanded,
}

impl SourceFormat {
    /// The value the server expects.
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            SourceFormat::None => "none",
            SourceFormat::Json => "json",
            SourceFormat::Inline => "inline",
            SourceFormat::Footnotes => "footnotes",
            SourceFormat::Expanded => "expanded",
        }
    }
}

impl AskRequest {
    /// A question against a notebook in the local library, with the quotations
    /// returned as data.
    #[must_use]
    pub fn new(notebook_id: impl Into<String>, question: impl Into<String>) -> Self {
        Self {
            question: question.into(),
            notebook_id: Some(notebook_id.into()),
            source_format: Some(SourceFormat::Json.as_str().to_owned()),
            ..Self::default()
        }
    }

    /// Continue an earlier chat instead of starting a new one. Pass the
    /// `session_id` the previous answer carried.
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
        self.source_format = Some(format.as_str().to_owned());
        self
    }
}

impl AskQuestionData {
    /// The quotations behind this answer, or nothing when the question did not
    /// ask for them. Saves callers an `Option` and a `Vec` dance.
    pub fn citations(&self) -> impl Iterator<Item = &AskQuestionDataSourcesCitationsItem> {
        self.sources.citations.iter()
    }
}

impl SearchPassagesRequest {
    /// A search across every source in the notebook.
    #[must_use]
    pub fn new(query: impl Into<String>) -> Self {
        Self {
            query: query.into(),
            ..Self::default()
        }
    }

    /// Keep at most this many passages, best rank first.
    #[must_use]
    pub fn limit(mut self, limit: i64) -> Self {
        self.limit = Some(limit);
        self
    }

    /// Restrict the search to these source ids.
    #[must_use]
    pub fn in_sources(mut self, source_ids: impl IntoIterator<Item = String>) -> Self {
        self.source_ids = Some(source_ids.into_iter().collect());
        self
    }
}
