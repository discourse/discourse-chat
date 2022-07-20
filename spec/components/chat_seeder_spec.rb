# frozen_string_literal: true

require "rails_helper"

describe ChatSeeder do
  fab!(:staff_category) { Fabricate(:private_category, group: Group[:staff]) }
  fab!(:site_feedback_category) { Fabricate(:private_category, group: Group[:everyone]) }

  fab!(:staff_user1) { Fabricate(:user, last_seen_at: 1.minute.ago, groups: [Group[:staff]]) }
  fab!(:staff_user2) { Fabricate(:user, last_seen_at: 1.minute.ago, groups: [Group[:staff]]) }

  fab!(:regular_user) { Fabricate(:user, last_seen_at: 1.minute.ago, groups: [Group[:everyone]]) }

  before do
    SiteSetting.staff_category_id = staff_category.id
    SiteSetting.meta_category_id = site_feedback_category.id
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
    site_feedback_channel = ChatChannel.find_by(chatable: site_feedback_category)

    assert_channel_was_correctly_seeded(staff_channel, Group[:staff])
    assert_channel_was_correctly_seeded(site_feedback_channel, Group[:everyone])

    expect(staff_category.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]).to eq(true)
    expect(site_feedback_category.reload.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]).to eq(true)
    expect(SiteSetting.needs_chat_seeded).to eq(false)
  end

  it "applies a different name to the meta category channel" do
    expected_name = I18n.t("chat.channel.default_titles.site_feedback")

    ChatSeeder.new.execute

    site_feedback_channel = ChatChannel.find_by(chatable: site_feedback_category)
    expect(site_feedback_channel.name).to eq(expected_name)
  end

  it "does nothing when 'SiteSetting.needs_chat_seeded' is false" do
    SiteSetting.needs_chat_seeded = false

    expect { ChatSeeder.new.execute }.to change { ChatChannel.count }.by(0)
  end
end
