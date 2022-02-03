# frozen_string_literal: true

require_dependency 'reviewable'

class ReviewableChatMessage < Reviewable

  def chat_message
    @chat_message ||= target
  end
  def chat_message_creator
    @chat_message_creator ||= chat_message.user
  end

  def build_actions(actions, guardian, args)
    return unless pending?
    return if chat_message.blank?

    agree = actions.add_bundle("#{id}-agree", icon: 'thumbs-up', label: 'reviewables.actions.agree.title')

    if !chat_message.deleted_at?
      build_action(actions, :agree_and_hide, icon: 'far-eye-slash', bundle: agree)
    end

    build_action(actions, :agree_and_keep, icon: 'thumbs-up', bundle: agree)

    if guardian.can_suspend?(chat_message_creator)
      build_action(actions, :agree_and_suspend, icon: 'ban', bundle: agree, client_action: 'suspend')
      build_action(actions, :agree_and_silence, icon: 'microphone-slash', bundle: agree, client_action: 'silence')
    end

    build_action(actions, :disagree, icon: 'thumbs-down')
    build_action(actions, :ignore, icon: 'external-link-alt')

    delete = actions.add_bundle("#{id}-delete", icon: "far-trash-alt", label: "reviewables.actions.delete.title")
    build_action(actions, :delete_and_ignore, icon: 'external-link-alt', bundle: delete)
    build_action(actions, :delete_and_agree, icon: 'thumbs-up', bundle: delete)
  end

  def perform_agree_and_keep(performed_by, args)
    # agree(performed_by, args)
  end

  def perform_agree_and_hide(performed_by, args)
    # agree(performed_by, args)
  end

  def perform_agree_and_suspend(performed_by, args)
    # agree(performed_by, args)
  end

  def perform_agree_and_silence(performed_by, args)
    # agree(performed_by, args)
  end

  def perform_disagree(performed_by, args)
    # agree(performed_by, args)
  end

  def perform_ignore(performed_by, args)
    # agree(performed_by, args)
  end

  def perform_delete_and_ignore(performed_by, args)
    # agree(performed_by, args)
  end

  def perform_delete_and_agree(performed_by, args)
    # agree(performed_by, args)
  end

  private

  def build_action(actions, id, icon:, button_class: nil, bundle: nil, client_action: nil, confirm: false)
    actions.add(id, bundle: bundle) do |action|
      prefix = "reviewables.actions.#{id}"
      action.icon = icon
      action.button_class = button_class
      action.label = "chat.#{prefix}.title"
      action.description = "chat.#{prefix}.description"
      action.client_action = client_action
      action.confirm_message = "#{prefix}.confirm" if confirm
    end
  end

end
