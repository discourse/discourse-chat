# frozen_string_literal: true

require "rails_helper"

describe ChatMessageSerializer do
  fab!(:chat_channel) { Fabricate(:chat_channel) }
  fab!(:message_1) { Fabricate(:chat_message, user: Fabricate(:user), chat_channel: chat_channel) }
  let(:guardian) { Guardian.new(Fabricate(:user)) }

  subject { described_class.new(message_1, scope: guardian, root: nil) }

  describe "#reactions" do
    fab!(:custom_emoji) { CustomEmoji.create!(name: "trout", upload: Fabricate(:upload)) }
    fab!(:reaction_1) do
      Fabricate(:chat_message_reaction, chat_message: message_1, emoji: custom_emoji.name)
    end

    context "when an emoji used in a reaction has been destroyed" do
      it "doesn’t return the reaction" do
        Emoji.clear_cache

        expect(subject.as_json[:reactions]["trout"]).to be_present

        custom_emoji.destroy!
        Emoji.clear_cache

        expect(subject.as_json[:reactions]["trout"]).to_not be_present
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

  describe "#user" do
    context "when user has been destroyed" do
      it "returns a placeholder user" do
        message_1.user.destroy!
        message_1.reload

        expect(subject.as_json[:user][:username]).to eq(I18n.t("chat.deleted_chat_username"))
      end
    end
  end

  describe "#deleted_at" do
    context "when user has been destroyed" do
      it "has a deleted at date" do
        message_1.user.destroy!
        message_1.reload

        expect(subject.as_json[:deleted_at]).to(be_within(1.second).of(Time.zone.now))
      end

      it "is marked as deleted by system user" do
        message_1.user.destroy!
        message_1.reload

        expect(subject.as_json[:deleted_by_id]).to eq(Discourse.system_user.id)
      end
    end
  end

  describe "#available_flags" do
    it "returns an empty list if the user already flagged the message" do
      reviewable = Fabricate(:reviewable_chat_message, target: message_1)

      serialized =
        described_class.new(
          message_1,
          scope: guardian,
          root: nil,
          reviewable_ids: {
            message_1.id => reviewable.id,
          },
        ).as_json

      expect(serialized[:available_flags]).to be_empty
    end

    it "doesn't include notify_user for self-flags" do
      guardian_1 = Guardian.new(message_1.user)

      serialized = described_class.new(message_1, scope: guardian_1, root: nil).as_json

      expect(serialized[:available_flags]).not_to include(:notify_user)
    end

    it "doesn't include the notify_user flag for bot messages" do
      message_1.update!(user: Discourse.system_user)

      serialized = described_class.new(message_1, scope: guardian, root: nil).as_json

      expect(serialized[:available_flags]).not_to include(:notify_user)
    end

    it "returns an empty list for anons" do
      serialized = described_class.new(message_1, scope: Guardian.new, root: nil).as_json

      expect(serialized[:available_flags]).to be_empty
    end

    it "returns an empty list for silenced users" do
      guardian.user.update!(silenced_till: 1.month.from_now)

      serialized = described_class.new(message_1, scope: guardian, root: nil).as_json

      expect(serialized[:available_flags]).to be_empty
    end

    it "returns an empty list if the message was deleted" do
      message_1.trash!

      serialized = described_class.new(message_1, scope: guardian, root: nil).as_json

      expect(serialized[:available_flags]).to be_empty
    end

    it "doesn't include notify_user if PMs are disabled" do
      SiteSetting.enable_personal_messages = false

      serialized = described_class.new(message_1, scope: guardian, root: nil).as_json

      expect(serialized[:available_flags]).not_to include(:notify_user)
    end

    it "doesn't include notify_user if flagged TL is not high enough" do
      guardian.user.update!(trust_level: TrustLevel[2])
      SiteSetting.min_trust_to_send_messages = TrustLevel[3]

      serialized = described_class.new(message_1, scope: guardian, root: nil).as_json

      expect(serialized[:available_flags]).not_to include(:notify_user)
    end

    it "returns an empty list if the user needs a higher TL to flag" do
      guardian.user.update!(trust_level: TrustLevel[2])
      SiteSetting.chat_message_flag_allowed_groups = Group::AUTO_GROUPS[:trust_level_3]
      Group.refresh_automatic_groups!

      serialized = described_class.new(message_1, scope: guardian, root: nil).as_json

      expect(serialized[:available_flags]).to be_empty
    end
  end
end
