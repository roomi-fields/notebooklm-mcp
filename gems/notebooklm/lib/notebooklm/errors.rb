# frozen_string_literal: true

module NotebookLM
  # What can go wrong between a Ruby program and the local server.
  #
  # The subclasses separate three situations a single error class usually
  # blurs: the request never arrived, the server refused the request and said
  # why, and the server answered in a shape we cannot read. Only the second is
  # the caller's fault, and only the third is ours.
  class Error < StandardError
    # True when retrying could plausibly succeed. A refusal is not retryable:
    # the server already decided.
    def transport?
      false
    end
  end

  # The request never completed: nothing listening, a timeout, a broken pipe.
  class TransportError < Error
    # @return [String] the address the client was pointed at
    attr_reader :base

    # @return [StandardError] what the HTTP stack reported
    attr_reader :cause_error

    def initialize(base, cause_error)
      @base = base
      @cause_error = cause_error
      super("the server at #{base} could not be reached: #{cause_error.message}")
    end

    def transport?
      true
    end
  end

  # The server answered the envelope with `success: false` and a reason. The
  # reason is the server's own wording, meant to be shown to a human.
  class Refused < Error
    # @return [String] the server's reason
    attr_reader :reason

    def initialize(reason)
      @reason = reason
      super("the server refused the request: #{reason}")
    end
  end

  # The server reported success but sent no payload — a contract breach on its
  # side, reported rather than returned as nil for the caller to trip over.
  class EmptyPayload < Error
    def initialize(route)
      super("the server reported success with no payload for #{route}")
    end
  end

  # The body did not match the shape this version of the client expects, which
  # usually means the client and the server are different versions.
  class ShapeError < Error
    # @return [String] which call could not be read
    attr_reader :route

    def initialize(route, detail)
      @route = route
      super("could not read the server's answer to #{route}: #{detail}")
    end
  end

  # The base address could not be parsed, or a route could not be joined onto it.
  class AddressError < Error; end

  # The api key held a byte that cannot travel in an HTTP header. Caught here
  # rather than sent, because a stray newline in a header is a request
  # smuggling primitive, not a typo.
  class ApiKeyError < Error
    def initialize
      super('the api key cannot be sent as a header: it holds a newline or a control byte')
    end
  end
end
