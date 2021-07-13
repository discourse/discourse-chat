# frozen_string_literal: true

# name: discourse-topic-chat
# about: Topic or category scoped chat for Discourse sites
# version: 0.1
# authors: Kane York
# url: https://github.com/discourse-org/discourse-topic-chat
# transpile_js: true

enabled_site_setting :topic_chat_enabled

register_asset 'stylesheets/drawer.scss'

register_svg_icon "comments"
register_svg_icon "comment-slash"

after_initialize do
  module ::DiscourseChat
    PLUGIN_NAME = "discourse-topic-chat"
    HAS_CHAT_ENABLED = "has_chat_enabled"

    class Engine < ::Rails::Engine
      engine_name PLUGIN_NAME
      isolate_namespace DiscourseChat
    end
  end

  load File.expand_path('../app/controllers/chat_controller.rb', __FILE__)
  load File.expand_path('../app/jobs/scheduled/split_long_chats.rb', __FILE__)
  load File.expand_path('../app/models/chat_channel.rb', __FILE__)
  load File.expand_path('../app/models/chat_message.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_base_message_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_channel_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_history_message_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/chat_view_serializer.rb', __FILE__)
  load File.expand_path('../lib/chat_view.rb', __FILE__)
  load File.expand_path('../app/services/chat_publisher.rb', __FILE__)
  load File.expand_path('../lib/guardian_extensions.rb', __FILE__)

  register_topic_custom_field_type(DiscourseChat::HAS_CHAT_ENABLED, :boolean)
  register_category_custom_field_type(DiscourseChat::HAS_CHAT_ENABLED, :boolean)
  Site.preloaded_category_custom_fields << DiscourseChat::HAS_CHAT_ENABLED
  TopicList.preloaded_custom_fields << DiscourseChat::HAS_CHAT_ENABLED
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

  reloadable_patch do |plugin|
    require_dependency 'topic_view'
    class ::TopicView
      def chat_record
        return @chat_record if @chat_record_lookup_done
        @chat_record = ChatChannel.with_deleted.find_by(chatable: @topic) if SiteSetting.topic_chat_enabled
        @chat_record_lookup_done = true
        @chat_record
      end

      def chat_history_by_post
        @chat_history_by_post ||= begin
                                    msgs = ChatMessage
                                      .where(chat_channel: @topic.chat_channel)
                                      .where(post_id: posts.pluck(:id))
                                      .where("COALESCE(action_code, 'null') NOT IN ('chat.post_created')")
                                      .order(created_at: :asc)
                                    by_post = {}
                                    msgs.each do |tcm|
                                      by_post[tcm.post_id] ||= []
                                      by_post[tcm.post_id] << tcm
                                    end
                                    by_post
                                  end
      end
    end
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
    scope.can_chat?(object)
  end

  add_to_serializer(:current_user, :include_can_chat?) do
    SiteSetting.topic_chat_enabled
  end

  reloadable_patch do |plugin|
    require_dependency 'topic_view_serializer'
    class ::TopicViewSerializer
      has_one :chat_channel, serializer: ChatChannelSerializer, root: false, embed: :objects

      def chat_channel
        object.topic.chat_channel
      end
    end

    require_dependency 'post_serializer'
    class ::PostSerializer
      attributes :chat_history

      def chat_history
        # TODO: user info not included
        msgs = @topic_view.chat_history_by_post[object.id]
        ActiveModel::ArraySerializer.new(msgs, each_serializer: ChatHistoryMessageSerializer, scope: scope, root: false) if msgs
      end

      def include_chat_history?
        return false if !SiteSetting.topic_chat_enabled || !scope.can_chat?(scope.user)

        @topic_view&.chat_record
      end
    end
  end

  DiscourseEvent.on(:post_created) do |post, opts, user|
    chat_channel = post.topic.chat_channel
    next unless chat_channel && !chat_channel.deleted_at && post.post_type != Post.types[:whisper]
    complex_action = !post.custom_fields["action_code_who"].nil?
    action_code = opts[:action_code] || "chat.post_created"
    action_code = "chat.generic_small_action" if complex_action

    excerpt = post.excerpt(SiteSetting.topic_chat_excerpt_maxlength, strip_links: true, strip_images: true) unless opts[:action_code]

    msg = ChatMessage.new(
      chat_channel: chat_channel,
      post: post,
      user: user,
      action_code: action_code,
      message: excerpt || "",
    )
    msg.save!
    ::ChatPublisher.publish_new!(post.topic, msg)
  end

  DiscourseChat::Engine.routes.draw do
    get '/index' => 'chat#index'
    post '/enable' => 'chat#enable_chat'
    post '/disable' => 'chat#disable_chat'
    get '/:chat_channel_id/recent' => 'chat#recent'
    get '/:chat_channel_id/p/:post_id' => 'chat#historical'
    post '/:chat_channel_id' => 'chat#send_chat'
    delete '/:chat_channel_id/:message_id' => 'chat#delete'
    post '/:chat_channel_id/:message_id/flag' => 'chat#flag'
    put '/:chat_channel_id/restore/:message_id' => 'chat#restore'
  end

  Discourse::Application.routes.append do
    mount ::DiscourseChat::Engine, at: '/chat'
  end
end
