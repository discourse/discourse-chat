# frozen_string_literal: true

require "rails_helper"

RSpec.describe ReviewableChatMessage, type: :model do
  fab!(:moderator) { Fabricate(:moderator) }
  fab!(:user) { Fabricate(:user) }
  fab!(:chat_channel) { Fabricate(:chat_channel) }
  fab!(:chat_message) { Fabricate(:chat_message, chat_channel: chat_channel, user: user) }
  fab!(:reviewable) do
    Fabricate(:reviewable_chat_message, target: chat_message, created_by: moderator)
  end

  it "agree_and_keep agrees with the flag and doesn't delete the message" do
    reviewable.perform(moderator, :agree_and_keep_message)

    expect(reviewable).to be_approved
    expect(chat_message.reload.deleted_at).not_to be_present
  end

  it "agree_and_delete agrees with the flag and deletes the message" do
    chat_message_id = chat_message.id
    reviewable.perform(moderator, :agree_and_delete)

    expect(reviewable).to be_approved
    expect(ChatMessage.with_deleted.find_by(id: chat_message_id).deleted_at).to be_present
  end

  it "agree_and_restore agrees with the flag and restores the message" do
    chat_message.trash!(user)
    reviewable.perform(moderator, :agree_and_restore)

    expect(reviewable).to be_approved
    expect(chat_message.reload.deleted_at).not_to be_present
  end

  it "perform_disagree disagrees with the flag and does nothing" do
    reviewable.perform(moderator, :disagree)

    expect(reviewable).to be_rejected
    expect(chat_message.reload.deleted_at).not_to be_present
  end

  it "perform_disagree_and_restore disagrees with the flag and does nothing" do
    chat_message.trash!(user)
    reviewable.perform(moderator, :disagree_and_restore)

    expect(reviewable).to be_rejected
    expect(chat_message.reload.deleted_at).to be_present
  end

  it "perform_ignore ignores the flag and does nothing" do
    reviewable.perform(moderator, :ignore)

    expect(reviewable).to be_ignored
    expect(chat_message.reload.deleted_at).not_to be_present
  end

  describe ".on_score_updated" do
    it "silences the user for the correct time when the threshold is met" do
      SiteSetting.chat_auto_silence_from_flags_duration = 3
      reviewable.update!(score: ReviewableChatMessage.score_to_silence_user + 1)
      expect { ReviewableChatMessage.on_score_updated(reviewable) }.to change {
        user.reload.silenced?
      }.to be true
    end

    it "does nothing if the new score is less than the score to auto-silence" do
      SiteSetting.chat_auto_silence_from_flags_duration = 3
      reviewable.update!(score: ReviewableChatMessage.score_to_silence_user - 1)
      expect { ReviewableChatMessage.on_score_updated(reviewable) }.not_to change {
        user.reload.silenced?
      }
    end

    it "does nothing if the silence duration is set to 0" do
      SiteSetting.chat_auto_silence_from_flags_duration = 0
      reviewable.update!(score: ReviewableChatMessage.score_to_silence_user + 1)
      expect { ReviewableChatMessage.on_score_updated(reviewable) }.not_to change {
        user.reload.silenced?
      }
    end
  end
end
