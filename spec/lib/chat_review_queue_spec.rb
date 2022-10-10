# frozen_string_literal: true

require "rails_helper"

describe DiscourseChat::ChatReviewQueue do
  fab!(:message_poster) { Fabricate(:user) }
  fab!(:flagger) { Fabricate(:user) }
  fab!(:chat_channel) { Fabricate(:chat_channel) }
  fab!(:message) { Fabricate(:chat_message, user: message_poster, chat_channel: chat_channel) }

  fab!(:admin) { Fabricate(:admin) }
  let(:guardian) { Guardian.new(flagger) }
  let(:admin_guardian) { Guardian.new(admin) }

  subject(:queue) { described_class.new }

  before do
    chat_channel.add(message_poster)
    chat_channel.add(flagger)
    Group.refresh_automatic_groups!
  end

  describe "#flag_message" do
    it "raises an error when the user is not allowed to flag" do
      UserSilencer.new(flagger).silence

      expect { queue.flag_message(message, guardian, ReviewableScore.types[:spam]) }.to raise_error(
        Discourse::InvalidAccess,
      )
    end

    context "when the user already flagged the post" do
      let(:second_flag_result) do
        queue.flag_message(message, guardian, ReviewableScore.types[:off_topic])
      end

      before { queue.flag_message(message, guardian, ReviewableScore.types[:spam]) }

      it "returns an error" do
        expect(second_flag_result).to include success: false,
                errors: [I18n.t("chat.reviewables.message_already_handled")]
      end

      it "returns an error when trying to use notify_moderators and the previous flag is still pending" do
        notify_moderators_result =
          queue.flag_message(
            message,
            guardian,
            ReviewableScore.types[:notify_moderators],
            message: "Look at this please, moderators",
          )

        expect(notify_moderators_result).to include success: false,
                errors: [I18n.t("chat.reviewables.message_already_handled")]
      end
    end

    context "when a different user already flagged the post" do
      let(:second_flag_result) { queue.flag_message(message, admin_guardian, second_flag_type) }

      before { queue.flag_message(message, guardian, ReviewableScore.types[:spam]) }

      it "appends a new score to the existing reviewable" do
        second_flag_result =
          queue.flag_message(message, admin_guardian, ReviewableScore.types[:off_topic])
        expect(second_flag_result).to include success: true

        reviewable = ReviewableChatMessage.find_by(target: message)
        scores = reviewable.reviewable_scores

        expect(scores.size).to eq(2)
        expect(scores.map(&:reviewable_score_type)).to contain_exactly(
          *ReviewableScore.types.slice(:off_topic, :spam).values,
        )
      end

      it "returns an error when someone already used the same flag type" do
        second_flag_result =
          queue.flag_message(message, admin_guardian, ReviewableScore.types[:spam])

        expect(second_flag_result).to include success: false,
                errors: [I18n.t("chat.reviewables.message_already_handled")]
      end
    end

    context "when a flags exists but staff already handled it" do
      let(:second_flag_result) do
        queue.flag_message(message, guardian, ReviewableScore.types[:off_topic])
      end

      before do
        queue.flag_message(message, guardian, ReviewableScore.types[:spam])

        reviewable = ReviewableChatMessage.last
        reviewable.perform(admin, :ignore)
      end

      it "raises an error when we are inside the cooldown window" do
        expect(second_flag_result).to include success: false,
                errors: [I18n.t("chat.reviewables.message_already_handled")]
      end

      it "allows the user to re-flag after the cooldown period" do
        reviewable = ReviewableChatMessage.last
        reviewable.update!(updated_at: (SiteSetting.cooldown_hours_until_reflag.to_i + 1).hours.ago)

        expect(second_flag_result).to include success: true
      end

      it "ignores the cooldown window when the message is edited" do
        DiscourseChat::ChatMessageUpdater.update(
          chat_message: message,
          new_content: "I'm editing this message. Please flag it.",
        )

        expect(second_flag_result).to include success: true
      end

      it "ignores the cooldown window when using the notify_moderators flag type" do
        notify_moderators_result =
          queue.flag_message(
            message,
            guardian,
            ReviewableScore.types[:notify_moderators],
            message: "Look at this please, moderators",
          )

        expect(notify_moderators_result).to include success: true
      end
    end

    it "publishes a message to the flagger" do
      messages =
        MessageBus
          .track_publish { queue.flag_message(message, guardian, ReviewableScore.types[:spam]) }
          .map(&:data)

      self_flag_msg = messages.detect { |m| m["type"] == "self_flagged" }

      expect(self_flag_msg["user_flag_status"]).to eq(ReviewableScore.statuses[:pending])
      expect(self_flag_msg["chat_message_id"]).to eq(message.id)
    end

    it "publishes a message to tell staff there is a new reviewable" do
      messages =
        MessageBus
          .track_publish { queue.flag_message(message, guardian, ReviewableScore.types[:spam]) }
          .map(&:data)

      flag_msg = messages.detect { |m| m["type"] == "flag" }
      new_reviewable = ReviewableChatMessage.find_by(target: message)

      expect(flag_msg["chat_message_id"]).to eq(message.id)
      expect(flag_msg["reviewable_id"]).to eq(new_reviewable.id)
    end

    let(:flag_message) { "I just flagged your chat message..." }

    context "when creating a notify_user flag" do
      it "creates a companion PM" do
        queue.flag_message(
          message,
          guardian,
          ReviewableScore.types[:notify_user],
          message: flag_message,
        )

        pm_topic =
          Topic.includes(:posts).find_by(user: guardian.user, archetype: Archetype.private_message)
        pm_post = pm_topic.first_post

        expect(pm_topic.allowed_users).to include(message.user)
        expect(pm_topic.subtype).to eq(TopicSubtype.notify_user)
        expect(pm_post.raw).to include(flag_message)
        expect(pm_topic.title).to eq("Your chat message in \"#{chat_channel.title(message.user)}\"")
      end

      it "doesn't create a PM if there is no message" do
        queue.flag_message(message, guardian, ReviewableScore.types[:notify_user])

        pm_topic =
          Topic.includes(:posts).find_by(user: guardian.user, archetype: Archetype.private_message)

        expect(pm_topic).to be_nil
      end

      it "allow staff to tag PM as a warning" do
        queue.flag_message(
          message,
          admin_guardian,
          ReviewableScore.types[:notify_user],
          message: flag_message,
          is_warning: true,
        )

        expect(UserWarning.exists?(user: message.user)).to eq(true)
      end

      it "only allows staff members to send warnings" do
        expect do
          queue.flag_message(
            message,
            guardian,
            ReviewableScore.types[:notify_user],
            message: flag_message,
            is_warning: true,
          )
        end.to raise_error(Discourse::InvalidAccess)
      end
    end

    context "when creating a notify_moderators flag" do
      it "creates a companion PM and gives moderators access to it" do
        queue.flag_message(
          message,
          guardian,
          ReviewableScore.types[:notify_moderators],
          message: flag_message,
        )

        pm_topic =
          Topic.includes(:posts).find_by(user: guardian.user, archetype: Archetype.private_message)
        pm_post = pm_topic.first_post

        expect(pm_topic.allowed_groups).to contain_exactly(Group[:moderators])
        expect(pm_topic.subtype).to eq(TopicSubtype.notify_moderators)
        expect(pm_post.raw).to include(flag_message)
        expect(pm_topic.title).to eq(
          "A chat message in \"#{chat_channel.title(message.user)}\" requires staff attention",
        )
      end

      it "ignores the is_warning flag when notifying moderators" do
        queue.flag_message(
          message,
          guardian,
          ReviewableScore.types[:notify_moderators],
          message: flag_message,
          is_warning: true,
        )

        expect(UserWarning.exists?(user: message.user)).to eq(false)
      end
    end

    context "when immediately taking action" do
      it "agrees with the flag and deletes the chat message" do
        queue.flag_message(
          message,
          admin_guardian,
          ReviewableScore.types[:off_topic],
          take_action: true,
        )

        reviewable = ReviewableChatMessage.find_by(target: message)

        expect(reviewable.approved?).to eq(true)
        expect(message.reload.trashed?).to eq(true)
      end

      it "publishes an when deleting the message" do
        messages =
          MessageBus
            .track_publish do
              queue.flag_message(
                message,
                admin_guardian,
                ReviewableScore.types[:off_topic],
                take_action: true,
              )
            end
            .map(&:data)

        delete_msg = messages.detect { |m| m[:type] == "delete" }

        expect(delete_msg[:deleted_id]).to eq(message.id)
      end

      it "agrees with other flags on the same message" do
        queue.flag_message(message, guardian, ReviewableScore.types[:off_topic])

        reviewable = ReviewableChatMessage.includes(:reviewable_scores).find_by(target: message)
        scores = reviewable.reviewable_scores

        expect(scores.size).to eq(1)
        expect(scores.all?(&:pending?)).to eq(true)

        queue.flag_message(message, admin_guardian, ReviewableScore.types[:spam], take_action: true)

        scores = reviewable.reload.reviewable_scores

        expect(scores.size).to eq(2)
        expect(scores.all?(&:agreed?)).to eq(true)
      end

      it "raises an exception if the user is not a staff member" do
        expect do
          queue.flag_message(
            message,
            guardian,
            ReviewableScore.types[:off_topic],
            take_action: true,
          )
        end.to raise_error(Discourse::InvalidAccess)
      end
    end

    context "when queueing for review" do
      it "sets a reason on the score" do
        queue.flag_message(
          message,
          admin_guardian,
          ReviewableScore.types[:off_topic],
          queue_for_review: true,
        )

        reviewable = ReviewableChatMessage.includes(:reviewable_scores).find_by(target: message)
        score = reviewable.reviewable_scores.first

        expect(score.reason).to eq("chat_message_queued_by_staff")
      end

      it "only allows staff members to queue for review" do
        expect do
          queue.flag_message(
            message,
            guardian,
            ReviewableScore.types[:off_topic],
            queue_for_review: true,
          )
        end.to raise_error(Discourse::InvalidAccess)
      end
    end

    context "when the auto silence threshold is met" do
      it "silences the user" do
        SiteSetting.chat_auto_silence_from_flags_duration = 1
        flagger.update!(trust_level: TrustLevel[4]) # Increase Score due to TL Bonus.

        queue.flag_message(message, guardian, ReviewableScore.types[:off_topic])

        expect(message_poster.reload.silenced?).to eq(true)
      end

      it "does nothing if the new score is less than the auto-silence threshold" do
        SiteSetting.chat_auto_silence_from_flags_duration = 50

        queue.flag_message(message, guardian, ReviewableScore.types[:off_topic])

        expect(message_poster.reload.silenced?).to eq(false)
      end

      it "does nothing if the silence duration is set to 0" do
        SiteSetting.chat_auto_silence_from_flags_duration = 0
        flagger.update!(trust_level: TrustLevel[4]) # Increase Score due to TL Bonus.

        queue.flag_message(message, guardian, ReviewableScore.types[:off_topic])

        expect(message_poster.reload.silenced?).to eq(false)
      end
    end
  end
end