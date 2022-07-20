# frozen_string_literal: true

class DiscourseChat::Api::CategoryChatablesController < ApplicationController
  def permissions
    category = Category.find(params[:id])

    if category.read_restricted?
      permissions =
        Group
          .joins(:category_groups)
          .where(category_groups: { category_id: category.id })
          .joins("LEFT OUTER JOIN group_users ON groups.id = group_users.group_id")
          .group("groups.id", "groups.name")
          .pluck("groups.name", "COUNT(group_users.user_id)")

      group_names = permissions.map { |p| "@#{p[0]}" }
      members_count = permissions.sum { |p| p[1].to_i }

      permissions_result = {
        allowed_groups: group_names,
        members_count: members_count,
        private: true,
      }
    else
      everyone_group = Group.find(Group::AUTO_GROUPS[:everyone])

      permissions_result = { allowed_groups: ["@#{everyone_group.name}"], private: false }
    end

    render json: permissions_result
  end
end
