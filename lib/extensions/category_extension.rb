# frozen_string_literal: true

module DiscourseChat::CategoryExtension
  extend ActiveSupport::Concern

  include Chatable

  prepended { has_one :category_channel, as: :chatable }

  def cannot_delete_reason
    return I18n.t("category.cannot_delete.has_chat_channels") if category_channel
    super
  end
end
