# frozen_string_literal: true

class BasicUserWithStatusSerializer < BasicUserSerializer
  attributes :status

  def include_status?
    SiteSetting.enable_user_status && user.has_status?
  end

  def status
    UserStatusSerializer.new(user.user_status, root: false)
  end
end
