# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::Api::ChatChannelNotificationsSettingsController do
  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
  end

  describe '#update' do
    include_examples 'channel access example', :put, '/notifications_settings.json'

    context 'invalid params' do
      fab!(:chat_channel) { Fabricate(:chat_channel) }
      fab!(:user) { Fabricate(:user) }
      fab!(:membership) { Fabricate(:user_chat_channel_membership, user: user, chat_channel: chat_channel) }

      before do
        sign_in(user)
      end

      it 'doesn’t use invalid params' do
        UserChatChannelMembership.any_instance.expects(:update!).with(
          'muted' => 'true',
        ).once

        put "/chat/api/chat_channels/#{chat_channel.id}/notifications_settings.json", params: {
          muted: true,
          foo: 1
        }

        expect(response.status).to eq(200)
      end
    end

    context 'valid params' do
      fab!(:chat_channel) { Fabricate(:chat_channel) }
      fab!(:user) { Fabricate(:user) }
      fab!(:membership) { Fabricate(:user_chat_channel_membership, muted: false, user: user, chat_channel: chat_channel) }

      before do
        sign_in(user)
      end

      it 'updates the notifications settings' do
        put "/chat/api/chat_channels/#{chat_channel.id}/notifications_settings.json", params: {
          muted: true,
          desktop_notification_level: 'always',
          mobile_notification_level: 'never',
        }

        expect(response.status).to eq(200)
        expect(response).to match_response_schema('user_chat_channel_membership')

        membership.reload

        expect(membership.muted).to eq(true)
        expect(membership.desktop_notification_level).to eq('always')
        expect(membership.mobile_notification_level).to eq('never')
      end
    end

    context 'membership doesn’t exist' do
      fab!(:chat_channel) { Fabricate(:chat_channel) }
      fab!(:user) { Fabricate(:user) }

      before do
        sign_in(user)
      end

      it 'raises a 404' do
        put "/chat/api/chat_channels/#{chat_channel.id}/notifications_settings.json"

        expect(response.status).to eq(404)
      end
    end

    context 'invalid params' do
      fab!(:chatable) { Fabricate(:direct_message_channel) }
      fab!(:chat_channel) { Fabricate(:chat_channel, chatable: chatable) }
      fab!(:membership) {
        Fabricate(:user_chat_channel_membership,
          user: chatable.users[0],
          chat_channel: chat_channel,
          following: true,
          muted: false,
          desktop_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always],
          mobile_notification_level: UserChatChannelMembership::NOTIFICATION_LEVELS[:always]
        )
      }

      before do
        sign_in(chatable.users[0])
      end

      it 'raises a 422' do
        put "/chat/api/chat_channels/#{chat_channel.id}/notifications_settings.json", params: {
          muted: true,
        }

        expect(response.status).to eq(422)
        expect(response.parsed_body['errors'][0]).to eq(I18n.t('activerecord.errors.format', attribute: 'Muted', message: I18n.t('activerecord.errors.messages.invalid')))
      end
    end
  end
end
