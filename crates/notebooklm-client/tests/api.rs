//! The client against a stubbed server.
//!
//! Each test pins one thing that was either a real trap in the API or a shape
//! a careless client would get wrong: the envelope that carries a refusal, the
//! wire names that differ from Rust habit, the offset that is absent rather
//! than zero, and the one document that is not wrapped at all.

use notebooklm::{AskRequest, Client, Error, SearchRequest};
use wiremock::matchers::{body_json, header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

async fn server() -> MockServer {
    MockServer::start().await
}

fn client(server: &MockServer) -> Client {
    Client::new(server.uri()).expect("the mock server's address parses")
}

#[tokio::test]
async fn health_reports_the_session_not_the_build() {
    let server = server().await;
    Mock::given(method("GET"))
        .and(path("/health"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "success": true,
            "data": {
                "status": "ok",
                "authenticated": false,
                "active_sessions": 0,
                "max_sessions": 10,
            }
        })))
        .mount(&server)
        .await;

    let health = client(&server).health().await.unwrap();
    assert_eq!(health.status, "ok");
    assert!(!health.authenticated);
    assert_eq!(health.max_sessions, 10);
}

#[tokio::test]
async fn a_refusal_keeps_the_server_s_own_wording() {
    let server = server().await;
    Mock::given(method("GET"))
        .and(path("/notebooks"))
        .respond_with(ResponseTemplate::new(400).set_body_json(serde_json::json!({
            "success": false,
            "error": "Notebook not found: ikigai"
        })))
        .mount(&server)
        .await;

    let error = client(&server).library().await.unwrap_err();
    match error {
        Error::Refused(reason) => assert_eq!(reason, "Notebook not found: ikigai"),
        other => panic!("expected a refusal, got {other:?}"),
    }
    // A refusal is a decision, not a hiccup: retrying it is pointless.
    assert!(!Error::Refused(String::new()).is_transport());
}

#[tokio::test]
async fn success_with_no_payload_is_reported_not_unwrapped() {
    let server = server().await;
    Mock::given(method("GET"))
        .and(path("/health"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!({ "success": true })),
        )
        .mount(&server)
        .await;

    assert!(matches!(
        client(&server).health().await.unwrap_err(),
        Error::EmptyPayload
    ));
}

#[tokio::test]
async fn the_library_is_an_object_around_an_array() {
    let server = server().await;
    Mock::given(method("GET"))
        .and(path("/notebooks"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "success": true,
            "data": {
                "notebooks": [{
                    "id": "ikigai",
                    "name": "Ikigai",
                    "url": "https://notebooklm.google.com/notebook/abc",
                    "description": "",
                    "topics": [],
                }],
                "active_notebook_id": "ikigai",
            }
        })))
        .mount(&server)
        .await;

    let library = client(&server).library().await.unwrap();
    assert_eq!(library.notebooks.len(), 1);
    assert_eq!(library.notebooks[0].name, "Ikigai");
    assert_eq!(library.active_notebook_id.as_deref(), Some("ikigai"));
}

#[tokio::test]
async fn asking_sends_the_json_source_format_and_reads_the_citations() {
    let server = server().await;
    Mock::given(method("POST"))
        .and(path("/ask"))
        .and(body_json(serde_json::json!({
            "question": "What is ikigai?",
            "notebook_id": "ikigai",
            "source_format": "json",
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "success": true,
            "data": {
                "answer": "The intersection of what you love[1] and what the world needs.",
                "session_id": "9a580eee",
                "notebook_url": "https://notebooklm.google.com/notebook/abc",
                "sources": {
                    "format": "json",
                    "extraction_success": true,
                    "citations": [
                        { "marker": "[1]", "number": 1, "sourceText": "Ikigai is described as..." }
                    ]
                }
            }
        })))
        .mount(&server)
        .await;

    let answer = client(&server)
        .ask(&AskRequest::new("ikigai", "What is ikigai?"))
        .await
        .unwrap();
    assert_eq!(answer.session_id, "9a580eee");

    let citations: Vec<_> = answer.citations().collect();
    assert_eq!(citations.len(), 1);
    assert_eq!(citations[0].number, 1);
    // The wire name is `sourceText`; the trap is reading it as `source_text`.
    assert!(citations[0].source_text.starts_with("Ikigai is described"));
}

#[tokio::test]
async fn an_answer_without_sources_yields_no_citations() {
    let server = server().await;
    Mock::given(method("POST"))
        .and(path("/ask"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "success": true,
            "data": {
                "answer": "Plain text.",
                "session_id": "s",
                "notebook_url": "u",
            }
        })))
        .mount(&server)
        .await;

    let answer = client(&server)
        .ask(&AskRequest::new("n", "q"))
        .await
        .unwrap();
    assert_eq!(answer.citations().count(), 0);
}

#[tokio::test]
async fn a_passage_starting_at_zero_arrives_with_no_offset() {
    let server = server().await;
    Mock::given(method("POST"))
        .and(path("/notebooks/nb/search"))
        .and(body_json(serde_json::json!({ "query": "ikigai", "limit": 2 })))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "success": true,
            "data": {
                "notebookId": "nb",
                "query": "ikigai",
                "count": 2,
                "passages": [
                    { "sourceId": "s1", "text": "first", "rank": 0 },
                    { "sourceId": "s2", "text": "second", "rank": 1, "start": 4821, "end": 4903 }
                ]
            }
        })))
        .mount(&server)
        .await;

    let found = client(&server)
        .search_passages("nb", &SearchRequest::new("ikigai").limit(2))
        .await
        .unwrap();
    assert_eq!(found.notebook_id, "nb");
    // Absent is reported as absent. Guessing zero is how a quotation gets
    // attributed to the top of a long document.
    assert_eq!(found.passages[0].start, None);
    assert_eq!(found.passages[1].start, Some(4821));
}

#[tokio::test]
async fn restricting_a_search_omits_the_empty_filters() {
    let server = server().await;
    Mock::given(method("POST"))
        .and(path("/notebooks/nb/search"))
        .and(body_json(serde_json::json!({
            "query": "ikigai",
            "source_ids": ["s1"],
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "success": true,
            "data": { "notebookId": "nb", "query": "ikigai", "count": 0, "passages": [] }
        })))
        .mount(&server)
        .await;

    let request = SearchRequest::new("ikigai").in_sources(["s1".to_string()]);
    assert!(client(&server)
        .search_passages("nb", &request)
        .await
        .is_ok());
}

#[tokio::test]
async fn the_manual_is_not_wrapped_in_the_envelope() {
    let server = server().await;
    Mock::given(method("GET"))
        .and(path("/utcp"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "utcp_version": "1.0.0",
            "manual_version": "4.6.0",
            "tools": [{
                "name": "ask_question",
                "description": "Ask a question",
                "tool_call_template": {
                    "call_template_type": "http",
                    "http_method": "POST",
                    "url": "http://127.0.0.1:3000/ask",
                },
            }]
        })))
        .mount(&server)
        .await;

    let manual = client(&server).manual().await.unwrap();
    assert_eq!(manual.manual_version, "4.6.0");
    assert_eq!(manual.tools[0].name, "ask_question");
    assert_eq!(manual.tools[0].tool_call_template.http_method, "POST");
}

#[tokio::test]
async fn the_api_key_travels_as_a_bearer_header() {
    let server = server().await;
    Mock::given(method("GET"))
        .and(path("/health"))
        .and(header("authorization", "Bearer s3cret"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "success": true,
            "data": {
                "status": "ok", "authenticated": true,
                "active_sessions": 1, "max_sessions": 10,
            }
        })))
        .mount(&server)
        .await;

    let client = Client::builder()
        .base(server.uri())
        .api_key("s3cret")
        .build()
        .unwrap();
    assert!(client.health().await.unwrap().authenticated);
    // And it is never printed.
    assert!(!format!("{client:?}").contains("s3cret"));
}

#[tokio::test]
async fn a_server_that_is_not_running_is_a_transport_error() {
    // Port 1 is privileged and unbound: nothing will answer.
    let client = Client::new("http://127.0.0.1:1").unwrap();
    let error = client.health().await.unwrap_err();
    assert!(error.is_transport(), "got {error:?}");
    assert!(error.to_string().contains("127.0.0.1:1"));
}

#[test]
fn a_bad_address_is_refused_at_construction() {
    assert!(matches!(
        Client::new("not a url").unwrap_err(),
        Error::Address(_)
    ));
}
