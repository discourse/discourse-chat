# frozen_string_literal: true

describe DiscourseChat::ChatChannelFetcher do
  fab!(:category) { Fabricate(:category, name: "support") }
  fab!(:private_category) { Fabricate(:private_category, group: Fabricate(:group)) }
  fab!(:category_channel) { Fabricate(:chat_channel, chatable: category) }
  fab!(:topic) { Fabricate(:topic, title: "Some fast moving topic") }
  fab!(:first_post) { Fabricate(:post, topic: topic) }
  fab!(:topic_channel) { Fabricate(:chat_channel, chatable: topic) }
  fab!(:dm_channel) { Fabricate(:direct_message_channel) }
  fab!(:direct_message_channel) { Fabricate(:chat_channel, chatable: dm_channel) }
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }

  def guardian
    Guardian.new(user1)
  end

  def memberships
    UserChatChannelMembership.where(user: user1)
  end

  describe ".unread_counts" do
    context "user is member of the channel" do
      before do
        Fabricate(:user_chat_channel_membership, chat_channel: topic_channel, user: user1)
      end

      context "has unread messages" do
        before do
          Fabricate(:chat_message, chat_channel: topic_channel, message: "hi", user: user2)
          Fabricate(:chat_message, chat_channel: topic_channel, message: "bonjour", user: user2)
        end

        it "returns the correct count" do
          unread_counts = subject.unread_counts([topic_channel], user1)
          expect(unread_counts[topic_channel.id]).to eq(2)
        end
      end

      context "has no unread messages" do
        it "returns the correct count" do
          unread_counts = subject.unread_counts([topic_channel], user1)
          expect(unread_counts[topic_channel.id]).to eq(0)
        end
      end

      context "last unread message has been deleted" do
        fab!(:last_unread) { Fabricate(:chat_message, chat_channel: topic_channel, message: "hi", user: user2) }

        before do
          last_unread.update!(deleted_at: Time.zone.now)
        end

        it "returns the correct count" do
          unread_counts = subject.unread_counts([topic_channel], user1)
          expect(unread_counts[topic_channel.id]).to eq(0)
        end
      end
    end

    context "user is not member of the channel" do
      context "the channel has new messages" do
        before do
          Fabricate(:chat_message, chat_channel: topic_channel, message: "hi", user: user2)
        end

        it "returns the correct count" do
          unread_counts = subject.unread_counts([topic_channel], user1)
          expect(unread_counts[topic_channel.id]).to eq(0)
        end
      end
    end
  end

  describe ".all_secured_channel_ids" do
    it "returns nothing by default if the user has no memberships" do
      expect(subject.all_secured_channel_ids(guardian)).to eq([])
    end

    context "when the user has memberships to all the channels" do
      before do
        UserChatChannelMembership.create!(user: user1, chat_channel: category_channel, following: true)
        UserChatChannelMembership.create!(user: user1, chat_channel: topic_channel, following: true)
        UserChatChannelMembership.create!(
          user: user1, chat_channel: direct_message_channel, following: true,
          desktop_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
          mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always]
        )
      end

      it "returns the topic and category channel because they are public by default" do
        expect(subject.all_secured_channel_ids(guardian)).to match_array([topic_channel.id, category_channel.id])
      end

      it "returns all the channels if the user is a member of the DM channel also" do
        DirectMessageUser.create!(user: user1, direct_message_channel: dm_channel)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([
          topic_channel.id, category_channel.id, direct_message_channel.id
        ])
      end

      it "does not include the topic channel if the topic is in a private category the user cannot see" do
        topic.update(category: private_category)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([category_channel.id])
        GroupUser.create(group: private_category.groups.last, user: user1)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([topic_channel.id, category_channel.id])
      end

      it "does not include the category channel if the category is a private category the user cannot see" do
        category_channel.update(chatable: private_category)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([topic_channel.id])
        GroupUser.create(group: private_category.groups.last, user: user1)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([topic_channel.id, category_channel.id])
      end

      it "does not include the topic channel if the topic is a private message the user cannot see" do
        topic.convert_to_private_message(Discourse.system_user)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([category_channel.id])
        TopicAllowedUser.create(topic: topic, user: user1)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([topic_channel.id, category_channel.id])
      end
    end
  end

  describe "#secured_public_channels" do
    let(:scope_with_membership) { false }

    it "does not include DM channels" do
      expect(subject.secured_public_channels(
        guardian, memberships, scope_with_membership: scope_with_membership
      ).map(&:id)).to match_array(
        [topic_channel.id, category_channel.id]
      )
    end

    it "can filter by channel name, topic title, or category name" do
      expect(subject.secured_public_channels(
        guardian, memberships, scope_with_membership: scope_with_membership, filter: "support"
      ).map(&:id)).to match_array([category_channel.id])

      expect(subject.secured_public_channels(
        guardian, memberships, scope_with_membership: scope_with_membership, filter: "fast moving"
      ).map(&:id)).to match_array([topic_channel.id])

      topic_channel.update(name: "cool stuff")

      expect(subject.secured_public_channels(
        guardian, memberships, scope_with_membership: scope_with_membership, filter: "cool stuff"
      ).map(&:id)).to match_array([topic_channel.id])
    end

    it "does not show the user topic channels for PMs they cannot access" do
      topic.convert_to_private_message(Discourse.system_user)
      expect(subject.secured_public_channels(
        guardian, memberships, scope_with_membership: scope_with_membership
      ).map(&:id)).to match_array([category_channel.id])
    end

    it "does not show the user topic channels for categories they cannot access" do
      topic.update(category: private_category)
      expect(subject.secured_public_channels(
        guardian, memberships, scope_with_membership: scope_with_membership
      ).map(&:id)).to match_array([category_channel.id])
    end

    it "does not show the user category channels they cannot access" do
      category_channel.update(chatable: private_category)
      expect(subject.secured_public_channels(
        guardian, memberships, scope_with_membership: scope_with_membership
      ).map(&:id)).to match_array([topic_channel.id])
    end

    context "when scoping to the user's channel memberships" do
      let(:scope_with_membership) { true }

      it "only returns channels where the user is a member and is following the channel" do
        expect(subject.secured_public_channels(
          guardian, memberships, scope_with_membership: scope_with_membership
        ).map(&:id)).to eq([])

        UserChatChannelMembership.create(user: user1, chat_channel: topic_channel, following: true)
        UserChatChannelMembership.create(user: user1, chat_channel: category_channel, following: true)

        expect(subject.secured_public_channels(
          guardian, memberships, scope_with_membership: scope_with_membership
        ).map(&:id)).to match_array(
          [topic_channel.id, category_channel.id]
        )
      end
    end
  end
end
