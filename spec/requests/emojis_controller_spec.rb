# frozen_string_literal: true

require "rails_helper"

RSpec.describe DiscourseChat::EmojisController do
  fab!(:user_1) { Fabricate(:user) }

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
    sign_in(user_1)
  end

  describe "#index" do
    it "returns the emojis list" do
      get "/chat/emojis.json"

      expect(response.status).to eq(200)
      expect(response.parsed_body.keys).to eq(
        %w[
          smileys_&_emotion
          people_&_body
          objects
          travel_&_places
          animals_&_nature
          food_&_drink
          activities
          flags
          symbols
        ],
      )
    end
  end
end