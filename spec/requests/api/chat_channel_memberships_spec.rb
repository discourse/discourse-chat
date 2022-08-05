# frozen_string_literal: true

require "rails_helper"

describe DiscourseChat::Api::ChatChannelMembershipsController do
  fab!(:user_1) { Fabricate(:user) }
  fab!(:user_2) { Fabricate(:user) }
  fab!(:channel_1) { Fabricate(:chat_channel, chatable: Fabricate(:category)) }

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
  end

  describe "#index" do
    include_examples "channel access example", :get, "/memberships.json"

    context "memberships exist" do
      before do
        UserChatChannelMembership.create(user: user_1, chat_channel: channel_1, following: true)
        UserChatChannelMembership.create(
          user: Fabricate(:user),
          chat_channel: channel_1,
          following: false,
        )
        UserChatChannelMembership.create(
          user: user_2,
          chat_channel: channel_1,
          following: true,
        )
        sign_in(user_1)
      end

      it "lists followed memberships" do
        get "/chat/api/chat_channels/#{channel_1.id}/memberships.json"

        expect(response.parsed_body.length).to eq(2)
        expect(response.parsed_body[0]["user"]["id"]).to eq(user_1.id)
        expect(response.parsed_body[1]["user"]["id"]).to eq(user_2.id)
      end
    end
  end
end
