# frozen_string_literal: true

# name: discourse-chat
# about: Chat inside Discourse
# version: 0.3
# authors: Kane York, Mark VanLandingham
# url: https://github.com/discourse/discourse-chat
# transpile_js: true

enabled_site_setting :chat_enabled

register_asset 'stylesheets/common/common.scss'
register_asset 'stylesheets/common/incoming-chat-webhooks.scss'
register_asset 'stylesheets/mobile/mobile.scss', :mobile
register_asset 'stylesheets/desktop/desktop.scss', :desktop

register_svg_icon "comments"
register_svg_icon "comment-slash"
register_svg_icon "hashtag"
register_svg_icon "lock"

# route: /admin/plugins/chat
add_admin_route 'chat.admin.title', 'chat'

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
  load File.expand_path('../app/controllers/move_to_topic_controller.rb', __FILE__)
  load File.expand_path('../app/models/user_chat_channel_membership.rb', __FILE__)
  load File.expand_path('../app/models/chat_channel.rb', __FILE__)
  load File.expand_path('../app/models/chat_message.rb', __FILE__)
  load File.expand_path('../app/models/chat_message_reaction.rb', __FILE__)
  load File.expand_path('../app/models/chat_message_revision.rb', __FILE__)
  load File.expand_path('../app/models/chat_mention.rb', __FILE__)
  load File.expand_path('../app/models/chat_upload.rb', __FILE__)
  load File.expand_path('../app/models/chat_webhook_event.rb', __FILE__)
  load File.expand_path('../app/models/direct_message_channel.rb', __FILE__)
  load File.expand_path('../app/models/direct_message_user.rb', __FILE__)
  load File.expand_path('../app/models/incoming_chat_webhook.rb', __FILE__)
  load File.expand_path('../app/models/chat_message_post_connection.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_webhook_event_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_base_message_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_channel_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_channel_settings_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_channel_index_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/direct_message_channel_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/incoming_chat_webhook_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/admin_chat_index_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/user_chat_channel_membership_serializer.rb', __FILE__)
  load File.expand_path('../lib/chat_channel_fetcher.rb', __FILE__)
  load File.expand_path('../lib/chat_message_creator.rb', __FILE__)
  load File.expand_path('../lib/chat_message_processor.rb', __FILE__)
  load File.expand_path('../lib/chat_message_updater.rb', __FILE__)
  load File.expand_path('../lib/chat_notifier.rb', __FILE__)
  load File.expand_path('../lib/chat_seeder.rb', __FILE__)
  load File.expand_path('../lib/direct_message_channel_creator.rb', __FILE__)
  load File.expand_path('../lib/guardian_extensions.rb', __FILE__)
  load File.expand_path('../lib/extensions/topic_view_serializer_extension.rb', __FILE__)
  load File.expand_path('../lib/extensions/detailed_tag_serializer_extension.rb', __FILE__)
  load File.expand_path('../lib/slack_compatibility.rb', __FILE__)
  load File.expand_path('../app/jobs/regular/process_chat_message.rb', __FILE__)
  load File.expand_path('../app/jobs/regular/create_chat_mention_notifications.rb', __FILE__)
  load File.expand_path('../app/jobs/regular/notify_users_watching_chat.rb', __FILE__)
  load File.expand_path('../app/services/chat_publisher.rb', __FILE__)

  register_topic_custom_field_type(DiscourseChat::HAS_CHAT_ENABLED, :boolean)
  register_category_custom_field_type(DiscourseChat::HAS_CHAT_ENABLED, :boolean)
  Site.preloaded_category_custom_fields << DiscourseChat::HAS_CHAT_ENABLED
  TopicList.preloaded_custom_fields << DiscourseChat::HAS_CHAT_ENABLED
  CategoryList.preloaded_topic_custom_fields << DiscourseChat::HAS_CHAT_ENABLED
  Search.preloaded_topic_custom_fields << DiscourseChat::HAS_CHAT_ENABLED
  UserUpdater::OPTION_ATTR.push(:chat_enabled)
  UserUpdater::OPTION_ATTR.push(:chat_isolated)
  UserUpdater::OPTION_ATTR.push(:only_chat_push_notifications)
  UserUpdater::OPTION_ATTR.push(:chat_sound)

  on(:category_updated) do |category|
    next if !SiteSetting.chat_enabled

    chat_channel = ChatChannel.with_deleted.find_by(chatable: category)

    if category.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]
      if chat_channel && chat_channel.trashed?
        chat_channel.recover!
      elsif chat_channel.nil?
        chat_channel = ChatChannel.new(chatable: category)
        chat_channel.save!
      end

    else
      if chat_channel && !chat_channel.trashed?
        chat_channel.trash!
      end
    end
  end

  reloadable_patch do |plugin|
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
    Post.class_eval {
      has_many :chat_message_post_connections, dependent: :destroy
      has_many :chat_messages, through: :chat_message_post_connections
    }
  end

  TopicQuery.add_custom_filter(::DiscourseChat::PLUGIN_NAME) do |results, topic_query|
    if SiteSetting.chat_enabled
      results = results.includes(:chat_channel)
    end
    results
  end

  add_to_serializer(:site, :chat_pretty_text_features) do
    ChatMessage::COOK_FEATURES.as_json
  end

  add_to_serializer(:site, :include_chat_pretty_text_features?) do
    SiteSetting.chat_enabled && scope.can_chat?(scope.user)
  end

  add_to_serializer(:listable_topic, :has_chat_live) do
    true
  end

  add_to_serializer(:listable_topic, :include_has_chat_live?) do
    SiteSetting.chat_enabled &&
      scope.can_chat?(scope.user) &&
      object.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]
  end

  add_to_serializer(:post, :chat_connection) do
    if object.chat_message_post_connections.any?
      {
        chat_channel_id: object.chat_message_post_connections.first.chat_message.chat_channel_id,
        chat_message_ids: object.chat_message_post_connections.map(&:chat_message_id)
      }
    end
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

  DiscourseChat::Engine.routes.draw do
    # direct_messages_controller routes
    post '/direct_messages/create' => 'direct_messages#create'

    # incoming_webhooks_controller routes
    post '/hooks/:key' => 'incoming_chat_webhooks#create_message'

    # incoming_webhooks_controller routes
    post '/hooks/:key/slack' => 'incoming_chat_webhooks#create_message_slack_compatable'

    # move_to_topic_controller routes
    resources :move_to_topic

    # chat_channel_controller routes
    get '/chat_channels' => 'chat_channels#index'
    get '/chat_channels/all' => 'chat_channels#all'
    post '/chat_channels/:chat_channel_id/notification_settings' => 'chat_channels#notification_settings'
    post '/chat_channels/:chat_channel_id/follow' => 'chat_channels#follow'
    post '/chat_channels/:chat_channel_id/unfollow' => 'chat_channels#unfollow'
    get '/chat_channels/for_tag/:tag_name' => 'chat_channels#for_tag'
    get '/chat_channels/for_category/:category_id' => 'chat_channels#for_category'
    get '/chat_channels/:chat_channel_id' => 'chat_channels#show'

    # chat_controller routes
    get '/' => 'chat#respond'
    get '/channel/:channel_id' => 'chat#respond'
    get '/channel/:channel_id/:channel_title' => 'chat#respond'
    post '/enable' => 'chat#enable_chat'
    post '/disable' => 'chat#disable_chat'
    get '/:chat_channel_id/messages' => 'chat#messages'
    put ':chat_channel_id/edit/:message_id' => 'chat#edit_message'
    put ':chat_channel_id/react/:message_id' => 'chat#react'
    delete '/:chat_channel_id/:message_id' => 'chat#delete'
    post '/:chat_channel_id/:message_id/flag' => 'chat#flag'
    put '/:chat_channel_id/restore/:message_id' => 'chat#restore'
    get '/lookup/:message_id' => 'chat#lookup_message'
    put '/:chat_channel_id/read/:message_id' => 'chat#update_user_last_read'
    put '/user_chat_enabled/:user_id' => 'chat#set_user_chat_status'
    put '/:chat_channel_id/invite' => 'chat#invite_users'
    post '/:chat_channel_id' => 'chat#create_message'
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

        DiscourseChat::ChatMessageCreator.create(
          chat_channel: channel,
          user: sender,
          content: utils.apply_placeholders(fields.dig('message', 'value'), placeholders)
        )
      end
    end
  end
end
