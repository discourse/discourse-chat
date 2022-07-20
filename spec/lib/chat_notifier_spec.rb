# frozen_string_literal: true

require "rails_helper"

describe DiscourseChat::ChatNotifier do
  describe "#notify_new" do
    fab!(:channel) { Fabricate(:chat_channel) }
    fab!(:user_1) { Fabricate(:user) }
    fab!(:user_2) { Fabricate(:user) }

    before do
      @chat_group =
        Fabricate(
          :group,
          users: [user_1, user_2],
          mentionable_level: Group::ALIAS_LEVELS[:everyone],
        )
      SiteSetting.chat_allowed_groups = @chat_group.id

      [user_1, user_2].each do |u|
        Fabricate(:user_chat_channel_membership, chat_channel: channel, user: u)
      end
    end

    def build_cooked_msg(message_body, user, chat_channel: channel)
      ChatMessage.new(
        chat_channel: chat_channel,
        user: user,
        message: message_body,
        created_at: 5.minutes.ago,
      ).tap(&:cook)
    end

    shared_examples "channel-wide mentions" do
      it "returns an empty list when the message doesn't include a channel mention" do
        msg = build_cooked_msg(mention.gsub("@", ""), user_1)

        to_notify = described_class.new(msg, msg.created_at).notify_new

        expect(to_notify[list_key]).to be_empty
      end

      it "will never include someone who is not accepting channel-wide notifications" do
        user_2.user_option.update!(ignore_channel_wide_mention: true)
        msg = build_cooked_msg(mention, user_1)

        to_notify = described_class.new(msg, msg.created_at).notify_new

        expect(to_notify[list_key]).to be_empty
      end

      it "includes all members of a channel except the sender" do
        msg = build_cooked_msg(mention, user_1)

        to_notify = described_class.new(msg, msg.created_at).notify_new

        expect(to_notify[list_key]).to contain_exactly(user_2.id)
      end
    end

    shared_examples "ensure only channel members are notified" do
      it "will never include someone outside the channel" do
        user3 = Fabricate(:user)
        @chat_group.add(user3)
        another_channel = Fabricate(:chat_channel)
        Fabricate(:user_chat_channel_membership, chat_channel: another_channel, user: user3)
        msg = build_cooked_msg(mention, user_1)

        to_notify = described_class.new(msg, msg.created_at).notify_new

        expect(to_notify[list_key]).to contain_exactly(user_2.id)
      end

      it "will never include someone not following the channel anymore" do
        user3 = Fabricate(:user)
        @chat_group.add(user3)
        Fabricate(
          :user_chat_channel_membership,
          following: false,
          chat_channel: channel,
          user: user3,
        )
        msg = build_cooked_msg(mention, user_1)

        to_notify = described_class.new(msg, msg.created_at).notify_new

        expect(to_notify[list_key]).to contain_exactly(user_2.id)
      end

      it "will never include someone who is suspended" do
        user3 = Fabricate(:user, suspended_till: 2.years.from_now)
        @chat_group.add(user3)
        Fabricate(
          :user_chat_channel_membership,
          following: true,
          chat_channel: channel,
          user: user3,
        )

        msg = build_cooked_msg(mention, user_1)

        to_notify = described_class.new(msg, msg.created_at).notify_new

        expect(to_notify[list_key]).to contain_exactly(user_2.id)
      end
    end

    describe "global_mentions" do
      let(:mention) { "hello @all!" }
      let(:list_key) { :global_mentions }

      include_examples "channel-wide mentions"
      include_examples "ensure only channel members are notified"
    end

    describe "here_mentions" do
      let(:mention) { "hello @here!" }
      let(:list_key) { :here_mentions }

      before { user_2.update!(last_seen_at: 4.minutes.ago) }

      include_examples "channel-wide mentions"
      include_examples "ensure only channel members are notified"

      it "includes users seen less than 5 minutes ago" do
        msg = build_cooked_msg(mention, user_1)

        to_notify = described_class.new(msg, msg.created_at).notify_new

        expect(to_notify[list_key]).to contain_exactly(user_2.id)
      end

      it "excludes users seen more than 5 minutes ago" do
        user_2.update!(last_seen_at: 6.minutes.ago)
        msg = build_cooked_msg(mention, user_1)

        to_notify = described_class.new(msg, msg.created_at).notify_new

        expect(to_notify[list_key]).to be_empty
      end

      it "excludes users mentioned directly" do
        msg = build_cooked_msg("hello @here @#{user_2.username}!", user_1)

        to_notify = described_class.new(msg, msg.created_at).notify_new

        expect(to_notify[list_key]).to be_empty
      end
    end

    describe "direct_mentions" do
      it "only include mentioned users" do
        user_3 = Fabricate(:user)
        @chat_group.add(user_3)
        another_channel = Fabricate(:chat_channel)
        Fabricate(:user_chat_channel_membership, chat_channel: another_channel, user: user_3)
        msg = build_cooked_msg("Is @#{user_3.username} here? And @#{user_2.username}", user_1)

        to_notify = described_class.new(msg, msg.created_at).notify_new

        expect(to_notify[:direct_mentions]).to contain_exactly(user_2.id)
      end

      it "include users as direct mentions even if there's a @here mention" do
        msg = build_cooked_msg("Hello @here and @#{user_2.username}", user_1)

        to_notify = described_class.new(msg, msg.created_at).notify_new

        expect(to_notify[:here_mentions]).to be_empty
        expect(to_notify[:direct_mentions]).to contain_exactly(user_2.id)
      end

      it "include users as direct mentions even if there's a @all mention" do
        msg = build_cooked_msg("Hello @all and @#{user_2.username}", user_1)

        to_notify = described_class.new(msg, msg.created_at).notify_new

        expect(to_notify[:global_mentions]).to be_empty
        expect(to_notify[:direct_mentions]).to contain_exactly(user_2.id)
      end
    end

    describe "group mentions" do
      fab!(:user_3) { Fabricate(:user) }
      fab!(:group) do
        Fabricate(
          :public_group,
          users: [user_2, user_3],
          mentionable_level: Group::ALIAS_LEVELS[:everyone],
        )
      end
      fab!(:other_channel) { Fabricate(:chat_channel) }

      before { @chat_group.add(user_3) }

      let(:mention) { "hello @#{group.name}!" }
      let(:list_key) { group.name }

      include_examples "ensure only channel members are notified"

      it "establishes a far-left precedence among group mentions" do
        Fabricate(
          :user_chat_channel_membership,
          chat_channel: channel,
          user: user_3,
          following: true,
        )
        msg = build_cooked_msg("Hello @#{@chat_group.name} and @#{group.name}", user_1)

        to_notify = described_class.new(msg, msg.created_at).notify_new

        expect(to_notify[@chat_group.name]).to contain_exactly(user_2.id, user_3.id)
        expect(to_notify[list_key]).to be_empty

        second_msg = build_cooked_msg("Hello @#{group.name} and @#{@chat_group.name}", user_1)

        to_notify_2 = described_class.new(second_msg, second_msg.created_at).notify_new

        expect(to_notify_2[list_key]).to contain_exactly(user_2.id, user_3.id)
        expect(to_notify_2[@chat_group.name]).to be_empty
      end
    end

    describe "unreachable users" do
      fab!(:user_3) { Fabricate(:user) }

      it "notify poster of users who are not allowed to use chat" do
        msg = build_cooked_msg("Hello @#{user_3.username}", user_1)

        messages =
          MessageBus.track_publish("/chat/#{channel.id}") do
            to_notify = described_class.new(msg, msg.created_at).notify_new

            expect(to_notify[:direct_mentions]).to be_empty
          end

        unreachable_msg = messages.first

        expect(unreachable_msg).to be_present
        expect(unreachable_msg.data[:without_membership]).to be_empty
        unreachable_users = unreachable_msg.data[:cannot_see].map { |u| u[:id] }
        expect(unreachable_users).to contain_exactly(user_3.id)
      end

      context "in a personal message" do
        let(:personal_chat_channel) do
          DiscourseChat::DirectMessageChannelCreator.create!(target_users: [user_1, user_2])
        end

        before { @chat_group.add(user_3) }

        it "notify posts of users who are not participating in a personal message" do
          msg =
            build_cooked_msg(
              "Hello @#{user_3.username}",
              user_1,
              chat_channel: personal_chat_channel,
            )

          messages =
            MessageBus.track_publish("/chat/#{personal_chat_channel.id}") do
              to_notify = described_class.new(msg, msg.created_at).notify_new

              expect(to_notify[:direct_mentions]).to be_empty
            end

          unreachable_msg = messages.first

          expect(unreachable_msg).to be_present
          expect(unreachable_msg.data[:without_membership]).to be_empty
          unreachable_users = unreachable_msg.data[:cannot_see].map { |u| u[:id] }
          expect(unreachable_users).to contain_exactly(user_3.id)
        end

        it "notify posts of users who are part of the mentioned group but participating" do
          group =
            Fabricate(
              :public_group,
              users: [user_2, user_3],
              mentionable_level: Group::ALIAS_LEVELS[:everyone],
            )
          msg =
            build_cooked_msg("Hello @#{group.name}", user_1, chat_channel: personal_chat_channel)

          messages =
            MessageBus.track_publish("/chat/#{personal_chat_channel.id}") do
              to_notify = described_class.new(msg, msg.created_at).notify_new

              expect(to_notify[group.name]).to contain_exactly(user_2.id)
            end

          unreachable_msg = messages.first

          expect(unreachable_msg).to be_present
          expect(unreachable_msg.data[:without_membership]).to be_empty
          unreachable_users = unreachable_msg.data[:cannot_see].map { |u| u[:id] }
          expect(unreachable_users).to contain_exactly(user_3.id)
        end
      end
    end

    describe "users who can be invited to join the channel" do
      fab!(:user_3) { Fabricate(:user) }

      before { @chat_group.add(user_3) }

      it "can invite chat user without channel membership" do
        msg = build_cooked_msg("Hello @#{user_3.username}", user_1)

        messages =
          MessageBus.track_publish("/chat/#{channel.id}") do
            to_notify = described_class.new(msg, msg.created_at).notify_new

            expect(to_notify[:direct_mentions]).to be_empty
          end

        not_participating_msg = messages.first

        expect(not_participating_msg).to be_present
        expect(not_participating_msg.data[:cannot_see]).to be_empty
        not_participating_users = not_participating_msg.data[:without_membership].map { |u| u[:id] }
        expect(not_participating_users).to contain_exactly(user_3.id)
      end

      it "can invite chat user who no longer follows the channel" do
        Fabricate(
          :user_chat_channel_membership,
          chat_channel: channel,
          user: user_3,
          following: false,
        )
        msg = build_cooked_msg("Hello @#{user_3.username}", user_1)

        messages =
          MessageBus.track_publish("/chat/#{channel.id}") do
            to_notify = described_class.new(msg, msg.created_at).notify_new

            expect(to_notify[:direct_mentions]).to be_empty
          end

        not_participating_msg = messages.first

        expect(not_participating_msg).to be_present
        expect(not_participating_msg.data[:cannot_see]).to be_empty
        not_participating_users = not_participating_msg.data[:without_membership].map { |u| u[:id] }
        expect(not_participating_users).to contain_exactly(user_3.id)
      end

      it "can invite other group members to channel" do
        group =
          Fabricate(
            :public_group,
            users: [user_2, user_3],
            mentionable_level: Group::ALIAS_LEVELS[:everyone],
          )
        msg = build_cooked_msg("Hello @#{group.name}", user_1)

        messages =
          MessageBus.track_publish("/chat/#{channel.id}") do
            to_notify = described_class.new(msg, msg.created_at).notify_new

            expect(to_notify[:direct_mentions]).to be_empty
          end

        not_participating_msg = messages.first

        expect(not_participating_msg).to be_present
        expect(not_participating_msg.data[:cannot_see]).to be_empty
        not_participating_users = not_participating_msg.data[:without_membership].map { |u| u[:id] }
        expect(not_participating_users).to contain_exactly(user_3.id)
      end
    end
  end
end
