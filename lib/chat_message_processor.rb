# frozen_string_literal: true

class DiscourseChat::ChatMessageProcessor
  include ::PostProcessorMixin

  def initialize(chat_message, has_oneboxes: false)
    @post = chat_message
    @has_oneboxes = has_oneboxes
    @previous_cooked = (chat_message.cooked || "").dup
    @cateogry_id = nil
    @with_secure_media = false
    @size_cache = {}
    @opts = {}

    cooked = ChatMessage.cook(chat_message.message)
    @doc = Loofah.fragment(cooked)
  end

  def run!
    post_process_oneboxes
  end

  def large_images
    []
  end

  def broken_images
    []
  end

  def downloaded_images
    {}
  end
end
