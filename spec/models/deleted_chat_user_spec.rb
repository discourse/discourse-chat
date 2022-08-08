# frozen_string_literal: true

require "rails_helper"

describe DeletedChatUser do
  describe "#username" do
    it "returns a default username" do
      expect(subject.username).to eq("deleted")
    end
  end

  describe "#avatar_template" do
    it "returns a default path" do
      expect(subject.avatar_template).to eq(
        "/plugins/discourse-chat/images/deleted-chat-user-avatar.png",
      )
    end
  end
end
