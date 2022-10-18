# frozen_string_literal: true

class DiscourseChat::EmojisController < DiscourseChat::ChatBaseController
  def index
    emojis = Emoji.all.group_by(&:group).except("default")
    render json: MultiJson.dump(emojis)
  end
end
