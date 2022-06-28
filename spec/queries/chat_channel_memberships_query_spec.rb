# frozen_string_literal: true

require 'rails_helper'

describe ChatChannelMembershipsQuery do
  fab!(:user_1) { Fabricate(:user) }
  fab!(:user_2) { Fabricate(:user) }

  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
  end

  context 'chatable exists' do
    context 'chatable is public' do
      fab!(:channel_1) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }

      context 'no memberships exists' do
        it 'returns an empty array' do
          expect(described_class.call(channel_1.id)).to eq([])
        end
      end

      context 'memberships exist' do
        before do
          UserChatChannelMembership.create(user: user_1, chat_channel: channel_1, following: true)
          UserChatChannelMembership.create(user: user_2, chat_channel: channel_1, following: true)
        end

        it 'returns the membersips' do
          memberships = described_class.call(channel_1.id)

          expect(memberships.pluck(:user_id)).to contain_exactly(user_1.id, user_2.id)
        end
      end
    end

    context 'chatable is direct channel' do
      fab!(:chatable_1) { Fabricate(:direct_message_channel, users: [user_1, user_2]) }
      fab!(:channel_1) { Fabricate(:chat_channel, chatable: chatable_1) }

      context 'no memberships exists' do
        it 'returns an empty array' do
          expect(described_class.call(channel_1.id)).to eq([])
        end
      end

      context 'memberships exist' do
        before do
          UserChatChannelMembership.create!(user: user_1, chat_channel: channel_1, following: true, desktop_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always], mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always])
          UserChatChannelMembership.create!(user: user_2, chat_channel: channel_1, following: true, desktop_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always], mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always])
        end

        it 'returns the membersips' do
          memberships = described_class.call(channel_1.id)

          expect(memberships.pluck(:user_id)).to contain_exactly(user_1.id, user_2.id)
        end
      end
    end

    context 'pagination' do
      fab!(:channel_1) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }

      before do
        UserChatChannelMembership.create(user: user_1, chat_channel: channel_1, following: true)
        UserChatChannelMembership.create(user: user_2, chat_channel: channel_1, following: true)
      end

      describe 'offset param' do
        it 'offsets the results' do
          memberships = described_class.call(channel_1.id, offset: 1)

          expect(memberships.length).to eq(1)
        end
      end

      describe 'limit param' do
        it 'limits the results' do
          memberships = described_class.call(channel_1.id, limit: 1)

          expect(memberships.length).to eq(1)
        end
      end
    end

    describe 'username param' do
      fab!(:channel_1) { Fabricate(:chat_channel, chatable: Fabricate(:topic)) }

      before do
        UserChatChannelMembership.create(user: user_1, chat_channel: channel_1, following: true)
        UserChatChannelMembership.create(user: user_2, chat_channel: channel_1, following: true)
      end

      it 'filters the results' do
        memberships = described_class.call(channel_1.id, username: user_1.username)

        expect(memberships.length).to eq(1)
        expect(memberships[0].user.username).to eq(user_1.username)
      end
    end
  end
end
