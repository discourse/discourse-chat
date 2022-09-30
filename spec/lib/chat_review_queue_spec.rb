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

  before do
    chat_channel.add(message_poster)
    chat_channel.add(flagger)
    Group.refresh_automatic_groups!
  end

  describe "#flag_message" do
    it "raises an error when the user is not allowed to flag" do
      UserSilencer.new(flagger).silence

      expect {
        subject.flag_message(message, guardian, ReviewableScore.types[:spam])
      }.to raise_error(Discourse::InvalidAccess)
    end

    it "raises an error if the user already flagged the post" do
      subject.flag_message(message, guardian, ReviewableScore.types[:spam])

      second_flag_result =
        subject.flag_message(message, guardian, ReviewableScore.types[:off_topic])

      expect(second_flag_result[:success]).to eq(false)
      expect(second_flag_result[:errors]).to contain_exactly(I18n.t("reviewables.already_handled"))
    end

    it "raises an error if a different user uses the same flag but we recently handled it" do
      subject.flag_message(message, guardian, ReviewableScore.types[:spam])

      reviewable = ReviewableChatMessage.last
      reviewable.perform(admin, :ignore)

      second_flag_result =
        subject.flag_message(message, admin_guardian, ReviewableScore.types[:spam])

      expect(second_flag_result[:success]).to eq(false)
      expect(second_flag_result[:errors]).to contain_exactly(I18n.t("reviewables.already_handled"))
    end

    it "allow users to re-flag using the same flag type after the cooldown period" do
      subject.flag_message(message, guardian, ReviewableScore.types[:spam])

      reviewable = ReviewableChatMessage.last
      reviewable.perform(admin, :ignore)
      reviewable.update!(updated_at: (SiteSetting.cooldown_hours_until_reflag.to_i + 1).hours.ago)

      second_flag_result = subject.flag_message(message, guardian, ReviewableScore.types[:spam])

      expect(second_flag_result[:success]).to eq(true)
    end

    it "allow users to reflag ignoring the cooldown period if the message was edited" do
      subject.flag_message(message, guardian, ReviewableScore.types[:spam])

      reviewable = ReviewableChatMessage.last
      reviewable.perform(admin, :ignore)
      DiscourseChat::ChatMessageUpdater.update(
        chat_message: message,
        new_content: "I'm editing this message. Please flag it.",
      )

      second_flag_result = subject.flag_message(message, guardian, ReviewableScore.types[:spam])

      expect(second_flag_result[:success]).to eq(true)
    end

    it "creates a new reviewable with an associated score" do
      subject.flag_message(message, guardian, ReviewableScore.types[:spam])

      new_reviewable = ReviewableChatMessage.find_by(target: message)

      expect(new_reviewable).to be_present
      expect(new_reviewable.target_created_by).to eq(message_poster)
      expect(new_reviewable.created_by).to eq(flagger)
      expect(new_reviewable.pending?).to eq(true)

      scores = new_reviewable.reviewable_scores
      expect(scores.size).to eq(1)
      expect(scores.first.reviewable_score_type).to eq(ReviewableScore.types[:spam])
      expect(scores.first.pending?).to eq(true)
    end

    it "appends a new score if the reviewable already exists" do
      subject.flag_message(message, guardian, ReviewableScore.types[:spam])

      second_flagger = Fabricate(:user)
      chat_channel.add(second_flagger)
      guardian_2 = Guardian.new(second_flagger)
      Group.find(Group::AUTO_GROUPS[:trust_level_1]).add(second_flagger)

      subject.flag_message(message, guardian_2, ReviewableScore.types[:off_topic])

      reviewable = ReviewableChatMessage.find_by(target: message)
      scores = reviewable.reviewable_scores

      expect(scores.size).to eq(2)
      expect(scores.map(&:reviewable_score_type)).to contain_exactly(
        *ReviewableScore.types.slice(:off_topic, :spam).values,
      )
    end

    it "publishes a message to the flagger" do
      messages =
        MessageBus
          .track_publish { subject.flag_message(message, guardian, ReviewableScore.types[:spam]) }
          .map(&:data)

      self_flag_msg = messages.detect { |m| m["type"] == "self_flagged" }

      expect(self_flag_msg["user_flag_status"]).to eq(ReviewableScore.statuses[:pending])
      expect(self_flag_msg["chat_message_id"]).to eq(message.id)
    end

    it "publishes a message to tell staff there is a new reviewable" do
      messages =
        MessageBus
          .track_publish { subject.flag_message(message, guardian, ReviewableScore.types[:spam]) }
          .map(&:data)

      flag_msg = messages.detect { |m| m["type"] == "flag" }
      new_reviewable = ReviewableChatMessage.find_by(target: message)

      expect(flag_msg["chat_message_id"]).to eq(message.id)
      expect(flag_msg["reviewable_id"]).to eq(new_reviewable.id)
    end

    let(:flag_message) { "I just flagged your chat message..." }

    context "when creating a notify_user flag" do
      it "creates a companion PM" do
        subject.flag_message(
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
        subject.flag_message(message, guardian, ReviewableScore.types[:notify_user])

        pm_topic =
          Topic.includes(:posts).find_by(user: guardian.user, archetype: Archetype.private_message)

        expect(pm_topic).to be_nil
      end

      it "allow staff to tag PM as a warning" do
        subject.flag_message(
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
          subject.flag_message(
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
        subject.flag_message(
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
        subject.flag_message(
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
        subject.flag_message(
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
              subject.flag_message(
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
        subject.flag_message(message, guardian, ReviewableScore.types[:off_topic])

        reviewable = ReviewableChatMessage.includes(:reviewable_scores).find_by(target: message)
        scores = reviewable.reviewable_scores

        expect(scores.size).to eq(1)
        expect(scores.all?(&:pending?)).to eq(true)

        subject.flag_message(
          message,
          admin_guardian,
          ReviewableScore.types[:spam],
          take_action: true,
        )

        scores = reviewable.reload.reviewable_scores

        expect(scores.size).to eq(2)
        expect(scores.all?(&:agreed?)).to eq(true)
      end

      it "raises an exception if the user is not a staff member" do
        expect do
          subject.flag_message(
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
        subject.flag_message(
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
          subject.flag_message(
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

        subject.flag_message(message, guardian, ReviewableScore.types[:off_topic])

        expect(message_poster.reload.silenced?).to eq(true)
      end

      it "does nothing if the new score is less than the auto-silence threshold" do
        SiteSetting.chat_auto_silence_from_flags_duration = 50

        subject.flag_message(message, guardian, ReviewableScore.types[:off_topic])

        expect(message_poster.reload.silenced?).to eq(false)
      end

      it "does nothing if the silence duration is set to 0" do
        SiteSetting.chat_auto_silence_from_flags_duration = 0
        flagger.update!(trust_level: TrustLevel[4]) # Increase Score due to TL Bonus.

        subject.flag_message(message, guardian, ReviewableScore.types[:off_topic])

        expect(message_poster.reload.silenced?).to eq(false)
      end
    end
  end
end
