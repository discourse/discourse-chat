# frozen_string_literal: true

describe DiscourseChat::ChatChannelFetcher do
  describe ".unread_counts" do
    fab!(:user_1) { Fabricate(:user) }
    fab!(:user_2) { Fabricate(:user) }
    fab!(:chat_channel) { Fabricate(:chat_channel) }

    context "user is member of the channel" do
      before do
        Fabricate(:user_chat_channel_membership, chat_channel: chat_channel, user: user_1)
      end

      context "has unread messages" do
        before do
          Fabricate(:chat_message, chat_channel: chat_channel, message: "hi", user: user_2)
          Fabricate(:chat_message, chat_channel: chat_channel, message: "bonjour", user: user_2)
        end

        it "returns the correct count" do
          unread_counts = subject.unread_counts([chat_channel], user_1)
          expect(unread_counts[chat_channel.id]).to eq(2)
        end
      end

      context "has no unread messages" do
        it "returns the correct count" do
          unread_counts = subject.unread_counts([chat_channel], user_1)
          expect(unread_counts[chat_channel.id]).to eq(0)
        end
      end

      context "last unread message has been deleted" do
        fab!(:last_unread) { Fabricate(:chat_message, chat_channel: chat_channel, message: "hi", user: user_2) }

        before do
          last_unread.update!(deleted_at: Time.zone.now)
        end

        it "returns the correct count" do
          unread_counts = subject.unread_counts([chat_channel], user_1)
          expect(unread_counts[chat_channel.id]).to eq(0)
        end
      end
    end

    context "user is not member of the channel" do
      context "the channel has new messages" do
        before do
          Fabricate(:chat_message, chat_channel: chat_channel, message: "hi", user: user_2)
        end

        it "returns the correct count" do
          unread_counts = subject.unread_counts([chat_channel], user_1)
          expect(unread_counts[chat_channel.id]).to eq(0)
        end
      end
    end
  end

  describe ".all_secured_channel_ids" do
    fab!(:category) { Fabricate(:category) }
    fab!(:private_category) { Fabricate(:private_category, group: Fabricate(:group)) }
    fab!(:category_channel) { Fabricate(:chat_channel, chatable: category) }
    fab!(:topic) { Fabricate(:topic) }
    fab!(:topic_channel) { Fabricate(:chat_channel, chatable: topic) }
    fab!(:dm_channel) { Fabricate(:direct_message_channel) }
    fab!(:direct_message_channel) { Fabricate(:chat_channel, chatable: dm_channel) }
    fab!(:user) { Fabricate(:user) }

    before do
      Fabricate(:post, topic: topic)
    end

    def guardian
      Guardian.new(user)
    end

    it "returns nothing by default if the user has no memberships" do
      expect(subject.all_secured_channel_ids(guardian)).to eq([])
    end

    context "when the user has memberships to all the channels" do
      before do
        UserChatChannelMembership.create!(user: user, chat_channel: category_channel, following: true)
        UserChatChannelMembership.create!(user: user, chat_channel: topic_channel, following: true)
        UserChatChannelMembership.create!(
          user: user, chat_channel: direct_message_channel, following: true,
          desktop_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
          mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always]
        )
      end

      it "returns the topic and category channel because they are public by default" do
        expect(subject.all_secured_channel_ids(guardian)).to match_array([topic_channel.id, category_channel.id])
      end

      it "returns all the channels if the user is a member of the DM channel also" do
        DirectMessageUser.create!(user: user, direct_message_channel: dm_channel)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([
          topic_channel.id, category_channel.id, direct_message_channel.id
        ])
      end

      it "does not include the topic channel if the topic is in a private category the user cannot see" do
        topic.update(category: private_category)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([category_channel.id])
        GroupUser.create(group: private_category.groups.last, user: user)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([topic_channel.id, category_channel.id])
      end

      it "does not include the category channel if the category is a private category the user cannot see" do
        category_channel.update(chatable: private_category)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([topic_channel.id])
        GroupUser.create(group: private_category.groups.last, user: user)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([topic_channel.id, category_channel.id])
      end

      it "does not include the topic channel if the topic is a private message the user cannot see" do
        topic.convert_to_private_message(Discourse.system_user)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([category_channel.id])
        TopicAllowedUser.create(topic: topic, user: user)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([topic_channel.id, category_channel.id])
      end
    end
  end
end
