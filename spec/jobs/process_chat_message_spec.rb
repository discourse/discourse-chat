# frozen_string_literal: true

require 'rails_helper'

describe Jobs::ProcessChatMessage do
  fab!(:chat_message) { Fabricate(:chat_message, message: "https://discourse.org/team") }

  it "updates cooked with oneboxes" do
    stub_request(:get, "https://discourse.org/team").
      to_return(status: 200, body: "<html><head><title>a</title></head></html>")

    stub_request(:head, "https://discourse.org/team").
      to_return(status: 200)

    described_class.new.execute(chat_message_id: chat_message.id)
    expect(chat_message.reload.cooked).to eq("<p><a href=\"https://discourse.org/team\" class=\"onebox\" target=\"_blank\" rel=\"noopener nofollow ugc\">https://discourse.org/team</a></p>")
  end
end
