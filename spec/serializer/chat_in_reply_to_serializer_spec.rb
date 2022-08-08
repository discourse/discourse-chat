# frozen_string_literal: true

require "rails_helper"

describe ChatInReplyToSerializer do
  fab!(:chat_channel) { Fabricate(:chat_channel) }
  fab!(:message_1) { Fabricate(:chat_message, user: Fabricate(:user), chat_channel: chat_channel) }
  let(:guardian) { Guardian.new(Fabricate(:user)) }

  subject { described_class.new(message_1, scope: guardian, root: nil) }

  describe "#user" do
    context "when user has been destroyed" do
      it "returns a placeholder user" do
        message_1.user.destroy!
        message_1.reload

        expect(subject.as_json[:user][:username]).to eq("deleted")
      end
    end
  end
end
