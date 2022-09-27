# frozen_string_literal: true

class ChatSeeder
  def execute(args = {})
    return if !SiteSetting.needs_chat_seeded

    begin
      create_category_channel_from(SiteSetting.staff_category_id)
      create_category_channel_from(SiteSetting.meta_category_id)
    rescue => error
      Rails.logger.warn("Error seeding chat category - #{error.inspect}")
    ensure
      SiteSetting.needs_chat_seeded = false
    end
  end

  def create_category_channel_from(category_id)
    category = Category.find_by(id: category_id)
    return if category.nil?

    name =
      if category_id == SiteSetting.meta_category_id
        I18n.t("chat.channel.default_titles.site_feedback")
      else
        nil
      end

    chat_channel = ChatChannel.create!(chatable: category, auto_join_users: true, name: name)
    category.custom_fields[DiscourseChat::HAS_CHAT_ENABLED] = true
    category.save!
    DiscourseChat::ChatChannelMembershipManager.enforce_automatic_channel_memberships(chat_channel)
    chat_channel
  end
end
