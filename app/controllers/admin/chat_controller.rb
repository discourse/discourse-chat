# frozen_string_literal: true

class DiscourseChat::AdminChatController < ::ApplicationController
  def index
    render json: success_json
  end
end
