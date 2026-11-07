# frozen_string_literal: true

require 'json'
require 'net/http'
require 'uri'

module NotebookLM
  # A client for one local server.
  #
  # Every operation lives in {Operations}, generated from the server's OpenAPI
  # specification. This class is only the plumbing underneath: where to send a
  # request, how to carry the token, and how to turn the envelope into either a
  # shape or an error.
  #
  # @example
  #   client = NotebookLM::Client.new
  #   client.get_health.authenticated # => true
  class Client
    # Where the server listens when nothing says otherwise.
    DEFAULT_BASE = 'http://127.0.0.1:3000'

    # A question can legitimately take minutes, and Net::HTTP would otherwise
    # give up after sixty seconds — reporting a timeout for a call that was
    # working.
    DEFAULT_READ_TIMEOUT = 300

    # @return [String] the address this client talks to
    attr_reader :base

    # @param base [String] where the server listens
    # @param api_key [String, nil] the token the server requires as soon as it
    #   is exposed beyond loopback. Defaults to `NOTEBOOKLM_API_KEY`, and is
    #   never printed by {#inspect}.
    # @param read_timeout [Numeric] how long to wait for one answer
    # @param open_timeout [Numeric] how long to wait for the connection
    def initialize(base: nil, api_key: :from_env, read_timeout: DEFAULT_READ_TIMEOUT,
                   open_timeout: 10)
      @base = base || ENV['NOTEBOOKLM_BASE_URL'] || DEFAULT_BASE
      @api_key = api_key == :from_env ? ENV.fetch('NOTEBOOKLM_API_KEY', nil) : api_key
      raise ApiKeyError if @api_key && @api_key.match?(/[\u0000-\u001f\u007f]/)

      @uri = parse_base(@base)
      @read_timeout = read_timeout
      @open_timeout = open_timeout
      @mutex = Mutex.new
    end

    # The api key is held here, so a printed client would leak it.
    def inspect
      "#<#{self.class.name} base=#{@base.inspect} api_key=#{@api_key ? '<redacted>' : 'nil'}>"
    end

    # One request, for the generated surface: the route, an optional body, an
    # optional query block, and the envelope unwrapped.
    #
    # `route` is only ever used to say which call could not be read, which is
    # the difference between "the server changed" and "my code is wrong".
    #
    # @api private
    def call(route, method, path, body: nil, query: nil, enveloped: true)
      response = perform(route, method, path, body, query)
      payload = parse(route, response)
      return payload unless enveloped

      unwrap(route, payload)
    end

    private

    def parse_base(base)
      uri = URI.parse(base)
      raise AddressError, "invalid server address: #{base}" unless uri.is_a?(URI::HTTP)

      uri
    rescue URI::InvalidURIError => e
      raise AddressError, "invalid server address: #{base} (#{e.message})"
    end

    METHODS = {
      get: Net::HTTP::Get,
      post: Net::HTTP::Post,
      put: Net::HTTP::Put,
      patch: Net::HTTP::Patch,
      delete: Net::HTTP::Delete
    }.freeze
    private_constant :METHODS

    def perform(route, method, path, body, query)
      target = route_uri(path, query)
      request = METHODS.fetch(method).new(target)
      request['Accept'] = 'application/json'
      request['User-Agent'] = "notebooklm-ruby/#{VERSION}"
      request['Authorization'] = "Bearer #{@api_key}" if @api_key
      if body
        request['Content-Type'] = 'application/json'
        request.body = JSON.generate(body)
      end
      send_request(request)
    rescue KeyError
      raise ShapeError.new(route, "no such HTTP method: #{method}")
    end

    def send_request(request)
      @mutex.synchronize { http.request(request) }
    rescue StandardError => e
      raise TransportError.new(@base, e)
    end

    # One connection, reused. Net::HTTP is not thread-safe, so the mutex above
    # serialises calls rather than pretending otherwise.
    def http
      return @http if @http&.started?

      @http = Net::HTTP.new(@uri.host, @uri.port)
      @http.use_ssl = @uri.scheme == 'https'
      @http.read_timeout = @read_timeout
      @http.open_timeout = @open_timeout
      @http.start
      @http
    end

    def route_uri(path, query)
      uri = @uri.merge(path)
      pairs = (query || {}).reject { |_, value| value.nil? }
      uri.query = URI.encode_www_form(pairs) unless pairs.empty?
      uri
    rescue URI::Error => e
      raise AddressError, "could not join #{path} onto #{@base} (#{e.message})"
    end

    def parse(route, response)
      body = response.body.to_s
      raise ShapeError.new(route, "the server answered #{response.code} with an empty body") if body.empty?

      JSON.parse(body)
    rescue JSON::ParserError => e
      raise ShapeError.new(route, e.message)
    end

    # The envelope carries the refusal, so the HTTP status is not consulted: a
    # refused call answers 4xx *and* `success: false`, and the body is the half
    # that says why.
    def unwrap(route, payload)
      raise ShapeError.new(route, 'the answer was not a JSON object') unless payload.is_a?(Hash)

      data = payload['data']
      reason = payload['error']
      return data if payload['success'] == true && !data.nil?
      raise Refused, reason.to_s unless reason.nil?

      raise EmptyPayload, route
    end
  end
end
