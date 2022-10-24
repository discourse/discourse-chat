# frozen_string_literal: true

require "rails_helper"

describe ChatChannelMembershipsQuery do
  fab!(:user_1) { Fabricate(:user, username: "Aline", name: "Boetie") }
  fab!(:user_2) { Fabricate(:user, username: "Bertrand", name: "Arlan") }

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
  end

  context "when chatable exists" do
    context "when chatable is public" do
      fab!(:channel_1) { Fabricate(:category_channel) }

      context "when no memberships exists" do
        it "returns an empty array" do
          expect(described_class.call(channel_1)).to eq([])
        end
      end

      context "when memberships exist" do
        before do
          UserChatChannelMembership.create(user: user_1, chat_channel: channel_1, following: true)
          UserChatChannelMembership.create(user: user_2, chat_channel: channel_1, following: true)
        end

        it "returns the memberships" do
          memberships = described_class.call(channel_1)

          expect(memberships.pluck(:user_id)).to contain_exactly(user_1.id, user_2.id)
        end
      end
    end

    context "when chatable is restricted" do
      fab!(:chatters_group) { Fabricate(:group) }
      fab!(:private_category) { Fabricate(:private_category, group: chatters_group) }
      fab!(:channel_1) { Fabricate(:category_channel, chatable: private_category) }

      context "when user is in group" do
        before { chatters_group.add(user_1) }

        context "when membership exists" do
          before do
            UserChatChannelMembership.create(user: user_1, chat_channel: channel_1, following: true)
          end

          it "lists the user" do
            memberships = described_class.call(channel_1)

            expect(memberships.pluck(:user_id)).to include(user_1.id)
          end

          it "returns only one membership if user is in multiple allowed groups" do
            another_group = Fabricate(:group)
            another_group.add(user_1)
            private_category.category_groups.create!(
              group_id: another_group.id,
              permission_type: CategoryGroup.permission_types[:full],
            )

            expect(described_class.call(channel_1).pluck(:user_id)).to contain_exactly(user_1.id)
          end

          it "returns the membership if the user still has access through a staff group" do
            chatters_group.remove(user_1)
            Group.find_by(id: Group::AUTO_GROUPS[:staff]).add(user_1)

            memberships = described_class.call(channel_1)

            expect(memberships.pluck(:user_id)).to include(user_1.id)
          end
        end

        context "when membership doesn’t exist" do
          it "doesn’t list the user" do
            memberships = described_class.call(channel_1)

            expect(memberships.pluck(:user_id)).to be_empty
          end
        end
      end

      context "when user is not in group" do
        context "when membership exists" do
          before do
            UserChatChannelMembership.create(user: user_1, chat_channel: channel_1, following: true)
          end

          it "doesn’t list the user" do
            memberships = described_class.call(channel_1)

            expect(memberships).to be_empty
          end
        end

        context "when membership doesn’t exist" do
          it "doesn’t list the user" do
            memberships = described_class.call(channel_1)

            expect(memberships).to be_empty
          end
        end
      end
    end

    context "when chatable is direct channel" do
      fab!(:chatable_1) { Fabricate(:direct_message_channel, users: [user_1, user_2]) }
      fab!(:channel_1) { Fabricate(:dm_channel, chatable: chatable_1) }

      context "when no memberships exists" do
        it "returns an empty array" do
          expect(described_class.call(channel_1)).to eq([])
        end
      end

      context "when memberships exist" do
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
          memberships = described_class.call(channel_1)

          expect(memberships.pluck(:user_id)).to contain_exactly(user_1.id, user_2.id)
        end
      end
    end

    describe "pagination" do
      fab!(:channel_1) { Fabricate(:category_channel) }

      before do
        UserChatChannelMembership.create(user: user_1, chat_channel: channel_1, following: true)
        UserChatChannelMembership.create(user: user_2, chat_channel: channel_1, following: true)
      end

      describe "offset param" do
        it "offsets the results" do
          memberships = described_class.call(channel_1, offset: 1)

          expect(memberships.length).to eq(1)
        end
      end

      describe "limit param" do
        it "limits the results" do
          memberships = described_class.call(channel_1, limit: 1)

          expect(memberships.length).to eq(1)
        end
      end
    end

    describe "username param" do
      fab!(:channel_1) { Fabricate(:category_channel) }

      before do
        UserChatChannelMembership.create(user: user_1, chat_channel: channel_1, following: true)
        UserChatChannelMembership.create(user: user_2, chat_channel: channel_1, following: true)
      end

      it "filters the results" do
        memberships = described_class.call(channel_1, username: user_1.username)

        expect(memberships.length).to eq(1)
        expect(memberships[0].user).to eq(user_1)
      end
    end

    describe "memberships order" do
      fab!(:channel_1) { Fabricate(:category_channel) }

      before do
        UserChatChannelMembership.create(user: user_1, chat_channel: channel_1, following: true)
        UserChatChannelMembership.create(user: user_2, chat_channel: channel_1, following: true)
      end

      context "when prioritizes username in ux is enabled" do
        before { SiteSetting.prioritize_username_in_ux = true }

        it "is using ascending order on username" do
          memberships = described_class.call(channel_1)

          expect(memberships[0].user).to eq(user_1)
          expect(memberships[1].user).to eq(user_2)
        end
      end

      context "when prioritize username in ux is disabled" do
        before { SiteSetting.prioritize_username_in_ux = false }

        it "is using ascending order on name" do
          memberships = described_class.call(channel_1)

          expect(memberships[0].user).to eq(user_2)
          expect(memberships[1].user).to eq(user_1)
        end

        context "when enable names is disabled" do
          before { SiteSetting.enable_names = false }

          it "is using ascending order on username" do
            memberships = described_class.call(channel_1)

            expect(memberships[0].user).to eq(user_1)
            expect(memberships[1].user).to eq(user_2)
          end
        end
      end
    end
  end

  context "when user is staged" do
    fab!(:channel_1) { Fabricate(:category_channel) }
    fab!(:staged_user) { Fabricate(:staged) }

    before do
      UserChatChannelMembership.create(user: staged_user, chat_channel: channel_1, following: true)
    end

    it "doesn’t list staged users" do
      memberships = described_class.call(channel_1)
      expect(memberships).to be_blank
    end
  end

  context "when user is suspended" do
    fab!(:channel_1) { Fabricate(:category_channel) }
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
      memberships = described_class.call(channel_1)
      expect(memberships).to be_blank
    end
  end

  context "when user is inactive" do
    fab!(:channel_1) { Fabricate(:category_channel) }
    fab!(:inactive_user) { Fabricate(:inactive_user) }

    before do
      UserChatChannelMembership.create(
        user: inactive_user,
        chat_channel: channel_1,
        following: true,
      )
    end

    it "doesn’t list inactive users" do
      memberships = described_class.call(channel_1)
      expect(memberships).to be_blank
    end
  end
end
