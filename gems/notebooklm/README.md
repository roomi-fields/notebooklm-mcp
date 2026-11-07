# notebooklm

[![Gem Version](https://img.shields.io/gem/v/notebooklm.svg)](https://rubygems.org/gems/notebooklm)
[![CI](https://github.com/roomi-fields/notebooklm-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/roomi-fields/notebooklm-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Ruby client for **Gemini Notebook** (formerly NotebookLM): citation-backed
answers, passage retrieval, Studio generation, and the whole of a local
server's REST API as documented methods rather than hashes you have to guess at.

## Features

- **All 56 operations**, generated from the server's OpenAPI specification, so
  a route added upstream reaches this gem on the release that ships it —
  rather than whenever someone remembers to add a method.
- **Every shape documented**: each field the specification describes has a
  reader with its type, and a field the server adds later is still reachable
  through `[]` and `to_h`. An unknown shape is never a wall.
- **Citation-backed answers**: `ask` returns the answer and the quoted passage
  behind every marker.
- **Retrieval that spends no allowance**: `search_passages` returns the indexed
  passages for a query without generating anything.
- **The indexed text itself**: `read_source` returns what the service actually
  extracted from a PDF or a page, which the web interface only shows in
  fragments.
- **Studio generation** — audio, video, infographic, report, presentation, data
  table — plus study aids, mind maps, labels and notes.
- **The UTCP manual**: `get_utcp_manual` returns the document a
  [UTCP](https://www.utcp.io/) client reads to call the API with no client at
  all.
- **Honest absence**: a passage with no offset reads as `nil`, never as `0`.
  Guessing a zero is how a quotation gets attributed to the top of a long
  document.
- **A refusal keeps its words**: the server's own explanation travels in
  `NotebookLM::Refused`, and a request that never arrived raises a different
  class from one that was declined — `error.transport?` separates the two.
- **No runtime dependencies.** Net::HTTP and JSON, nothing else. The tests have
  no dependencies either.

## Usage

```ruby
# Gemfile
gem 'notebooklm', '~> 4.7'
```

or `gem install notebooklm`.

```ruby
require 'notebooklm'

client = NotebookLM.local

unless client.get_health.authenticated
  abort 'no Google session yet — run the setup command once'
end

notebook = client.list_notebooks.notebooks.first

# Retrieval: the evidence, with no generation allowance spent.
client.search_passages(id: notebook.id, query: 'ikigai', limit: 5).passages.each do |passage|
  puts "#{passage.rank} — #{passage.text}"
end

# Or an answer, with the quotations behind it.
answer = client.ask(notebook.id, 'How is ikigai defined?')
puts answer.answer
answer.citations.each { |citation| puts "  [#{citation.number}] #{citation.source_text}" }
```

Every operation takes its parameters as keyword arguments under the names the
specification gives them, and returns a shape whose readers are documented:

```ruby
client.ask_question(question: 'How is ikigai defined?', notebook_id: notebook.id,
                    source_format: 'json')
client.generate_report(id: notebook.id, prompt: 'A literature review')
client.get_utcp_manual.tools.size # => 56
```

## It needs a server, and that is deliberate

Google publishes no API for the consumer product. Everything any tool does
rides on the endpoints the web application itself calls, and those require a
logged-in Google session. Keeping one means three things that are easy to
underestimate:

- the session is **bound to the machine** it was created on — copied cookies
  are refused even while their local expiry still looks valid;
- Google **expires sessions server-side** while those cookies look fine, so the
  only reliable check is navigating and seeing where you land;
- an unpatched automated browser **gets flagged**, and the patches have to be
  maintained against a moving target.

So this gem owns no browser. It talks to a process that does:

```bash
npx -y @roomi-fields/notebooklm-mcp                                # the server
npx -y -p @roomi-fields/notebooklm-mcp notebooklm-mcp-setup-auth   # once
```

On loopback the server needs no token. As soon as you expose it, it refuses to
start without one:

```ruby
client = NotebookLM::Client.new(base: 'http://10.0.0.2:3000', api_key: ENV.fetch('NOTEBOOKLM_API_KEY'))
```

`NOTEBOOKLM_API_KEY` and `NOTEBOOKLM_BASE_URL` are read from the environment
when you pass neither. The key is never printed: `inspect` redacts it.

## Errors

```ruby
begin
  client.ask(notebook.id, 'How is ikigai defined?')
rescue NotebookLM::Refused => e
  warn e.reason                      # the server's own words, for a human
rescue NotebookLM::TransportError => e
  retry if (tries += 1) < 3          # nothing arrived; retrying can work
rescue NotebookLM::ShapeError => e
  warn "client and server disagree on #{e.route}"
end
```

`NotebookLM::EmptyPayload` means the server reported success and sent nothing —
its contract breach, reported rather than returned as a `nil` for you to trip
over three lines later.

## Versions

The gem version is the server version it speaks to. There is one release per
server release, and 4.6 works against a 4.6 server; a mismatch is the one thing
this gem cannot check for you.

Ruby **3.1** or later.

## Documentation

- [Server documentation](https://notebooklm.roomi-fields.com/)
- [Driving it from Ruby](https://notebooklm.roomi-fields.com/blog/notebooklm-ruby)
  — why the gem is shaped this way
- [REST API reference](https://notebooklm.roomi-fields.com/notebooklm-rest-api)

## License

MIT. See [LICENSE](https://github.com/roomi-fields/notebooklm-mcp/blob/main/LICENSE).

### Contribution

Issues and pull requests go to
[roomi-fields/notebooklm-mcp](https://github.com/roomi-fields/notebooklm-mcp),
which holds the server and this gem together. The surface is generated: change
`deployment/docs/openapi.yaml` and run `npm run ruby:sync`, never
`lib/notebooklm/generated.rb` by hand.
