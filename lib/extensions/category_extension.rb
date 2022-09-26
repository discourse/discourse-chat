# frozen_string_literal: true

module DiscourseChat::CategoryExtension
  extend ActiveSupport::Concern

  prepended { has_one :chat_channel, as: :chatable }

  def cannot_delete_reason
    return I18n.t("category.cannot_delete.has_chat_channels") if chat_channel
    super
  end
end
