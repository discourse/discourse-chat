# frozen_string_literal: true

require 'rails_helper'

describe SiteSerializer do
  fab!(:user) { Fabricate(:user) }
  fab!(:guardian) { Guardian.new(user) }

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
  end

  after do
    Site.clear_cache
  end

  it 'should not return attributes for chat when not enabled' do
    SiteSetting.chat_enabled = false

    payload = SiteSerializer.new(Site.new(guardian), scope: guardian, root: false).as_json

    expect(payload[:chat_pretty_text_markdown_rules]).to eq(nil)
    expect(payload[:chat_pretty_text_features]).to eq(nil)
  end

  it 'should not return attributes for chat when user is not allowed to chat' do
    SiteSetting.chat_allowed_groups = ""

    payload = SiteSerializer.new(Site.new(guardian), scope: guardian, root: false).as_json

    expect(payload[:chat_pretty_text_markdown_rules]).to eq(nil)
    expect(payload[:chat_pretty_text_features]).to eq(nil)
  end

  it 'should return the right attributes for chat for user allowed to chat' do
    payload = SiteSerializer.new(Site.new(guardian), scope: guardian, root: false).as_json

    expect(payload[:chat_pretty_text_markdown_rules]).to be_present
    expect(payload[:chat_pretty_text_features]).to be_present
  end
end
