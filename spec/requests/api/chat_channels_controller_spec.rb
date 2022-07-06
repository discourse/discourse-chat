# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::Api::ChatChannelsController do
  before do
    SiteSetting.chat_enabled = true
    SiteSetting.chat_allowed_groups = Group::AUTO_GROUPS[:everyone]
  end

  describe '#create' do
    fab!(:admin) { Fabricate(:admin) }
    fab!(:category) { Fabricate(:category) }

    let(:params) do
      {
        type: category.class.name,
        id: category.id,
        name: 'channel name',
        description: 'My new channel'
      }
    end

    before { sign_in(admin) }

    it 'creates a channel associated to a category' do
      put '/chat/chat_channels.json', params: params

      new_channel = ChatChannel.last

      expect(new_channel.name).to eq(params[:name])
      expect(new_channel.description).to eq(params[:description])
      expect(new_channel.chatable_type).to eq(category.class.name)
      expect(new_channel.chatable_id).to eq(category.id)
    end

    it 'creates a channel sets auto_join_users to false by default' do
      put '/chat/chat_channels.json', params: params

      new_channel = ChatChannel.last

      expect(new_channel.auto_join_users).to eq(false)
    end

    it 'creates a channel with auto_join_users set to true' do
      put '/chat/chat_channels.json', params: params.merge(auto_join_users: true)

      new_channel = ChatChannel.last

      expect(new_channel.auto_join_users).to eq(true)
    end

    describe 'triggers the auto-join process' do
      fab!(:chatters_group) { Fabricate(:group) }
      fab!(:user) { Fabricate(:user, last_seen_at: 15.minute.ago) }

      before do
        Jobs.run_immediately!
        Fabricate(:category_group, category: category, group: chatters_group)
        chatters_group.add(user)
      end

      it 'joins the user when auto_join_users is true' do
        put '/chat/chat_channels.json', params: params.merge(auto_join_users: true)

        created_channel_id = response.parsed_body.dig('chat_channel', 'id')
        membership_exists = UserChatChannelMembership.find_by(
          user: user, chat_channel_id: created_channel_id, following: true
        )

        expect(membership_exists).to be_present
      end

      it "doesn't join the user when auto_join_users is false" do
        put '/chat/chat_channels.json', params: params.merge(auto_join_users: false)

        created_channel_id = response.parsed_body.dig('chat_channel', 'id')
        membership_exists = UserChatChannelMembership.find_by(
          user: user, chat_channel_id: created_channel_id, following: true
        )

        expect(membership_exists).to be_nil
      end
    end
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
      fab!(:chat_channel) { Fabricate(:chat_channel, name: 'something', description: 'something else') }

      before { sign_in(user) }

      it 'nullifies the field and doesn’t store an empty string' do
        put "/chat/api/chat_channels/#{chat_channel.id}.json", params: { name: '  ' }

        expect(chat_channel.reload.name).to be_nil
      end

      it 'doesn’t nullify the description' do
        put "/chat/api/chat_channels/#{chat_channel.id}.json", params: { name: '  ' }

        expect(chat_channel.reload.description).to eq('something else')
      end
    end

    context 'user provided an empty description' do
      fab!(:user) { Fabricate(:admin) }
      fab!(:chat_channel) { Fabricate(:chat_channel, name: 'something else', description: 'something') }

      before { sign_in(user) }

      it 'nullifies the field and doesn’t store an empty string' do
        put "/chat/api/chat_channels/#{chat_channel.id}.json", params: { description: '  ' }

        expect(chat_channel.reload.description).to be_nil
      end

      it 'doesn’t nullify the name' do
        put "/chat/api/chat_channels/#{chat_channel.id}.json", params: { description: '  ' }

        expect(chat_channel.reload.name).to eq('something else')
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

        expect(response).to match_response_schema('category_chat_channel')
      end

      describe 'Updating a channel to add users automatically' do
        it 'sets the channel to auto-update users automatically' do
          put "/chat/api/chat_channels/#{chat_channel.id}.json", params: { auto_join_users: true }

          expect(response.parsed_body['auto_join_users']).to eq(true)
        end

        it 'tolds staff members to slow down when toggling auto-update multiple times' do
          RateLimiter.enable

          put "/chat/api/chat_channels/#{chat_channel.id}.json", params: { auto_join_users: true }
          put "/chat/api/chat_channels/#{chat_channel.id}.json", params: { auto_join_users: false }
          put "/chat/api/chat_channels/#{chat_channel.id}.json", params: { auto_join_users: true }

          expect(response.status).to eq(429)
        end

        describe 'triggers the auto-join process' do
          fab!(:chatters_group) { Fabricate(:group) }
          fab!(:another_user) { Fabricate(:user, last_seen_at: 15.minute.ago) }

          before do
            Jobs.run_immediately!
            Fabricate(:category_group, category: chat_channel.chatable, group: chatters_group)
            chatters_group.add(another_user)
          end

          it 'joins the user when auto_join_users is true' do
            put "/chat/api/chat_channels/#{chat_channel.id}.json", params: { auto_join_users: true }

            created_channel_id = response.parsed_body['id']
            membership_exists = UserChatChannelMembership.find_by(
              user: another_user, chat_channel_id: created_channel_id, following: true
            )

            expect(membership_exists).to be_present
          end

          it "doesn't join the user when auto_join_users is false" do
            put "/chat/api/chat_channels/#{chat_channel.id}.json", params: { auto_join_users: false }

            created_channel_id = response.parsed_body['id']
            membership_exists = UserChatChannelMembership.find_by(
              user: another_user, chat_channel_id: created_channel_id, following: true
            )

            expect(membership_exists).to be_nil
          end
        end
      end
    end
  end
end
