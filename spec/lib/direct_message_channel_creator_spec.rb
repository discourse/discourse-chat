# frozen_string_literal: true

require 'rails_helper'

describe DiscourseChat::DirectMessageChannelCreator do
  fab!(:user_1) { Fabricate(:user) }
  fab!(:user_2) { Fabricate(:user) }

  context 'existing direct message channel' do
    fab!(:dm_chat_channel) { Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel, users: [user_1, user_2])) }

    it 'doesn’t create a new chat channel' do
      expect {
        subject.create!([user_1, user_2])
      }.to change { ChatChannel.count }.by(0)
    end
  end

  context 'non existing direct message channel' do
    it 'creates a new chat channel' do
      expect {
        subject.create!([user_1, user_2])
      }.to change { ChatChannel.count }.by(1)
    end
  end
end
