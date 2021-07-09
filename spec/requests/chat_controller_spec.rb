# frozen_string_literal: true

require 'rails_helper'
require_relative '../fabricators/chat_channel_fabricator'

RSpec.describe DiscourseChat::ChatController do
  fab!(:user) { Fabricate(:user) }
  fab!(:admin) { Fabricate(:admin) }
  fab!(:topic) { Fabricate(:topic) }
  fab!(:category) { Fabricate(:category) }

  describe "#enable_chat" do
    describe "for topic" do
      it "errors for non-staff" do
        sign_in(user)
        Fabricate(:chat_channel, chatable: topic)
        post "/chat/topic/#{topic.id}/enable.json"
        debugger
        expect(response.status).to eq(404)
      end

      it "enables chat with existing chat_channel" do
        sign_in(admin)
        Fabricate(:chat_channel, chatable: topic)
        post "/chat/topic/#{topic.id}/enable.json"
        expect(response.status).to eq(200)
      end
    end

    describe "for category" do
      it "errors for non-staff" do

      end

      it "enables chat" do

      end
    end
  end
end
