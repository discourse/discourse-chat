# frozen_string_literal: true

class ChatSeeder
  def execute(args = {})
    if SiteSetting.chat_channel_archive_category_id <= 0
      SiteSetting.chat_channel_archive_category_id = SiteSetting.uncategorized_category_id
    end

    return unless SiteSetting.needs_chat_seeded

    begin
      staff_category = Category.find_by(id: SiteSetting.staff_category_id)
      chat_channel = create_staff_chat_channel(staff_category)
      auto_join_users(chat_channel)
    rescue => error
      Rails.logger.warn("Error seeding chat staff category - #{error.inspect}")
    ensure
      SiteSetting.needs_chat_seeded = false
    end
  end

  def create_staff_chat_channel(staff_category)
    return unless staff_category

    chat_channel = ChatChannel.create(chatable: staff_category)
    staff_category.custom_fields[DiscourseChat::HAS_CHAT_ENABLED] = true
    staff_category.save!
    chat_channel
  end

  def auto_join_users(chat_channel)
    group_ids = chat_channel.allowed_group_ids
    users = User.not_suspended.joins(:group_users).where(group_users: { group_id:  group_ids }).uniq
    users.each do |user|
      UserChatChannelMembership.create!(user: user, chat_channel: chat_channel, following: true)
    end
  end
end
