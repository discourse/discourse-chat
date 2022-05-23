# frozen_string_literal: true

DiscoursePluginRegistry.define_register(:chat_markdown_features, Set)

class Plugin::Instance
  def discourse_chat
    DiscourseChatPluginApiExtensions
  end

  module DiscourseChatPluginApiExtensions
    def self.enable_markdown_feature(name)
      DiscoursePluginRegistry.chat_markdown_features << name
    end
  end
end
