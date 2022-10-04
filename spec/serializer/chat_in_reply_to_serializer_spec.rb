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

        expect(subject.as_json[:user][:username]).to eq(I18n.t("chat.deleted_chat_username"))
      end
    end
  end

  describe "#excerpt" do
    it "censors words" do
      watched_word = Fabricate(:watched_word, action: WatchedWord.actions[:censor])
      message = Fabricate(:chat_message, message: "ok #{watched_word.word}")
      serializer = described_class.new(message, scope: guardian, root: nil)

      expect(serializer.as_json[:excerpt]).to eq("ok ■■■■■")
    end
  end
end
