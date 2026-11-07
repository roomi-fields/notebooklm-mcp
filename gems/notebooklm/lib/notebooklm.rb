# frozen_string_literal: true

require_relative 'notebooklm/version'
require_relative 'notebooklm/errors'
require_relative 'notebooklm/model'
require_relative 'notebooklm/client'
require_relative 'notebooklm/generated'
require_relative 'notebooklm/ergonomics'

# A Ruby client for a local Gemini Notebook (NotebookLM) server.
#
# Google ships no public API for the consumer product, and the part that
# cannot live in a gem is the Google session: the login is bound to the machine
# it was made on, the session expires server-side while local cookies still
# look valid, and the browser driving it has to stay patched against
# detection. So this gem does not own a browser. It talks to a process that
# does — `npx -y @roomi-fields/notebooklm-mcp`, listening on loopback — and
# gives you its API with documented shapes instead of raw hashes.
#
# @example
#   client = NotebookLM.local
#   library = client.list_notebooks
#   answer = client.ask(library.notebooks.first.id, 'What is this notebook about?')
#   puts answer.answer
#   answer.citations.each { |c| puts "  [#{c.number}] #{c.source_text}" }
module NotebookLM
  # A client for the usual loopback address and port.
  #
  # @param options [Hash] passed through to {Client#initialize}
  # @return [Client]
  def self.local(**options)
    Client.new(**options)
  end
end
