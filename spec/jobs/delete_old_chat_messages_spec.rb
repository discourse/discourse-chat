# frozen_string_literal: true

require 'rails_helper'

describe Jobs::DeleteOldChatMessages do
  base_date = DateTime.parse('2020-12-01 00:00 UTC')

  fab!(:public_channel) { Fabricate(:chat_channel) }
  fab!(:public_days_old_0) {
    Fabricate(:chat_message, chat_channel: public_channel, message: "hi", created_at: base_date)
  }
  fab!(:public_days_old_10) {
    Fabricate(:chat_message, chat_channel: public_channel, message: "hi", created_at: base_date - 10.days - 1.second)
  }
  fab!(:public_days_old_20) {
    Fabricate(:chat_message, chat_channel: public_channel, message: "hi", created_at: base_date - 20.days - 1.second)
  }
  fab!(:public_days_old_30) {
    Fabricate(:chat_message, chat_channel: public_channel, message: "hi", created_at: base_date - 30.days - 1.second)
  }

  fab!(:dm_channel) { Fabricate(:chat_channel, chatable: Fabricate(:direct_message_channel, users: [Fabricate(:user)])) }
  fab!(:dm_days_old_0) {
    Fabricate(:chat_message, chat_channel: dm_channel, message: "hi", created_at: base_date)
  }
  fab!(:dm_days_old_10) {
    Fabricate(:chat_message, chat_channel: dm_channel, message: "hi", created_at: base_date - 10.days - 1.second)
  }
  fab!(:dm_days_old_20) {
    Fabricate(:chat_message, chat_channel: dm_channel, message: "hi", created_at: base_date - 20.days - 1.second)
  }
  fab!(:dm_days_old_30) {
    Fabricate(:chat_message, chat_channel: dm_channel, message: "hi", created_at: base_date - 30.days - 1.second)
  }

  before do
    freeze_time(base_date)
  end

  it "doesn't delete messages when settings are 0" do
    SiteSetting.chat_channel_retention_days = 0
    SiteSetting.chat_dm_retention_days = 0

    expect { described_class.new.execute }.to change { ChatMessage.count }.by(0)
  end

  describe "public channels" do
    it "deletes public messages correctly" do
      SiteSetting.chat_channel_retention_days = 20
      described_class.new.execute
      expect(public_days_old_0.deleted_at).to be_nil
      expect(public_days_old_10.deleted_at).to be_nil
      expect { public_days_old_20 }.to raise_exception(ActiveRecord::RecordNotFound)
      expect { public_days_old_30 }.to raise_exception(ActiveRecord::RecordNotFound)
    end

    it "does nothing when no messages fall in the time range" do
      SiteSetting.chat_channel_retention_days = 800
      expect { described_class.new.execute }.to change { ChatMessage.in_public_channel.count }.by(0)
    end

    it "resets last_read_message_id from memberships" do
      SiteSetting.chat_channel_retention_days = 20
      membership = UserChatChannelMembership.create!(user: Fabricate(:user), chat_channel: public_channel, last_read_message_id: public_days_old_30.id, following: true, desktop_notification_level: 2, mobile_notification_level: 2)
      described_class.new.execute

      expect(membership.reload.last_read_message_id).to be_nil
    end
  end

  describe "dm channels" do
    it "deletes public messages correctly" do
      SiteSetting.chat_dm_retention_days = 20
      described_class.new.execute
      expect(dm_days_old_0.deleted_at).to be_nil
      expect(dm_days_old_10.deleted_at).to be_nil
      expect { dm_days_old_20 }.to raise_exception(ActiveRecord::RecordNotFound)
      expect { dm_days_old_30 }.to raise_exception(ActiveRecord::RecordNotFound)
    end

    it "does nothing when no messages fall in the time range" do
      SiteSetting.chat_dm_retention_days = 800
      expect { described_class.new.execute }.to change { ChatMessage.in_dm_channel.count }.by(0)
    end

    it "resets last_read_message_id from memberships" do
      SiteSetting.chat_dm_retention_days = 20
      membership = UserChatChannelMembership.create!(user: Fabricate(:user), chat_channel: dm_channel, last_read_message_id: dm_days_old_30.id, following: true, desktop_notification_level: 2, mobile_notification_level: 2)
      described_class.new.execute

      expect(membership.reload.last_read_message_id).to be_nil
    end
  end
end
