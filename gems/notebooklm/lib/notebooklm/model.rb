# frozen_string_literal: true

module NotebookLM
  # The base of every shape the server answers with.
  #
  # Ruby has no structs to generate, so a shape is a thin reader over the
  # JSON the server actually sent. Three properties matter:
  #
  # - every field the specification documents has a reader, under its Ruby
  #   name, so the shape is discoverable without reading the wire;
  # - the body is kept verbatim in {#to_h}, and a field the server added
  #   after this version was generated is still reachable with `[]` — an
  #   unknown shape is never a wall;
  # - an absent scalar reads as `nil`, never as `0` or `""`. A default of
  #   zero for a missing offset is how a citation gets attributed to the
  #   first page of a long document.
  #
  # Nested objects read as their own shape even when absent, so a chain like
  # `answer.sources.citations` is safe on an answer that carried no sources.
  class Model
    # @param raw [Hash] the JSON object the server sent
    def initialize(raw = {})
      @raw = raw.is_a?(Hash) ? raw : {}
      @read = {}
    end

    # @return [Hash] the body exactly as the server sent it
    attr_reader :raw
    alias to_h raw

    # Any field, documented or not, under its wire name.
    # @return [Object, nil]
    def [](key)
      @raw[key.to_s]
    end

    # @return [Boolean] whether the server sent this field at all
    def key?(key)
      @raw.key?(key.to_s)
    end

    def ==(other)
      other.instance_of?(self.class) && other.raw == @raw
    end
    alias eql? ==

    def hash
      [self.class, @raw].hash
    end

    def inspect
      "#<#{self.class.name} #{@raw.inspect}>"
    end

    def to_json(*args)
      @raw.to_json(*args)
    end

    class << self
      # Declare one documented field.
      #
      # `type` is a class *name*, not a class: the generated file defines
      # shapes in the order the specification lists them, and a shape can
      # name one that comes later or itself. Resolving the name on first read
      # makes the order irrelevant.
      #
      # @param ruby [Symbol] the reader's name
      # @param wire [String] the key the server uses
      # @param type [String, nil] the nested shape's class name, if any
      # @param array [Boolean] whether the field holds a list
      def field(ruby, wire, type: nil, array: false)
        fields[ruby] = { wire: wire, type: type, array: array }
        define_method(ruby) { read_field(ruby) }
      end

      # @return [Hash{Symbol => Hash}] every declared field of this shape
      def fields
        @fields ||= {}
      end
    end

    private

    def read_field(ruby)
      return @read[ruby] if @read.key?(ruby)

      spec = self.class.fields.fetch(ruby)
      @read[ruby] = coerce(@raw[spec[:wire]], spec)
    end

    def coerce(value, spec)
      type = spec[:type]
      if spec[:array]
        list = value.is_a?(Array) ? value : []
        type ? list.map { |item| resolve(type).new(item) } : list
      elsif type
        # Absent reads as an empty shape rather than nil, so a reader can be
        # chained without a guard at every hop.
        resolve(type).new(value.is_a?(Hash) ? value : {})
      else
        value
      end
    end

    def resolve(name)
      NotebookLM.const_get(name)
    end
  end
end
