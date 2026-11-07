# frozen_string_literal: true

module NotebookLM
  # How the quotations behind an answer should come back.
  #
  # The wire takes a string; this is the list the server accepts, so a typo
  # raises here instead of coming back as an answer with no citations.
  SOURCE_FORMATS = %w[none json inline footnotes expanded].freeze

  # The few helpers the generated surface cannot have.
  #
  # Everything else in this gem comes out of the OpenAPI specification, which
  # is what keeps it complete. A generator cannot know that a question usually
  # wants its quotations as data, or that the session id of one answer is the
  # handle for the next — so those live here.
  #
  # There are fewer of these than the Rust crate needs, and that is Ruby's
  # doing: keyword arguments with defaults already read like a builder, so a
  # request object would add nothing.
  module Ergonomics
    # Ask a notebook in the local library, with the quotations returned as
    # data. The long form is {Operations#ask_question}.
    #
    # @param notebook_id [String] a notebook id from {Operations#list_notebooks}
    # @param question [String] the question, in prose
    # @param session_id [String, nil] continue an earlier chat instead of
    #   starting a new one — pass the `session_id` the previous answer carried
    # @param source_format [String] one of {SOURCE_FORMATS}
    # @return [AskQuestionData]
    def ask(notebook_id, question, session_id: nil, source_format: 'json')
      check_source_format(source_format)
      ask_question(
        question: question,
        notebook_id: notebook_id,
        session_id: session_id,
        source_format: source_format
      )
    end

    # The same question, against a notebook that is not in the library.
    #
    # @param notebook_url [String] the notebook's address
    # @param question [String] the question, in prose
    # @param session_id [String, nil] an earlier chat to continue
    # @param source_format [String] one of {SOURCE_FORMATS}
    # @return [AskQuestionData]
    def ask_url(notebook_url, question, session_id: nil, source_format: 'json')
      check_source_format(source_format)
      ask_question(
        question: question,
        notebook_url: notebook_url,
        session_id: session_id,
        source_format: source_format
      )
    end

    private

    def check_source_format(format)
      return if SOURCE_FORMATS.include?(format.to_s)

      raise ArgumentError,
            "source_format must be one of #{SOURCE_FORMATS.join(', ')}, got #{format.inspect}"
    end
  end

  class AskQuestionData
    # The quotations behind this answer, or an empty list when the question
    # did not ask for them. Saves callers one hop through `sources`.
    #
    # @return [Array<AskQuestionDataSourcesCitationsItem>]
    def citations
      sources.citations
    end
  end

  class Client
    include Ergonomics
  end
end
