# frozen_string_literal: true

require_dependency 'reviewable'

class ReviewableChatMessage < Reviewable
  def build_actions(actions, guardian, args)
    return unless pending?
    puts "##########"
    puts target
    puts "##########"
    build_action(actions, :approve, icon: 'check')

    # if target.trashed? && guardian.can_recover_target?(target)
      # build_action(actions, :approve_and_restore, icon: 'check')
    # elsif target.hidden?
      # build_action(actions, :approve_and_unhide, icon: 'check')
    # else
      # build_action(actions, :approve, icon: 'check')
    # end

    # reject = actions.add_bundle(
      # "#{id}-reject", icon: 'times', label: 'reviewables.actions.reject.bundle_title'
    # )

    # if target.trashed?
      # build_action(actions, :reject_and_keep_deleted, icon: 'trash-alt', bundle: reject)
    # elsif guardian.can_delete_target_or_topic?(target)
      # build_action(actions, :reject_and_delete, icon: 'trash-alt', bundle: reject)
    # end

    # if guardian.can_suspend?(target_created_by)
      # build_action(actions, :reject_and_suspend, icon: 'ban', bundle: reject, client_action: 'suspend')
      # build_action(actions, :reject_and_silence, icon: 'microphone-slash', bundle: reject, client_action: 'silence')
    # end
  end

  def perform_approve(performed_by, _args)
    successful_transition :approved, recalculate_score: false
  end

  def perform_reject_and_keep_deleted(performed_by, _args)
    successful_transition :rejected, recalculate_score: false
  end

  def perform_approve_and_restore(performed_by, _args)
    # PostDestroyer.new(performed_by, target).recover
    # target.update(deleted_at:

    successful_transition :approved, recalculate_score: false
  end

  def perform_approve_and_unhide(performed_by, _args)
    target.unhide!

    successful_transition :approved, recalculate_score: false
  end

  def perform_reject_and_delete(performed_by, _args)
    # PostDestroyer.new(performed_by, target, reviewable: self).destroy


    successful_transition :rejected, recalculate_score: false
  end

  def perform_reject_and_suspend(performed_by, _args)
    successful_transition :rejected, recalculate_score: false
  end

  private

  def build_action(actions, id, icon:, button_class: nil, bundle: nil, client_action: nil, confirm: false)
    actions.add(id, bundle: bundle) do |action|
      prefix = "reviewables.actions.#{id}"
      action.icon = icon
      action.button_class = button_class
      action.label = "#{prefix}.title"
      action.description = "#{prefix}.description"
      action.client_action = client_action
      action.confirm_message = "#{prefix}.confirm" if confirm
    end
  end

  def successful_transition(to_state, recalculate_score: true)
    create_result(:success, to_state)  do |result|
      result.recalculate_score = recalculate_score
      result.update_flag_stats = { status: to_state, user_ids: [created_by_id] }
    end
  end
end
