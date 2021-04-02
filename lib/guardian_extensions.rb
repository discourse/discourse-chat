# frozen_string_literal: true

module DiscourseTopicChat::GuardianExtensions

  def can_enable_chat?(topic)
    can_perform_action_available_to_group_moderators?(topic)
  end

  def can_chat?(topic_chat_record)
    # TODO: separate chatting permission?
    can_create_post?(topic_chat_record.topic) && !topic.closed? && !topic.archived?
  end
end
