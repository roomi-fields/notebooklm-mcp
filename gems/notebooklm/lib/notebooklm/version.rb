# frozen_string_literal: true

module NotebookLM
  # The gem tracks the server's version on purpose: it is a client for one
  # API, and a reader comparing the two should not have to map between two
  # numbering schemes. Kept in step by `npm run version:sync`.
  VERSION = '4.9.0'
end
