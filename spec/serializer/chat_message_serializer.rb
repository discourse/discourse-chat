# frozen_string_literal: true

require 'rails_helper'

describe ChatMessageSerializer do
  fab!(:chat_channel) { Fabricate(:chat_channel) }
  fab!(:message_1) { Fabricate(:chat_message, user: Fabricate(:user), chat_channel: chat_channel) }
  let(:guardian) { Guardian.new(Fabricate(:user)) }

  subject do
    described_class.new(message_1, scope: guardian, root: nil)
  end

  describe '#reactions' do
    fab!(:custom_emoji) { CustomEmoji.create!(name: 'trout', upload: Fabricate(:upload)) }
    fab!(:reaction_1) { Fabricate(:chat_message_reaction, chat_message: message_1, emoji: custom_emoji.name) }

    context 'an emoji used in a reaction has been destroyed' do
      it 'doesn’t return the reaction' do
        Emoji.clear_cache

        expect(subject.as_json[:reactions]['trout']).to be_present

        custom_emoji.destroy!
        Emoji.clear_cache

        expect(subject.as_json[:reactions]['trout']).to_not be_present
      end
    end
  end
end
