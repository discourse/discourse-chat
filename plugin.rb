# frozen_string_literal: true

# name: discourse-topic-chat
# about: Topic or category scoped chat for Discourse sites
# version: 0.1
# authors: Kane York
# url: https://github.com/discourse-org/discourse-topic-chat
# transpile_js: true

enabled_site_setting :topic_chat_enabled

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
    PLUGIN_NAME = "discourse-topic-chat"
    HAS_CHAT_ENABLED = "has_chat_enabled"

    SITE_CHAT_ID = -1
    SITE_CHAT_TYPE = "Site"

    class Engine < ::Rails::Engine
      engine_name PLUGIN_NAME
      isolate_namespace DiscourseChat
    end
  end

  SeedFu.fixture_paths << Rails.root.join("plugins", "discourse-topic-chat", "db", "fixtures").to_s

  load File.expand_path('../app/controllers/admin/admin_incoming_chat_webhooks_controller.rb', __FILE__)
  load File.expand_path('../app/controllers/chat_controller.rb', __FILE__)
  load File.expand_path('../app/controllers/chat_channels_controller.rb', __FILE__)
  load File.expand_path('../app/controllers/direct_messages_controller.rb', __FILE__)
  load File.expand_path('../app/controllers/incoming_chat_webhooks_controller.rb', __FILE__)
  load File.expand_path('../app/models/user_chat_channel_membership.rb', __FILE__)
  load File.expand_path('../app/models/chat_channel.rb', __FILE__)
  load File.expand_path('../app/models/chat_message.rb', __FILE__)
  load File.expand_path('../app/models/chat_message_revision.rb', __FILE__)
  load File.expand_path('../app/models/chat_webhook_event.rb', __FILE__)
  load File.expand_path('../app/models/direct_message_channel.rb', __FILE__)
  load File.expand_path('../app/models/direct_message_user.rb', __FILE__)
  load File.expand_path('../app/models/incoming_chat_webhook.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_webhook_event_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_base_message_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_channel_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_channel_index_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_view_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/direct_message_channel_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/incoming_chat_webhook_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/admin_chat_index_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/user_chat_channel_membership_serializer.rb', __FILE__)
  load File.expand_path('../lib/chat_channel_fetcher.rb', __FILE__)
  load File.expand_path('../lib/chat_message_creator.rb', __FILE__)
  load File.expand_path('../lib/chat_message_updater.rb', __FILE__)
  load File.expand_path('../lib/chat_view.rb', __FILE__)
  load File.expand_path('../lib/guardian_extensions.rb', __FILE__)
  load File.expand_path('../app/services/chat_publisher.rb', __FILE__)

  register_topic_custom_field_type(DiscourseChat::HAS_CHAT_ENABLED, :boolean)
  register_category_custom_field_type(DiscourseChat::HAS_CHAT_ENABLED, :boolean)
  Site.preloaded_category_custom_fields << DiscourseChat::HAS_CHAT_ENABLED
  TopicList.preloaded_custom_fields << DiscourseChat::HAS_CHAT_ENABLED
  CategoryList.preloaded_topic_custom_fields << DiscourseChat::HAS_CHAT_ENABLED
  Search.preloaded_topic_custom_fields << DiscourseChat::HAS_CHAT_ENABLED

  on(:category_updated) do |category|
    next if !SiteSetting.topic_chat_enabled

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
    Topic.class_eval {
      has_one :chat_channel, as: :chatable
    }
    Category.class_eval {
      has_one :chat_channel, as: :chatable
    }
  end

  TopicQuery.add_custom_filter(::DiscourseChat::PLUGIN_NAME) do |results, topic_query|
    if SiteSetting.topic_chat_enabled
      results = results.includes(:chat_channel)
    end
    results
  end

  add_to_serializer('listable_topic', :has_chat_live) do
    true
  end

  add_to_serializer('listable_topic', :include_has_chat_live?) do
    SiteSetting.topic_chat_enabled &&
      scope.can_chat?(scope.user) &&
      object.custom_fields[DiscourseChat::HAS_CHAT_ENABLED]
  end

  add_to_serializer(:current_user, :can_chat) do
    true
  end

  add_to_serializer(:current_user, :include_can_chat?) do
    return @can_chat if defined?(@can_chat)

    @can_chat = SiteSetting.topic_chat_enabled && scope.can_chat?(object)
  end

  add_to_serializer(:current_user, :chat_channel_tracking_state) do
    chat_channel_ids = DiscourseChat::ChatChannelFetcher.unstructured(scope).map(&:id)
    memberships = UserChatChannelMembership
      .includes(chat_channel: :chat_messages)
      .where(user_id: object.id)
      .where(chat_channel_id: chat_channel_ids)
      .map { |timing|
        timing.unread_count = timing.chat_channel.chat_messages.count { |message|
          message.user_id != object.id && message.id > (timing.last_read_message_id || 0)
        }
        timing
      }

    membership_hash = {}
    memberships.each do |membership|
      membership_hash[membership.chat_channel_id] = {
        unread_count: membership.unread_count,
        user_id: membership.id,
        chat_message_id: membership.last_read_message_id,
        chatable_type: membership.chat_channel.chatable_type,
      }
    end
    membership_hash.as_json
  end

  add_to_serializer(:current_user, :include_chat_channel_tracking_state?) do
    include_can_chat?
  end

  reloadable_patch do |plugin|
    require_dependency 'topic_view_serializer'
    class ::TopicViewSerializer
      has_one :chat_channel, serializer: ChatChannelSerializer, root: false, embed: :objects
      attributes :has_chat_live

      def has_chat_live
        true
      end

      def include_has_chat_live?
        chat_channel.present?
      end

      def chat_channel
        return @chat_channel if defined?(@chat_channel)

        @chat_channel = object.topic.chat_channel
      end
    end
  end

  register_presence_channel_prefix("chat") do |channel|
    next nil unless channel == "/chat/online"
    config = PresenceChannel::Config.new
    if SiteSetting.topic_chat_restrict_to_staff
      config.allowed_group_ids = [::Group::AUTO_GROUPS[:staff]]
    else
      config.public = true
    end
    config
  end

  DiscourseChat::Engine.routes.draw do
    get '/' => 'chat#respond'
    get '/channel/:channel_title' => 'chat#respond'
    get '/index' => 'chat#index'
    get '/all_channels' => 'chat#all_channels'
    post '/enable' => 'chat#enable_chat'
    post '/disable' => 'chat#disable_chat'
    get '/:chat_channel_id' => 'chat#channel_details'
    get '/:chat_channel_id/messages' => 'chat#messages'
    post '/:chat_channel_id' => 'chat#create_message'
    put ':chat_channel_id/edit/:message_id' => 'chat#edit_message'
    delete '/:chat_channel_id/:message_id' => 'chat#delete'
    post '/:chat_channel_id/:message_id/flag' => 'chat#flag'
    put '/:chat_channel_id/restore/:message_id' => 'chat#restore'
    get '/lookup/:message_id' => 'chat#lookup_message'
    put '/:chat_channel_id/read/:message_id' => 'chat#update_user_last_read'

    post '/chat_channels/:chat_channel_id/follow' => 'chat_channels#follow'
    post '/chat_channels/:chat_channel_id/unfollow' => 'chat_channels#unfollow'

    post '/direct_messages/create' => 'direct_messages#create'

    post '/hooks/:key' => 'incoming_chat_webhooks#create_message'
  end

  Discourse::Application.routes.append do
    mount ::DiscourseChat::Engine, at: '/chat'
    get '/admin/plugins/chat' => 'discourse_chat/admin_incoming_chat_webhooks#index', constraints: StaffConstraint.new
    post '/admin/plugins/chat/hooks' => 'discourse_chat/admin_incoming_chat_webhooks#create', constraints: StaffConstraint.new
    put '/admin/plugins/chat/hooks/:incoming_chat_webhook_id' => 'discourse_chat/admin_incoming_chat_webhooks#update', constraints: StaffConstraint.new
    delete '/admin/plugins/chat/hooks/:incoming_chat_webhook_id' => 'discourse_chat/admin_incoming_chat_webhooks#destroy', constraints: StaffConstraint.new
  end
end
