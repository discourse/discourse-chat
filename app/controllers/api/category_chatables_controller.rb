# frozen_string_literal: true

class DiscourseChat::Api::CategoryChatablesController < ApplicationController
  def permissions
    permissions = Group
      .joins(:category_groups)
      .where(category_groups: { category_id: params[:id] })
      .pluck(:name).map! { |name| "@#{name}" }

    render json: permissions, root: false
  end
end
