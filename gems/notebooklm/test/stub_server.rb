# frozen_string_literal: true

require 'json'
require 'socket'

# A one-connection HTTP server, in the standard library.
#
# The gem has no runtime dependencies, and its tests have none either: a stub
# built out of `TCPServer` exercises the real Net::HTTP path — connection
# reuse, headers, chunk-free bodies — where a mocking library would replace
# exactly the part worth testing.
class StubServer
  Request = Struct.new(:method, :path, :query, :headers, :body) do
    # @return [Object, nil] the request body, parsed
    def json
      body.to_s.empty? ? nil : JSON.parse(body)
    end
  end

  # @return [Array<Request>] every request received, in order
  attr_reader :requests

  def initialize(&handler)
    @server = TCPServer.new('127.0.0.1', 0)
    @requests = []
    @mutex = Mutex.new
    @handler = handler || ->(_request) { [200, { success: true, data: {} }] }
    @thread = Thread.new { accept_loop }
    @thread.abort_on_exception = true
  end

  def port
    @server.addr[1]
  end

  def base
    "http://127.0.0.1:#{port}"
  end

  # @return [Request] the only request received, failing loudly otherwise
  def request
    @mutex.synchronize do
      raise "expected one request, received #{@requests.size}" unless @requests.size == 1

      @requests.first
    end
  end

  def close
    @thread.kill
    @server.close
  rescue IOError
    nil
  end

  # Run a client against a stub that answers with `response`, then close both.
  def self.run(response = nil, status: 200, raw_body: nil)
    server = new do |_request|
      raw_body ? [status, raw_body] : [status, response]
    end
    client = NotebookLM::Client.new(base: server.base)
    yield client, server
  ensure
    server&.close
  end

  private

  def accept_loop
    loop do
      socket = @server.accept
      serve(socket)
    end
  rescue IOError, Errno::EBADF
    nil
  end

  def serve(socket)
    loop do
      request = read_request(socket)
      break unless request

      @mutex.synchronize { @requests << request }
      status, body = @handler.call(request)
      write_response(socket, status, body)
    end
  rescue Errno::EPIPE, Errno::ECONNRESET, IOError
    nil
  ensure
    socket.close
  end

  def read_request(socket)
    line = socket.gets
    return nil if line.nil?

    method, target, = line.split(' ')
    headers = {}
    while (header = socket.gets) && header != "\r\n"
      name, value = header.split(':', 2)
      headers[name.downcase] = value.to_s.strip
    end
    length = headers['content-length'].to_i
    body = length.positive? ? socket.read(length) : nil
    path, query = target.split('?', 2)
    Request.new(method, path, query, headers, body)
  end

  def write_response(socket, status, body)
    payload = body.is_a?(String) ? body : JSON.generate(body)
    socket.write(
      "HTTP/1.1 #{status} #{status == 200 ? 'OK' : 'Error'}\r\n" \
      "Content-Type: application/json\r\n" \
      "Content-Length: #{payload.bytesize}\r\n" \
      "\r\n#{payload}"
    )
  end
end
