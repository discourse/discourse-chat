# frozen_string_literal: true

require "rails_helper"

describe ChatSeeder do
  fab!(:staff_category) { Fabricate(:private_category, name: "Staff", group: Group[:staff]) }
  fab!(:general_category) { Fabricate(:category, name: "General") }

  fab!(:staff_user1) do
    Fabricate(:user, last_seen_at: 1.minute.ago, groups: [Group[:staff], Group[:everyone]])
  end
  fab!(:staff_user2) do
    Fabricate(:user, last_seen_at: 1.minute.ago, groups: [Group[:staff], Group[:everyone]])
  end

  fab!(:regular_user) { Fabricate(:user, last_seen_at: 1.minute.ago, groups: [Group[:everyone]]) }

  before do
    SiteSetting.staff_category_id = staff_category.id
    SiteSetting.general_category_id = general_category.id
    Jobs.run_immediately!
  end

  def assert_channel_was_correctly_seeded(channel, group)
    expect(channel).to be_present
    expect(channel.auto_join_users).to eq(true)

    expected_members_count = GroupUser.where(group: group).count
    memberships_count =
      UserChatChannelMembership.automatic.where(chat_channel: channel, following: true).count

    expect(memberships_count).to eq(expected_members_count)
  end

  it "seeds default channels" do
    ChatSeeder.new.execute

    staff_channel = ChatChannel.find_by(chatable: staff_category)
    general_channel = ChatChannel.find_by(chatable: general_category)

    assert_channel_was_correctly_seeded(staff_channel, Group[:staff])
    assert_channel_was_correctly_seeded(general_channel, Group[:everyone])

    expect(staff_category.custom_fields[Chat::HAS_CHAT_ENABLED]).to eq(true)
    expect(general_category.reload.custom_fields[Chat::HAS_CHAT_ENABLED]).to eq(true)
    expect(SiteSetting.needs_chat_seeded).to eq(false)
  end

  it "applies a name to the general category channel" do
    expected_name = general_category.name

    ChatSeeder.new.execute

    general_channel = ChatChannel.find_by(chatable: general_category)
    expect(general_channel.name).to eq(expected_name)
  end

  it "applies a name to the staff category channel" do
    expected_name = staff_category.name

    ChatSeeder.new.execute

    staff_channel = ChatChannel.find_by(chatable: staff_category)
    expect(staff_channel.name).to eq(expected_name)
  end

  it "does nothing when 'SiteSetting.needs_chat_seeded' is false" do
    SiteSetting.needs_chat_seeded = false

    expect { ChatSeeder.new.execute }.not_to change { ChatChannel.count }
  end
end
