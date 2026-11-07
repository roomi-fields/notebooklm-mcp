# frozen_string_literal: true

require_relative 'test_helper'

# What the client does with what the server says.
class ApiTest < Minitest::Test
  def test_health_reads_the_shape
    StubServer.run({ success: true, data: { status: 'ok', authenticated: true } }) do |client, _|
      health = client.get_health
      assert_equal 'ok', health.status
      assert health.authenticated
    end
  end

  def test_an_absent_scalar_reads_as_nil_not_zero
    StubServer.run({ success: true, data: { status: 'ok' } }) do |client, _|
      # The whole point: a missing count must not read as 0, and a missing
      # offset must not attribute a quotation to the first page.
      assert_nil client.get_health.total_messages
    end
  end

  def test_a_notebook_list_is_an_object_around_an_array
    data = { notebooks: [{ id: 'nb-1', name: 'Thesis' }], count: 1 }
    StubServer.run({ success: true, data: data }) do |client, _|
      library = client.list_notebooks
      assert_equal 1, library.count
      assert_equal 'Thesis', library.notebooks.first.name
      assert_kind_of NotebookLM::ListNotebooksDataNotebooksItem, library.notebooks.first
    end
  end

  def test_an_absent_list_reads_as_empty
    StubServer.run({ success: true, data: { count: 0 } }) do |client, _|
      assert_empty client.list_notebooks.notebooks
    end
  end

  def test_a_question_sends_wire_names_and_omits_what_was_not_given
    StubServer.run({ success: true, data: { answer: 'Yes.' } }) do |client, server|
      client.ask_question(question: 'Is it?', notebook_id: 'nb-1')
      body = server.request.json
      assert_equal({ 'question' => 'Is it?', 'notebook_id' => 'nb-1' }, body)
      assert_equal '/ask', server.request.path
      assert_equal 'POST', server.request.method
    end
  end

  def test_the_short_form_asks_for_quotations_as_data
    StubServer.run({ success: true, data: { answer: 'Yes.' } }) do |client, server|
      client.ask('nb-1', 'Is it?')
      assert_equal 'json', server.request.json['source_format']
    end
  end

  def test_an_unknown_source_format_is_refused_before_the_request
    StubServer.run({ success: true, data: {} }) do |client, server|
      assert_raises(ArgumentError) { client.ask('nb-1', 'Is it?', source_format: 'jsonn') }
      assert_empty server.requests
    end
  end

  def test_citations_are_reachable_in_one_hop
    data = {
      answer: 'Yes.',
      sources: { format: 'json', citations: [{ number: 1, sourceText: 'Because.' }] }
    }
    StubServer.run({ success: true, data: data }) do |client, _|
      citation = client.ask_question(question: 'Is it?').citations.first
      assert_equal 1, citation.number
      assert_equal 'Because.', citation.source_text
    end
  end

  def test_citations_of_an_answer_without_sources_is_an_empty_list
    StubServer.run({ success: true, data: { answer: 'Yes.' } }) do |client, _|
      # A nested shape reads as an empty shape rather than nil, so the chain
      # holds without a guard at every hop.
      assert_empty client.ask_question(question: 'Is it?').citations
    end
  end

  def test_a_possibly_absent_offset_stays_absent
    passages = { passages: [{ text: 'Because.', rank: 1 }] }
    StubServer.run({ success: true, data: passages }) do |client, _|
      passage = client.search_passages(id: 'nb-1', query: 'why').passages.first
      assert_nil passage.start
      assert_nil passage.end_value
      assert_equal 1, passage.rank
    end
  end

  def test_path_parameters_and_query_parameters_reach_the_route
    StubServer.run({ success: true, data: { messages: [] } }) do |client, server|
      client.get_chat_history(id: 'nb-1', limit: 5)
      assert_equal '/notebooks/nb-1/chat', server.request.path
      assert_equal 'limit=5', server.request.query
    end
  end

  def test_a_refusal_carries_the_server_reason
    body = { success: false, error: 'notebook not found' }
    StubServer.run(body, status: 404) do |client, _|
      error = assert_raises(NotebookLM::Refused) { client.list_notebooks }
      assert_equal 'notebook not found', error.reason
      refute_predicate error, :transport?
    end
  end

  def test_success_with_no_payload_is_reported_not_unwrapped
    StubServer.run({ success: true }) do |client, _|
      error = assert_raises(NotebookLM::EmptyPayload) { client.list_notebooks }
      assert_match 'list_notebooks', error.message
    end
  end

  def test_an_unreadable_body_names_the_call
    StubServer.run(raw_body: '<html>not json</html>') do |client, _|
      error = assert_raises(NotebookLM::ShapeError) { client.list_notebooks }
      assert_equal 'list_notebooks', error.route
    end
  end

  def test_nothing_listening_is_a_transport_error
    server = StubServer.new
    base = server.base
    server.close
    client = NotebookLM::Client.new(base: base)
    error = assert_raises(NotebookLM::TransportError) { client.get_health }
    assert_predicate error, :transport?
    assert_equal base, error.base
  end

  def test_the_two_unwrapped_routes_are_read_as_their_own_document
    banner = { name: 'NotebookLM MCP HTTP Server', version: '4.6.0' }
    StubServer.run(banner) do |client, _|
      # No envelope on these: reading them through one fails on a missing
      # `success` field, which is a confusing way to say "never wrapped".
      assert_equal '4.6.0', client.get_server_info.version
    end

    manual = { manual_version: '1.0', tools: [{ name: 'ask_question' }] }
    StubServer.run(manual) do |client, _|
      assert_equal 'ask_question', client.get_utcp_manual.tools.first.name
    end
  end

  def test_an_api_key_travels_as_a_bearer_header_and_is_never_printed
    server = StubServer.new { |_| [200, { success: true, data: { status: 'ok' } }] }
    client = NotebookLM::Client.new(base: server.base, api_key: 's3cret')
    client.get_health
    assert_equal 'Bearer s3cret', server.request.headers['authorization']
    refute_match 's3cret', client.inspect
    assert_match '<redacted>', client.inspect
  ensure
    server&.close
  end

  def test_an_api_key_holding_a_newline_is_refused
    assert_raises(NotebookLM::ApiKeyError) do
      NotebookLM::Client.new(api_key: "key\r\nX-Evil: 1")
    end
  end

  def test_a_field_the_specification_does_not_know_is_still_reachable
    StubServer.run({ success: true, data: { status: 'ok', futureField: 42 } }) do |client, _|
      health = client.get_health
      assert_equal 42, health['futureField']
      assert health.key?('futureField')
      assert_equal({ 'status' => 'ok', 'futureField' => 42 }, health.to_h)
    end
  end

  def test_an_invalid_address_is_reported_as_one
    assert_raises(NotebookLM::AddressError) { NotebookLM::Client.new(base: 'not a url') }
    assert_raises(NotebookLM::AddressError) { NotebookLM::Client.new(base: 'ftp://host/') }
  end

  def test_the_connection_is_reused_across_calls
    server = StubServer.new { |_| [200, { success: true, data: { status: 'ok' } }] }
    client = NotebookLM::Client.new(base: server.base)
    3.times { client.get_health }
    assert_equal 3, server.requests.size
  ensure
    server&.close
  end

  def test_every_operation_of_the_specification_is_callable
    assert_equal 56, NotebookLM::Operations::OPERATION_IDS.size
    NotebookLM::Operations::OPERATION_IDS.each do |id|
      assert_respond_to NotebookLM::Client.new, id
    end
  end

  def test_shapes_compare_by_their_body
    one = NotebookLM::GetHealthData.new({ 'status' => 'ok' })
    two = NotebookLM::GetHealthData.new({ 'status' => 'ok' })
    assert_equal one, two
    refute_equal one, NotebookLM::GetHealthData.new({ 'status' => 'degraded' })
    refute_equal one, NotebookLM::ListNotebooksData.new({ 'status' => 'ok' })
  end
end
