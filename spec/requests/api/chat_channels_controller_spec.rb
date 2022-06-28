# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::Api::ChatChannelsController do
  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
  end

  describe '#update' do
    include_examples 'channel access example', :put

    context 'user can’t edit channel' do
      fab!(:chat_channel) { Fabricate(:chat_channel) }

      before do
        sign_in(Fabricate(:user))
      end

      it 'returns a 403' do
        put "/chat/api/chat_channels/#{chat_channel.id}.json"

        expect(response.status).to eq(403)
      end
    end

    context 'user provided invalid params' do
      fab!(:chat_channel) { Fabricate(:chat_channel, user_count: 10) }

      before do
        sign_in(Fabricate(:admin))
      end

      it 'doesn’t change invalid properties' do
        put "/chat/api/chat_channels/#{chat_channel.id}.json", params: { user_count: 40 }

        expect(chat_channel.reload.user_count).to eq(10)
      end
    end

    context 'user provided an empty name' do
      fab!(:user) { Fabricate(:admin) }
      fab!(:chat_channel) { Fabricate(:chat_channel, name: 'something') }

      before { sign_in(user) }

      it 'nullifies the field and doesn’t store an empty string' do
        put "/chat/api/chat_channels/#{chat_channel.id}.json", params: { name: '  ' }

        expect(chat_channel.reload.name).to be_nil
      end
    end

    context 'user provided an empty description' do
      fab!(:user) { Fabricate(:admin) }
      fab!(:chat_channel) { Fabricate(:chat_channel, description: 'something') }

      before { sign_in(user) }

      it 'nullifies the field and doesn’t store an empty string' do
        put "/chat/api/chat_channels/#{chat_channel.id}.json", params: { description: '' }

        expect(chat_channel.reload.description).to be_nil
      end
    end

    context 'channel is a direct message channel' do
      fab!(:user) { Fabricate(:admin) }
      fab!(:chatable) { Fabricate(:direct_message_channel) }
      fab!(:chat_channel) { Fabricate(:chat_channel, chatable: chatable) }

      before { sign_in(user) }

      it 'raises a 403' do
        put "/chat/api/chat_channels/#{chat_channel.id}.json"

        expect(response.status).to eq(403)
      end
    end

    context 'user provided valid params' do
      fab!(:user) { Fabricate(:admin) }
      fab!(:chat_channel) { Fabricate(:chat_channel) }

      before { sign_in(user) }

      it 'sets properties' do
        put "/chat/api/chat_channels/#{chat_channel.id}.json", params: { name: 'joffrey', description: 'cat owner' }

        expect(chat_channel.reload.name).to eq('joffrey')
        expect(chat_channel.reload.description).to eq('cat owner')
      end

      it 'publishes an update' do
        messages = MessageBus.track_publish('/chat/channel-edits') do
          put "/chat/api/chat_channels/#{chat_channel.id}.json"
        end

        expect(messages[0].data[:chat_channel_id]).to eq(chat_channel.id)
      end

      it 'returns a valid chat channel' do
        put "/chat/api/chat_channels/#{chat_channel.id}.json"

        expect(response).to match_response_schema('chat_channel')
      end
    end
  end
end
