# frozen_string_literal: true

require "rails_helper"

describe ChatChannelMembershipsQuery do
  fab!(:user_1) { Fabricate(:user, username: "Aline", name: "Boetie") }
  fab!(:user_2) { Fabricate(:user, username: "Bertrand", name: "Arlan") }

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
  end

  context "chatable exists" do
    context "chatable is public" do
      fab!(:channel_1) { Fabricate(:chat_channel) }

      context "no memberships exists" do
        it "returns an empty array" do
          expect(described_class.call(channel_1.id)).to eq([])
        end
      end

      context "memberships exist" do
        before do
          UserChatChannelMembership.create(user: user_1, chat_channel: channel_1, following: true)
          UserChatChannelMembership.create(user: user_2, chat_channel: channel_1, following: true)
        end

        it "returns the memberships" do
          memberships = described_class.call(channel_1.id)

          expect(memberships.pluck(:user_id)).to contain_exactly(user_1.id, user_2.id)
        end
      end
    end

    context "chatable is direct channel" do
      fab!(:chatable_1) { Fabricate(:direct_message_channel, users: [user_1, user_2]) }
      fab!(:channel_1) { Fabricate(:chat_channel, chatable: chatable_1) }

      context "no memberships exists" do
        it "returns an empty array" do
          expect(described_class.call(channel_1.id)).to eq([])
        end
      end

      context "memberships exist" do
        before do
          UserChatChannelMembership.create!(
            user: user_1,
            chat_channel: channel_1,
            following: true,
            desktop_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
            mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
          )
          UserChatChannelMembership.create!(
            user: user_2,
            chat_channel: channel_1,
            following: true,
            desktop_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
            mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
          )
        end

        it "returns the memberships" do
          memberships = described_class.call(channel_1.id)

          expect(memberships.pluck(:user_id)).to contain_exactly(user_1.id, user_2.id)
        end
      end
    end

    context "pagination" do
      fab!(:channel_1) { Fabricate(:chat_channel) }

      before do
        UserChatChannelMembership.create(user: user_1, chat_channel: channel_1, following: true)
        UserChatChannelMembership.create(user: user_2, chat_channel: channel_1, following: true)
      end

      describe "offset param" do
        it "offsets the results" do
          memberships = described_class.call(channel_1.id, offset: 1)

          expect(memberships.length).to eq(1)
        end
      end

      describe "limit param" do
        it "limits the results" do
          memberships = described_class.call(channel_1.id, limit: 1)

          expect(memberships.length).to eq(1)
        end
      end
    end

    describe "username param" do
      fab!(:channel_1) { Fabricate(:chat_channel) }

      before do
        UserChatChannelMembership.create(user: user_1, chat_channel: channel_1, following: true)
        UserChatChannelMembership.create(user: user_2, chat_channel: channel_1, following: true)
      end

      it "filters the results" do
        memberships = described_class.call(channel_1.id, username: user_1.username)

        expect(memberships.length).to eq(1)
        expect(memberships[0].user).to eq(user_1)
      end
    end

    describe "memberships order" do
      fab!(:channel_1) { Fabricate(:chat_channel) }

      before do
        UserChatChannelMembership.create(user: user_1, chat_channel: channel_1, following: true)
        UserChatChannelMembership.create(user: user_2, chat_channel: channel_1, following: true)
      end

      context "prioritizes username in ux" do
        before { SiteSetting.prioritize_username_in_ux = true }

        it "is using ascending order on username" do
          memberships = described_class.call(channel_1.id)

          expect(memberships[0].user).to eq(user_1)
          expect(memberships[1].user).to eq(user_2)
        end
      end

      context "doesn’t prioritize username in ux" do
        before { SiteSetting.prioritize_username_in_ux = false }

        it "is using ascending order on name" do
          memberships = described_class.call(channel_1.id)

          expect(memberships[0].user).to eq(user_2)
          expect(memberships[1].user).to eq(user_1)
        end

        context "enable names is disabled" do
          before { SiteSetting.enable_names = false }

          it "is using ascending order on username" do
            memberships = described_class.call(channel_1.id)

            expect(memberships[0].user).to eq(user_1)
            expect(memberships[1].user).to eq(user_2)
          end
        end
      end
    end
  end

  context "user is staged" do
    fab!(:channel_1) { Fabricate(:chat_channel) }
    fab!(:staged_user) { Fabricate(:staged) }

    before do
      UserChatChannelMembership.create(user: staged_user, chat_channel: channel_1, following: true)
    end

    it "doesn’t list staged users" do
      memberships = described_class.call(channel_1.id)
      expect(memberships).to be_blank
    end
  end

  context "user is suspended" do
    fab!(:channel_1) { Fabricate(:chat_channel) }
    fab!(:suspended_user) do
      Fabricate(:user, suspended_at: Time.now, suspended_till: 5.days.from_now)
    end

    before do
      UserChatChannelMembership.create(
        user: suspended_user,
        chat_channel: channel_1,
        following: true,
      )
    end

    it "doesn’t list suspended users" do
      memberships = described_class.call(channel_1.id)
      expect(memberships).to be_blank
    end
  end

  context "user is inactive" do
    fab!(:channel_1) { Fabricate(:chat_channel) }
    fab!(:inactive_user) { Fabricate(:inactive_user) }

    before do
      UserChatChannelMembership.create(
        user: inactive_user,
        chat_channel: channel_1,
        following: true,
      )
    end

    it "doesn’t list inactive users" do
      memberships = described_class.call(channel_1.id)
      expect(memberships).to be_blank
    end
  end
end
