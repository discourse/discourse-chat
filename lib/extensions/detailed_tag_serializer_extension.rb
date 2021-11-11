# frozen_string_literal: true

module DiscourseChat::DetailedTagSerializerExtension
  def self.prepended(base)
    base.attribute :chat_enabled
  end

  def chat_enabled
    ChatChannel.where(chatable_type: "Tag", chatable_id: object.id).exists?
  end
end
