# frozen_string_literal: true

# name: discourse-chat
# about: Chat inside Discourse
# version: 0.3
# authors: Kane York, Mark VanLandingham, Martin Brennan, Joffrey Jaffeux
# url: https://github.com/discourse/discourse-chat
# transpile_js: true

enabled_site_setting :chat_enabled

register_asset 'stylesheets/common/common.scss'
register_asset 'stylesheets/common/d-progress-bar.scss'
register_asset 'stylesheets/common/incoming-chat-webhooks.scss'
register_asset 'stylesheets/mobile/chat-message.scss', :mobile
register_asset 'stylesheets/common/chat-reply.scss'
register_asset 'stylesheets/common/chat-message.scss'
register_asset 'stylesheets/common/chat-message-left-gutter.scss'
register_asset 'stylesheets/common/chat-message-info.scss'
register_asset 'stylesheets/common/chat-composer-inline-button.scss'
register_asset 'stylesheets/common/chat-replying-indicator.scss'
register_asset 'stylesheets/mobile/chat-replying-indicator.scss', :mobile
register_asset 'stylesheets/common/chat-composer.scss'
register_asset 'stylesheets/desktop/chat-composer.scss', :desktop
register_asset 'stylesheets/mobile/chat-composer.scss', :mobile
register_asset 'stylesheets/common/direct-message-creator.scss'
register_asset 'stylesheets/common/chat-message-collapser.scss'
register_asset 'stylesheets/common/chat-message-images.scss'
register_asset 'stylesheets/common/chat-transcript.scss'
register_asset 'stylesheets/common/chat-composer-dropdown.scss'
register_asset 'stylesheets/common/chat-retention-reminder.scss'
register_asset 'stylesheets/common/chat-composer-uploads.scss'
register_asset 'stylesheets/common/chat-composer-upload.scss'
register_asset 'stylesheets/common/chat-selection-manager.scss'
register_asset 'stylesheets/mobile/chat-selection-manager.scss', :mobile
register_asset 'stylesheets/common/chat-channel-selector-modal.scss'
register_asset 'stylesheets/mobile/mobile.scss', :mobile
register_asset 'stylesheets/desktop/desktop.scss', :desktop
register_asset 'stylesheets/sidebar-extensions.scss'
register_asset 'stylesheets/common/chat-message-separator.scss'

register_svg_icon "comments"
register_svg_icon "comment-slash"
register_svg_icon "hashtag"
register_svg_icon "lock"

register_svg_icon "file-audio"
register_svg_icon "file-video"
register_svg_icon "file-image"

# route: /admin/plugins/chat
add_admin_route 'chat.admin.title', 'chat'

# Site setting validators must be loaded before initialize
require_relative "lib/validators/chat_default_channel_validator.rb"

after_initialize do
  module ::DiscourseChat
    PLUGIN_NAME = "discourse-chat"
    HAS_CHAT_ENABLED = "has_chat_enabled"

    class Engine < ::Rails::Engine
      engine_name PLUGIN_NAME
      isolate_namespace DiscourseChat
    end

    def self.allowed_group_ids
      SiteSetting.chat_allowed_groups.to_s.split("|").map(&:to_i)
    end
  end

  SeedFu.fixture_paths << Rails.root.join("plugins", "discourse-chat", "db", "fixtures").to_s

  load File.expand_path('../app/controllers/admin/admin_incoming_chat_webhooks_controller.rb', __FILE__)
  load File.expand_path('../app/controllers/chat_base_controller.rb', __FILE__)
  load File.expand_path('../app/controllers/chat_controller.rb', __FILE__)
  load File.expand_path('../app/controllers/chat_channels_controller.rb', __FILE__)
  load File.expand_path('../app/controllers/direct_messages_controller.rb', __FILE__)
  load File.expand_path('../app/controllers/incoming_chat_webhooks_controller.rb', __FILE__)
  load File.expand_path('../app/models/user_chat_channel_membership.rb', __FILE__)
  load File.expand_path('../app/models/chat_channel.rb', __FILE__)
  load File.expand_path('../app/models/chat_channel_archive.rb', __FILE__)
  load File.expand_path('../app/models/chat_draft.rb', __FILE__)
  load File.expand_path('../app/models/chat_message.rb', __FILE__)
  load File.expand_path('../app/models/chat_message_reaction.rb', __FILE__)
  load File.expand_path('../app/models/chat_message_revision.rb', __FILE__)
  load File.expand_path('../app/models/chat_mention.rb', __FILE__)
  load File.expand_path('../app/models/chat_upload.rb', __FILE__)
  load File.expand_path('../app/models/chat_webhook_event.rb', __FILE__)
  load File.expand_path('../app/models/direct_message_channel.rb', __FILE__)
  load File.expand_path('../app/models/direct_message_user.rb', __FILE__)
  load File.expand_path('../app/models/incoming_chat_webhook.rb', __FILE__)
  load File.expand_path('../app/models/reviewable_chat_message.rb', __FILE__)
  load File.expand_path('../app/models/chat_view.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_webhook_event_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_in_reply_to_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_message_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_channel_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_channel_settings_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_channel_index_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_channel_search_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_view_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/direct_message_channel_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/incoming_chat_webhook_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/admin_chat_index_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/user_chat_channel_membership_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/reviewable_chat_message_serializer.rb', __FILE__)
  load File.expand_path('../lib/chat_channel_fetcher.rb', __FILE__)
  load File.expand_path('../lib/chat_message_creator.rb', __FILE__)
  load File.expand_path('../lib/chat_message_processor.rb', __FILE__)
  load File.expand_path('../lib/chat_message_updater.rb', __FILE__)
  load File.expand_path('../lib/chat_message_rate_limiter.rb', __FILE__)
  load File.expand_path('../lib/chat_message_reactor.rb', __FILE__)
  load File.expand_path('../lib/chat_notifier.rb', __FILE__)
  load File.expand_path('../lib/chat_seeder.rb', __FILE__)
  load File.expand_path('../lib/chat_transcript_service.rb', __FILE__)
  load File.expand_path('../lib/message_mover.rb', __FILE__)
  load File.expand_path('../lib/chat_channel_archive_service.rb', __FILE__)
  load File.expand_path('../lib/direct_message_channel_creator.rb', __FILE__)
  load File.expand_path('../lib/guardian_extensions.rb', __FILE__)
  load File.expand_path('../lib/extensions/topic_view_serializer_extension.rb', __FILE__)
  load File.expand_path('../lib/extensions/detailed_tag_serializer_extension.rb', __FILE__)
  load File.expand_path('../lib/slack_compatibility.rb', __FILE__)
  load File.expand_path('../lib/post_notification_handler.rb', __FILE__)
  load File.expand_path('../app/jobs/regular/process_chat_message.rb', __FILE__)
  load File.expand_path('../app/jobs/regular/chat_channel_archive.rb', __FILE__)
  load File.expand_path('../app/jobs/regular/chat_channel_delete.rb', __FILE__)
  load File.expand_path('../app/jobs/regular/chat_notify_mentioned.rb', __FILE__)
  load File.expand_path('../app/jobs/regular/chat_notify_watching.rb', __FILE__)
  load File.expand_path('../app/jobs/scheduled/delete_old_chat_messages.rb', __FILE__)
  load File.expand_path('../app/jobs/scheduled/update_user_counts_for_chat_channels.rb', __FILE__)
  load File.expand_path('../app/services/chat_publisher.rb', __FILE__)

  if Discourse.allow_dev_populate?
    load File.expand_path('../lib/discourse_dev/public_channel.rb', __FILE__)
    load File.expand_path('../lib/discourse_dev/direct_channel.rb', __FILE__)
    load File.expand_path('../lib/discourse_dev/message.rb', __FILE__)
  end

  register_topic_custom_field_type(DiscourseChat::HAS_CHAT_ENABLED, :boolean)
  register_category_custom_field_type(DiscourseChat::HAS_CHAT_ENABLED, :boolean)

  UserUpdater::OPTION_ATTR.push(:chat_enabled)
  UserUpdater::OPTION_ATTR.push(:chat_isolated)
  UserUpdater::OPTION_ATTR.push(:only_chat_push_notifications)
  UserUpdater::OPTION_ATTR.push(:chat_sound)
  UserUpdater::OPTION_ATTR.push(:ignore_channel_wide_mention)

  register_reviewable_type ReviewableChatMessage

  reloadable_patch do |plugin|
    ReviewableScore.add_new_types([:needs_review])

    Site.preloaded_category_custom_fields << DiscourseChat::HAS_CHAT_ENABLED
    Site.markdown_additional_options["chat"] = {
      limited_pretty_text_features: ChatMessage::MARKDOWN_FEATURES,
      limited_pretty_text_markdown_rules: ChatMessage::MARKDOWN_IT_RULES
    }
    TopicList.preloaded_custom_fields << DiscourseChat::HAS_CHAT_ENABLED
    CategoryList.preloaded_topic_custom_fields << DiscourseChat::HAS_CHAT_ENABLED
    Search.preloaded_topic_custom_fields << DiscourseChat::HAS_CHAT_ENABLED

    Guardian.class_eval { include DiscourseChat::GuardianExtensions }
    TopicViewSerializer.class_eval { prepend DiscourseChat::TopicViewSerializerExtension }
    DetailedTagSerializer.class_eval { prepend DiscourseChat::DetailedTagSerializerExtension }
    Topic.class_eval {
      has_one :chat_channel, as: :chatable
    }
    Category.class_eval {
      has_one :chat_channel, as: :chatable
    }
    User.class_eval {
      has_many :user_chat_channel_memberships, dependent: :destroy
      has_many :chat_message_reactions, dependent: :destroy
      has_many :chat_mentions
    }
  end

  TopicQuery.add_custom_filter(::DiscourseChat::PLUGIN_NAME) do |results, topic_query|
    if SiteSetting.chat_enabled
      results = results.includes(:chat_channel)
    end
    results
  end

  if respond_to?(:register_upload_unused)
    register_upload_unused do |uploads|
      uploads
        .joins("LEFT JOIN chat_uploads cu ON cu.upload_id = uploads.id")
        .where("cu.upload_id IS NULL")
    end
  end

  if respond_to?(:register_upload_in_use)
    register_upload_in_use do |upload|
      ChatMessage.where("message LIKE ? OR message LIKE ?", "%#{upload.sha1}%", "%#{upload.base62_sha1}%").exists? ||
      ChatDraft.where("data LIKE ? OR data LIKE ?", "%#{upload.sha1}%", "%#{upload.base62_sha1}%").exists?
    end
  end

  add_to_serializer(:listable_topic, :has_chat_live) do
    true
  end

  add_to_serializer(:listable_topic, :include_has_chat_live?) do
    SiteSetting.chat_enabled &&
      scope.can_chat?(scope.user) &&
      object.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]
  end

  add_to_serializer(:user_card, :can_chat_user) do
    return false if !SiteSetting.chat_enabled
    return false if scope.user.blank?

    scope.user.id != object.id &&
      scope.can_chat?(scope.user) &&
      scope.can_chat?(object)
  end

  add_to_serializer(:current_user, :can_chat) do
    true
  end

  add_to_serializer(:current_user, :include_can_chat?) do
    return @can_chat if defined?(@can_chat)

    @can_chat = SiteSetting.chat_enabled && scope.can_chat?(object)
  end

  add_to_serializer(:current_user, :has_chat_enabled) do
    true
  end

  add_to_serializer(:current_user, :include_has_chat_enabled?) do
    return @has_chat_enabled if defined?(@has_chat_enabled)

    @has_chat_enabled = include_can_chat? && object.user_option.chat_enabled
  end

  add_to_serializer(:current_user, :chat_isolated) do
    true
  end

  add_to_serializer(:current_user, :include_chat_isolated?) do
    include_has_chat_enabled? && object.user_option.chat_isolated
  end

  add_to_serializer(:current_user, :chat_sound) do
    object.user_option.chat_sound
  end

  add_to_serializer(:current_user, :include_chat_sound?) do
    include_has_chat_enabled? && object.user_option.chat_sound
  end

  add_to_serializer(:current_user, :needs_channel_retention_reminder) do
    true
  end

  add_to_serializer(:current_user, :needs_dm_retention_reminder) do
    true
  end

  add_to_serializer(:current_user, :include_needs_channel_retention_reminder?) do
    include_has_chat_enabled? &&
      object.staff? &&
      !object.user_option.dismissed_channel_retention_reminder &&
      !SiteSetting.chat_channel_retention_days.zero?

  end

  add_to_serializer(:current_user, :include_needs_dm_retention_reminder?) do
    include_has_chat_enabled? &&
      !object.user_option.dismissed_dm_retention_reminder &&
      !SiteSetting.chat_dm_retention_days.zero?
  end

  add_to_serializer(:current_user, :chat_drafts) do
    ChatDraft
      .where(user_id: object.id)
      .pluck(:chat_channel_id, :data)
      .map do |row|
        { channel_id: row[0], data: row[1] }
      end
  end

  add_to_serializer(:current_user, :include_chat_drafts?) do
    include_has_chat_enabled?
  end

  add_to_serializer(:user_option, :chat_enabled) do
    object.chat_enabled
  end

  add_to_serializer(:user_option, :chat_isolated) do
    object.chat_isolated
  end

  add_to_serializer(:user_option, :chat_sound) do
    object.chat_sound
  end

  add_to_serializer(:user_option, :include_chat_sound?) do
    !object.chat_sound.blank?
  end

  add_to_serializer(:user_option, :only_chat_push_notifications) do
    object.only_chat_push_notifications
  end

  add_to_serializer(:user_option, :ignore_channel_wide_mention) do
    object.ignore_channel_wide_mention
  end

  RETENTION_SETTINGS_TO_USER_OPTION_FIELDS = {
    chat_channel_retention_days: :dismissed_channel_retention_reminder,
    chat_dm_retention_days: :dismissed_dm_retention_reminder
  }
  on(:site_setting_changed) do |name, old_value, new_value|
    user_option_field = RETENTION_SETTINGS_TO_USER_OPTION_FIELDS[name.to_sym]
    begin
      if user_option_field && old_value != new_value && !new_value.zero?
        UserOption.where(user_option_field => true).update_all(user_option_field => false)
      end
    rescue => e
      Rails.logger.warn("Error updating user_options fields after chat retention settings changed: #{e}")
    end
  end

  on(:post_alerter_after_save_post) do |post, new_record, notified|
    next if !new_record
    DiscourseChat::PostNotificationHandler.new(post, notified).handle
  end

  register_presence_channel_prefix("chat") do |channel|
    next nil unless channel == "/chat/online"
    config = PresenceChannel::Config.new
    config.allowed_group_ids = DiscourseChat.allowed_group_ids
    config
  end

  register_presence_channel_prefix("chat-reply") do |channel_name|
    if chat_channel_id = channel_name[/\/chat-reply\/(\d+)/, 1]
      chat_channel = ChatChannel.find(chat_channel_id)
      config = PresenceChannel::Config.new
      config.allowed_group_ids = chat_channel.allowed_group_ids
      config.allowed_user_ids = chat_channel.allowed_user_ids
      if config.allowed_group_ids.nil? && config.allowed_user_ids.nil?
        config.public = true
      end
      config
    end
  rescue ActiveRecord::RecordNotFound
    nil
  end

  register_presence_channel_prefix("chat-user") do |channel_name|
    if user_id = channel_name[/\/chat-user\/(chat|core)\/(\d+)/, 2]
      user = User.find(user_id)
      config = PresenceChannel::Config.new
      config.allowed_user_ids = [ user.id ]
      config
    end
  rescue ActiveRecord::RecordNotFound
    nil
  end

  CHAT_NOTIFICATION_TYPES = [
    Notification.types[:chat_mention],
    Notification.types[:chat_message],
  ]
  register_push_notification_filter do |user, payload|
    if user.user_option.only_chat_push_notifications && user.user_option.chat_enabled
      CHAT_NOTIFICATION_TYPES.include?(payload[:notification_type])
    else
      true
    end
  end

  on(:reviewable_score_updated) do |reviewable|
    ReviewableChatMessage.on_score_updated(reviewable)
  end

  DiscourseChat::Engine.routes.draw do
    # direct_messages_controller routes
    get '/direct_messages' => 'direct_messages#index'
    post '/direct_messages/create' => 'direct_messages#create'

    # incoming_webhooks_controller routes
    post '/hooks/:key' => 'incoming_chat_webhooks#create_message'

    # incoming_webhooks_controller routes
    post '/hooks/:key/slack' => 'incoming_chat_webhooks#create_message_slack_compatible'

    # chat_channel_controller routes
    get '/chat_channels' => 'chat_channels#index'
    put '/chat_channels' => 'chat_channels#create'
    get '/chat_channels/all' => 'chat_channels#all'
    get '/chat_channels/search' => 'chat_channels#search'
    post '/chat_channels/:chat_channel_id' => 'chat_channels#edit'
    post '/chat_channels/:chat_channel_id/notification_settings' => 'chat_channels#notification_settings'
    post '/chat_channels/:chat_channel_id/follow' => 'chat_channels#follow'
    post '/chat_channels/:chat_channel_id/unfollow' => 'chat_channels#unfollow'
    get '/chat_channels/:chat_channel_id' => 'chat_channels#show'
    put '/chat_channels/:chat_channel_id/archive' => 'chat_channels#archive'
    put '/chat_channels/:chat_channel_id/retry_archive' => 'chat_channels#retry_archive'
    put '/chat_channels/:chat_channel_id/change_status' => 'chat_channels#change_status'
    delete '/chat_channels/:chat_channel_id' => 'chat_channels#destroy'

    # chat_controller routes
    get '/' => 'chat#respond'
    get '/browse' => 'chat#respond'
    get '/channel/:channel_id' => 'chat#respond'
    get '/channel/:channel_id/:channel_title' => 'chat#respond'
    post '/enable' => 'chat#enable_chat'
    post '/disable' => 'chat#disable_chat'
    post '/dismiss-retention-reminder' => 'chat#dismiss_retention_reminder'
    get '/:chat_channel_id/messages' => 'chat#messages'
    get '/message/:message_id' => 'chat#message_link'
    put ':chat_channel_id/edit/:message_id' => 'chat#edit_message'
    put ':chat_channel_id/react/:message_id' => 'chat#react'
    delete '/:chat_channel_id/:message_id' => 'chat#delete'
    put '/:chat_channel_id/:message_id/rebake' => 'chat#rebake'
    post '/:chat_channel_id/:message_id/flag' => 'chat#flag'
    post '/:chat_channel_id/quote' => 'chat#quote_messages'
    put '/:chat_channel_id/move_messages_to_channel' => 'chat#move_messages_to_channel'
    put '/:chat_channel_id/restore/:message_id' => 'chat#restore'
    get '/lookup/:message_id' => 'chat#lookup_message'
    put '/:chat_channel_id/read/:message_id' => 'chat#update_user_last_read'
    put '/user_chat_enabled/:user_id' => 'chat#set_user_chat_status'
    put '/:chat_channel_id/invite' => 'chat#invite_users'
    post '/drafts' => 'chat#set_draft'
    post '/:chat_channel_id' => 'chat#create_message'
    put '/flag' => 'chat#flag'
  end

  Discourse::Application.routes.append do
    mount ::DiscourseChat::Engine, at: '/chat'
    get '/admin/plugins/chat' => 'discourse_chat/admin_incoming_chat_webhooks#index', constraints: StaffConstraint.new
    post '/admin/plugins/chat/hooks' => 'discourse_chat/admin_incoming_chat_webhooks#create', constraints: StaffConstraint.new
    put '/admin/plugins/chat/hooks/:incoming_chat_webhook_id' => 'discourse_chat/admin_incoming_chat_webhooks#update', constraints: StaffConstraint.new
    delete '/admin/plugins/chat/hooks/:incoming_chat_webhook_id' => 'discourse_chat/admin_incoming_chat_webhooks#destroy', constraints: StaffConstraint.new
    get "u/:username/preferences/chat" => "users#preferences", constraints: { username: RouteFormat.username }
  end

  if defined?(DiscourseAutomation)
    add_automation_scriptable('send_chat_message') do
      field :chat_channel_id, component: :text, required: true
      field :message, component: :message, required: true, accepts_placeholders: true
      field :sender, component: :user

      placeholder :channel_name

      script do |context, fields, automation|
        sender = User.find_by(username: fields.dig('sender', 'value')) || Discourse.system_user
        channel = ChatChannel.find_by(id: fields.dig('chat_channel_id', 'value'))

        placeholders = {
          channel_name: channel.public_channel_title
        }.merge(context['placeholders'] || {})

        creator = DiscourseChat::ChatMessageCreator.create(
          chat_channel: channel,
          user: sender,
          content: utils.apply_placeholders(fields.dig('message', 'value'), placeholders)
        )

        if creator.failed?
          Rails.logger.warn "[discourse-automation] Chat message failed to send, error was: #{creator.error}"
        end
      end
    end
  end

  add_api_key_scope(:chat, {
    create_message: {
      actions: %w[discourse_chat/chat#create_message],
      params: %i[chat_channel_id]
    }
  })
end
