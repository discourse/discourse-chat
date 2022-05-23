# frozen_string_literal: true

require 'rails_helper'

describe 'Plugin API for discourse_chat' do
  before do
    SiteSetting.chat_enabled = true
  end

  let(:metadata) do
    metadata = Plugin::Metadata.new
    metadata.name = 'test'
    metadata
  end

  let(:plugin_instance) do
    plugin = Plugin::Instance.new(nil, "/tmp/test.rb")
    plugin.metadata = metadata
    plugin
  end

  context 'discourse_chat.enable_markdown_feature' do
    it 'stores the markdown feature' do
      plugin_instance.discourse_chat.enable_markdown_feature(:foo)

      expect(DiscoursePluginRegistry.chat_markdown_features.include?(:foo)).to be_truthy
    end
  end
end
