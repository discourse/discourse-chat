# frozen_string_literal: true

class ChatSeeder
  def execute(args = {})
    return unless SiteSetting.needs_chat_seeded

    begin
      staff_category = Category.find_by(id: SiteSetting.staff_category_id)
      create_staff_chat_channel(staff_category)
    rescue => error
      Rails.logger.warn("Error seeding chat staff category - #{error.inspect}")
    ensure
      SiteSetting.needs_chat_seeded = false
    end
  end

  def create_staff_chat_channel(staff_category)
    return unless staff_category

    ChatChannel.create(chatable: staff_category)
    staff_category.custom_fields[DiscourseChat::HAS_CHAT_ENABLED] = true
    staff_category.save!
  end
end
