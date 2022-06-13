# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::ChatMessageReactor do
  fab!(:reacting_user) { Fabricate(:user) }
  fab!(:chat_channel) { Fabricate(:chat_channel) }
  fab!(:reactor) { described_class.new(reacting_user, chat_channel) }
  fab!(:message_1) { Fabricate(:chat_message, chat_channel: chat_channel, user: reacting_user) }

  describe '#react!' do
    context 'user can’t see this channel' do
      fab!(:chatable) { Fabricate(:direct_message_channel) }
      fab!(:chat_channel) { Fabricate(:chat_channel, chatable: chatable) }
      fab!(:message_1) { Fabricate(:chat_message, chat_channel: chat_channel) }
      fab!(:reactor) { described_class.new(reacting_user, chat_channel) }

      it 'raises an error' do
        expect {
          reactor.react!(message_id: message_1.id, react_action: :something, emoji: ':+1:')
        }.to raise_error(Discourse::InvalidAccess)
      end
    end

    context 'user can see this channel' do
      context 'removing a reaction' do
        context 'the reaction exists' do
          before do
            Fabricate(:chat_message_reaction, chat_message: message_1, user: reacting_user, emoji: ':+1:')
          end

          it 'removes the reaction' do
            ChatPublisher.expects(:publish_reaction!).once

            expect {
              reactor.react!(message_id: message_1.id, react_action: :remove, emoji: ':+1:')
            }.to change(ChatMessageReaction, :count).by(-1)

          end

          context 'the user is not member of channel' do
            it 'creates a membership' do
              expect {
                reactor.react!(message_id: message_1.id, react_action: :remove, emoji: ':+1:')
              }.to change(UserChatChannelMembership, :count).by(1)
            end
          end

          context 'the user is member of channel' do
            before do
              Fabricate(:user_chat_channel_membership, chat_channel: chat_channel, user: reacting_user)
            end

            it 'doesn’t create a membership' do
              expect {
                reactor.react!(message_id: message_1.id, react_action: :remove, emoji: ':+1:')
              }.to change(UserChatChannelMembership, :count).by(0)
            end
          end
        end

        context 'the reaction doesn’t exist' do
          it 'doesn’t remove any reaction' do
            ChatPublisher.expects(:publish_reaction!).once

            expect {
              reactor.react!(message_id: message_1.id, react_action: :remove, emoji: ':+1:')
            }.to change(ChatMessageReaction, :count).by(0)
          end
        end
      end

      context 'adding a reaction' do
        context 'a reaction with this emoji exists' do
          before do
            reactor.react!(message_id: message_1.id, react_action: :add, emoji: ':+1:')
          end

          it 'doesn’t create a new reaction' do
            ChatPublisher.expects(:publish_reaction!).once

            expect {
              reactor.react!(message_id: message_1.id, react_action: :add, emoji: ':+1:')
            }.to change(ChatMessageReaction, :count).by(0)
          end
        end

        context 'a reaction with this emoji doesn’t exist' do
          it 'doesn’t create a new reaction' do
            ChatPublisher.expects(:publish_reaction!).once

            expect {
              reactor.react!(message_id: message_1.id, react_action: :add, emoji: ':+1:')
            }.to change(ChatMessageReaction, :count).by(1)
          end
        end
      end

      context 'react_action is invalid' do
        it 'raises an error' do
          expect {
            reactor.react!(message_id: message_1.id, react_action: :something, emoji: ':+1:')
          }.to raise_error(Discourse::InvalidParameters)
        end
      end

      context 'emoji is invalid' do
        it 'raises an error' do
          expect {
            reactor.react!(message_id: message_1.id, react_action: :add, emoji: ':foo-bar-baz:')
          }.to raise_error(Discourse::InvalidParameters)
        end
      end

      context 'max reactions reached' do
        before do
          emojis = Emoji.all.slice(0, DiscourseChat::ChatMessageReactor::MAX_REACTIONS_LIMIT)
          emojis.each do |emoji|
            Fabricate(:chat_message_reaction, chat_message: message_1, emoji: emoji)
          end
        end

        context 'adding a new reaction' do
          it 'raises an error' do
            expect {
              reactor.react!(message_id: message_1.id, react_action: :add, emoji: ':heart:')
            }.to raise_error(Discourse::InvalidAccess)
          end
        end

        context 'removing reaction' do
          it 'doesn’t raise an error' do
            expect {
              reactor.react!(message_id: message_1.id, react_action: :remove, emoji: Emoji.all.first)
            }.to_not raise_error(Discourse::InvalidAccess)
          end
        end
      end

      context 'user is staff' do
        fab!(:reacting_user) { Fabricate(:admin) }
        fab!(:reactor) { described_class.new(reacting_user, chat_channel) }

        context 'channel is opened' do
          it 'doesn’t raise an error' do
            expect {
              reactor.react!(message_id: message_1.id, react_action: :add, emoji: ':+1:')
            }.to_not raise_error(Discourse::InvalidAccess)
          end
        end

        context 'channel is archived' do
          fab!(:chat_channel) { Fabricate(:chat_channel, status: :archived) }
          fab!(:reactor) { described_class.new(reacting_user, chat_channel) }

          it 'raises an error' do
            expect {
              reactor.react!(message_id: message_1.id, react_action: :add, emoji: ':+1:')
            }.to raise_error(Discourse::InvalidAccess)
          end
        end

        context 'channel is closed' do
          fab!(:chat_channel) { Fabricate(:chat_channel, status: :closed) }
          fab!(:reactor) { described_class.new(reacting_user, chat_channel) }

          it 'doesn’t raise an error' do
            expect {
              reactor.react!(message_id: message_1.id, react_action: :add, emoji: ':+1:')
            }.to_not raise_error(Discourse::InvalidAccess)
          end
        end

        context 'channel is read only' do
          fab!(:chat_channel) { Fabricate(:chat_channel, status: :read_only) }
          fab!(:reactor) { described_class.new(reacting_user, chat_channel) }

          it 'raises an error' do
            expect {
              reactor.react!(message_id: message_1.id, react_action: :add, emoji: ':+1:')
            }.to raise_error(Discourse::InvalidAccess)
          end
        end
      end

      context 'user is not staff' do
        context 'channel is opened' do
          it 'doesn’t raise an error' do
            expect {
              reactor.react!(message_id: message_1.id, react_action: :add, emoji: ':+1:')
            }.to_not raise_error(Discourse::InvalidAccess)
          end
        end

        context 'channel is archived' do
          fab!(:chat_channel) { Fabricate(:chat_channel, status: :archived) }
          fab!(:reactor) { described_class.new(reacting_user, chat_channel) }

          it 'raises an error' do
            expect {
              reactor.react!(message_id: message_1.id, react_action: :add, emoji: ':+1:')
            }.to raise_error(Discourse::InvalidAccess)
          end
        end

        context 'channel is closed' do
          fab!(:chat_channel) { Fabricate(:chat_channel, status: :closed) }
          fab!(:reactor) { described_class.new(reacting_user, chat_channel) }

          it 'raises an error' do
            expect {
              reactor.react!(message_id: message_1.id, react_action: :add, emoji: ':+1:')
            }.to raise_error(Discourse::InvalidAccess)
          end
        end

        context 'channel is read only' do
          fab!(:chat_channel) { Fabricate(:chat_channel, status: :read_only) }
          fab!(:reactor) { described_class.new(reacting_user, chat_channel) }

          it 'raises an error' do
            expect {
              reactor.react!(message_id: message_1.id, react_action: :add, emoji: ':+1:')
            }.to raise_error(Discourse::InvalidAccess)
          end
        end
      end
    end
  end
end
