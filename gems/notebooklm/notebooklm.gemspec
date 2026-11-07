# frozen_string_literal: true

require_relative 'lib/notebooklm/version'

Gem::Specification.new do |spec|
  spec.name = 'notebooklm'
  spec.version = NotebookLM::VERSION
  spec.authors = ['Roomi Fields']
  spec.license = 'MIT'

  spec.summary = 'Ruby client for a local Gemini Notebook (NotebookLM) server'
  spec.description = <<~TEXT
    Google ships no public API for the consumer NotebookLM. This gem does not
    own a browser: it talks to the local notebooklm-mcp server that does, and
    gives you its 56 operations as documented Ruby methods, generated from the
    server's OpenAPI specification. No runtime dependencies.
  TEXT

  # The documentation site, not the repository: this is the link RubyGems
  # publishes, and it is the highest-authority page pointing at the docs.
  spec.homepage = 'https://notebooklm.roomi-fields.com/'
  spec.metadata = {
    'homepage_uri' => spec.homepage,
    'source_code_uri' => 'https://github.com/roomi-fields/notebooklm-mcp/tree/main/gems/notebooklm',
    'changelog_uri' => 'https://github.com/roomi-fields/notebooklm-mcp/blob/main/CHANGELOG.md',
    'documentation_uri' => 'https://notebooklm.roomi-fields.com/',
    'wiki_uri' => 'https://github.com/roomi-fields/notebooklm-mcp',
    'bug_tracker_uri' => 'https://github.com/roomi-fields/notebooklm-mcp/issues',
    'rubygems_mfa_required' => 'true'
  }

  spec.required_ruby_version = '>= 3.1'

  spec.files = Dir['lib/**/*.rb'] + ['README.md', 'notebooklm.gemspec']
  spec.require_paths = ['lib']
end
