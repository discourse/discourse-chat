# frozen_string_literal: true

describe DiscourseChat::ChatChannelFetcher do
  fab!(:category) { Fabricate(:category, name: "support") }
  fab!(:private_category) { Fabricate(:private_category, group: Fabricate(:group)) }
  fab!(:category_channel) { Fabricate(:chat_channel, chatable: category) }
  fab!(:dm_channel1) { Fabricate(:direct_message_channel) }
  fab!(:dm_channel2) { Fabricate(:direct_message_channel) }
  fab!(:direct_message_channel1) { Fabricate(:chat_channel, chatable: dm_channel1) }
  fab!(:direct_message_channel2) { Fabricate(:chat_channel, chatable: dm_channel2) }
  fab!(:user1) { Fabricate(:user) }
  fab!(:user2) { Fabricate(:user) }

  def guardian
    Guardian.new(user1)
  end

  def memberships
    UserChatChannelMembership.where(user: user1)
  end

  describe ".structured" do
    it "returns open channel only" do
      category_channel.user_chat_channel_memberships.create!(user: user1, following: true)

      channels = subject.structured(guardian)[:public_channels]

      expect(channels).to contain_exactly(category_channel)

      category_channel.closed!(Discourse.system_user)
      channels = subject.structured(guardian)[:public_channels]

      expect(channels).to be_blank
    end

    it "returns followed channel only" do
      channels = subject.structured(guardian)[:public_channels]

      expect(channels).to be_blank

      category_channel.user_chat_channel_memberships.create!(user: user1, following: true)
      channels = subject.structured(guardian)[:public_channels]

      expect(channels).to contain_exactly(category_channel)
    end
  end

  describe ".unread_counts" do
    context "user is member of the channel" do
      before do
        Fabricate(:user_chat_channel_membership, chat_channel: category_channel, user: user1)
      end

      context "has unread messages" do
        before do
          Fabricate(:chat_message, chat_channel: category_channel, message: "hi", user: user2)
          Fabricate(:chat_message, chat_channel: category_channel, message: "bonjour", user: user2)
        end

        it "returns the correct count" do
          unread_counts = subject.unread_counts([category_channel], user1)
          expect(unread_counts[category_channel.id]).to eq(2)
        end
      end

      context "has no unread messages" do
        it "returns the correct count" do
          unread_counts = subject.unread_counts([category_channel], user1)
          expect(unread_counts[category_channel.id]).to eq(0)
        end
      end

      context "last unread message has been deleted" do
        fab!(:last_unread) do
          Fabricate(:chat_message, chat_channel: category_channel, message: "hi", user: user2)
        end

        before { last_unread.update!(deleted_at: Time.zone.now) }

        it "returns the correct count" do
          unread_counts = subject.unread_counts([category_channel], user1)
          expect(unread_counts[category_channel.id]).to eq(0)
        end
      end
    end

    context "user is not member of the channel" do
      context "the channel has new messages" do
        before do
          Fabricate(:chat_message, chat_channel: category_channel, message: "hi", user: user2)
        end

        it "returns the correct count" do
          unread_counts = subject.unread_counts([category_channel], user1)
          expect(unread_counts[category_channel.id]).to eq(0)
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
        UserChatChannelMembership.create!(
          user: user1,
          chat_channel: category_channel,
          following: true,
        )
        UserChatChannelMembership.create!(
          user: user1,
          chat_channel: direct_message_channel1,
          following: true,
          desktop_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
          mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
        )
      end

      it "returns category channel because they are public by default" do
        expect(subject.all_secured_channel_ids(guardian)).to match_array([category_channel.id])
      end

      it "returns all the channels if the user is a member of the DM channel also" do
        DirectMessageUser.create!(user: user1, direct_message_channel: dm_channel1)
        expect(subject.all_secured_channel_ids(guardian)).to match_array(
          [category_channel.id, direct_message_channel1.id],
        )
      end

      it "does not include the category channel if the category is a private category the user cannot see" do
        category_channel.update!(chatable: private_category)
        expect(subject.all_secured_channel_ids(guardian)).to be_empty
        GroupUser.create!(group: private_category.groups.last, user: user1)
        expect(subject.all_secured_channel_ids(guardian)).to match_array([category_channel.id])
      end
    end
  end

  describe "#secured_public_channels" do
    let(:following) { false }

    it "does not include DM channels" do
      expect(
        subject.secured_public_channels(guardian, memberships, following: following).map(&:id),
      ).to match_array([category_channel.id])
    end

    it "can filter by channel name, or category name" do
      expect(
        subject.secured_public_channels(
          guardian,
          memberships,
          following: following,
          filter: "support",
        ).map(&:id),
      ).to match_array([category_channel.id])

      category_channel.update!(name: "cool stuff")

      expect(
        subject.secured_public_channels(
          guardian,
          memberships,
          following: following,
          filter: "cool stuff",
        ).map(&:id),
      ).to match_array([category_channel.id])
    end

    it "can filter by status" do
      expect(
        subject.secured_public_channels(guardian, memberships, status: "closed").map(&:id),
      ).to match_array([])

      category_channel.closed!(Discourse.system_user)

      expect(
        subject.secured_public_channels(guardian, memberships, status: "closed").map(&:id),
      ).to match_array([category_channel.id])
    end

    it "ensures offset is >= 0" do
      expect(
        subject.secured_public_channels(guardian, memberships, offset: -235).map(&:id),
      ).to match_array([category_channel.id])
    end

    it "ensures limit is > 0" do
      expect(
        subject.secured_public_channels(guardian, memberships, limit: -1, offset: 0).map(&:id),
      ).to match_array([category_channel.id])
    end

    it "ensures limit has a max value" do
      25.times { Fabricate(:chat_channel) }

      expect(subject.secured_public_channels(guardian, memberships, limit: 25).length).to eq(
        DiscourseChat::ChatChannelFetcher::MAX_RESULTS,
      )
    end

    it "does not show the user category channels they cannot access" do
      category_channel.update!(chatable: private_category)
      expect(
        subject.secured_public_channels(guardian, memberships, following: following).map(&:id),
      ).to be_empty
    end

    context "when scoping to the user's channel memberships" do
      let(:following) { true }

      it "only returns channels where the user is a member and is following the channel" do
        expect(
          subject.secured_public_channels(guardian, memberships, following: following).map(&:id),
        ).to be_empty

        UserChatChannelMembership.create!(
          user: user1,
          chat_channel: category_channel,
          following: true,
        )

        expect(
          subject.secured_public_channels(guardian, memberships, following: following).map(&:id),
        ).to match_array([category_channel.id])
      end

      it "includes the unread count based on mute settings" do
        membership =
          UserChatChannelMembership.create!(
            user: user1,
            chat_channel: category_channel,
            following: true,
          )

        Fabricate(:chat_message, user: user2, chat_channel: category_channel)
        Fabricate(:chat_message, user: user2, chat_channel: category_channel)

        result_category_channel =
          subject
            .secured_public_channels(guardian, memberships, following: following)
            .find { |chan| chan.id == category_channel.id }

        expect(result_category_channel.unread_count).to eq(2)

        membership = memberships.last
        membership.update!(muted: true)

        result_category_channel =
          subject
            .secured_public_channels(guardian, memberships, following: following)
            .find { |chan| chan.id == category_channel.id }

        expect(result_category_channel.unread_count).to eq(0)
      end
    end
  end

  describe "#secured_direct_message_channels" do
    it "includes direct message channels the user is a member of ordered by last_message_sent_at" do
      Fabricate(
        :user_chat_channel_membership_for_dm,
        chat_channel: direct_message_channel1,
        user: user1,
        following: true,
      )
      DirectMessageUser.create!(direct_message_channel: dm_channel1, user: user1)
      DirectMessageUser.create!(direct_message_channel: dm_channel1, user: user2)
      Fabricate(
        :user_chat_channel_membership_for_dm,
        chat_channel: direct_message_channel2,
        user: user1,
        following: true,
      )
      DirectMessageUser.create!(direct_message_channel: dm_channel2, user: user1)
      DirectMessageUser.create!(direct_message_channel: dm_channel2, user: user2)

      direct_message_channel1.update!(last_message_sent_at: 1.day.ago)
      direct_message_channel2.update!(last_message_sent_at: 1.hour.ago)

      expect(
        subject.secured_direct_message_channels(user1.id, memberships, guardian).map(&:id),
      ).to eq([direct_message_channel2.id, direct_message_channel1.id])
    end

    it "does not include direct message channels where the user is a member but not a direct_message_user" do
      Fabricate(
        :user_chat_channel_membership_for_dm,
        chat_channel: direct_message_channel1,
        user: user1,
        following: true,
      )
      DirectMessageUser.create!(direct_message_channel: dm_channel1, user: user2)

      expect(
        subject.secured_direct_message_channels(user1.id, memberships, guardian).map(&:id),
      ).not_to include(direct_message_channel1.id)
    end
  end

  describe ".find_with_access_check" do
    it "raises NotFound if the channel does not exist" do
      category_channel.destroy!
      expect { subject.find_with_access_check(category_channel.id, guardian) }.to raise_error(
        Discourse::NotFound,
      )
    end

    it "raises InvalidAccess if the user cannot see the channel" do
      category_channel.update!(chatable: private_category)
      expect { subject.find_with_access_check(category_channel.id, guardian) }.to raise_error(
        Discourse::InvalidAccess,
      )
    end

    it "returns the chat channel if it is found and accessible" do
      expect(subject.find_with_access_check(category_channel.id, guardian)).to eq(category_channel)
    end
  end
end
