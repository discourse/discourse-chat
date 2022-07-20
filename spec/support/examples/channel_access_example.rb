# frozen_string_literal: true

RSpec.shared_examples "channel access example" do |verb, endpoint|
  endpoint ||= ".json"

  context "channel is not found" do
    before { sign_in(Fabricate(:admin)) }

    it "returns a 404" do
      public_send(verb, "/chat/api/chat_channels/-999#{endpoint}")
      expect(response.status).to eq(404)
    end
  end

  context "anonymous user" do
    fab!(:chat_channel) { Fabricate(:chat_channel) }

    it "returns a 403" do
      public_send(verb, "/chat/api/chat_channels/#{chat_channel.id}#{endpoint}")
      expect(response.status).to eq(403)
    end
  end

  context "channel can’t be seen by current user" do
    fab!(:chatable) { Fabricate(:private_category, group: Fabricate(:group)) }
    fab!(:chat_channel) { Fabricate(:chat_channel, chatable: chatable) }
    fab!(:user) { Fabricate(:user) }
    fab!(:membership) do
      Fabricate(:user_chat_channel_membership, user: user, chat_channel: chat_channel)
    end

    before { sign_in(user) }

    it "returns a 403" do
      public_send(verb, "/chat/api/chat_channels/#{chat_channel.id}#{endpoint}")
      expect(response.status).to eq(403)
    end
  end
end
