# frozen_string_literal: true

# name: discourse-topic-chat
# about: Topic or category scoped chat for Discourse sites
# version: 0.1
# authors: Kane York
# url: https://github.com/discourse/discourse-topic-chat

enabled_site_setting :topic_chat_enabled

register_asset 'stylesheets/drawer.scss'

register_svg_icon "comments"
register_svg_icon "comment-slash"

after_initialize do
  module ::DiscourseTopicChat
    PLUGIN_NAME = "discourse-topic-chat"

    class Engine < ::Rails::Engine
      engine_name PLUGIN_NAME
      isolate_namespace DiscourseTopicChat
    end
  end

  load File.expand_path('../app/controllers/chat_controller.rb', __FILE__)
  load File.expand_path('../app/jobs/scheduled/split_long_chats.rb', __FILE__)
  load File.expand_path('../app/models/topic_chat.rb', __FILE__)
  load File.expand_path('../app/models/topic_chat_message.rb', __FILE__)
  load File.expand_path('../app/serializers/topic_chat_base_message_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/topic_chat_live_message_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/topic_chat_history_message_serializer.rb', __FILE__)
  load File.expand_path('../app/serializers/topic_chat_view_serializer.rb', __FILE__)
  load File.expand_path('../lib/topic_chat_view.rb', __FILE__)
  load File.expand_path('../app/services/topic_chat_publisher.rb', __FILE__)
  load File.expand_path('../lib/guardian_extensions.rb', __FILE__)

  reloadable_patch do |plugin|
    Guardian.class_eval { include DiscourseTopicChat::GuardianExtensions }
    Topic.class_eval {
      has_one :topic_chat
    }
  end

  require_dependency 'topic_view'
  class ::TopicView
    def chat_record
      return @chat_record if @chat_record_lookup_done
      @chat_record = TopicChat.with_deleted.find_by(topic_id: @topic.id) if SiteSetting.topic_chat_enabled
      @chat_record_lookup_done = true
      @chat_record
    end

    def chat_history_by_post
      @chat_history_by_post ||= begin
                                  msgs = TopicChatMessage
                                    .where(topic_id: @topic.id)
                                    .where(post_id: posts.pluck(:id))
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

  TopicQuery.add_custom_filter(::DiscourseTopicChat::PLUGIN_NAME) do |results, topic_query|
    if SiteSetting.topic_chat_enabled
      results = results.includes(:topic_chat)
    end
    results
  end

  add_to_serializer('listable_topic', :has_chat_live) do
    # TODO N+1 query
    !object.topic_chat.nil?
  end

  add_to_serializer('topic_view', :has_chat_live) do
    raise "bad version of function"
  end

  require_dependency 'topic_view_serializer'
  class ::TopicViewSerializer
    attributes :has_chat_live, :has_chat_history
    attributes :can_chat

    # overrides has_chat_live from ListableTopicSerializer
    def has_chat_live
      chat_lookup && !chat_lookup.trashed?
    end

    def has_chat_history
      !chat_lookup.nil?
    end

    def can_chat
      scope.can_chat?(self.object)
    end

    def include_has_chat_live?
      SiteSetting.topic_chat_enabled
    end

    def include_has_chat_history?
      SiteSetting.topic_chat_enabled
    end

    def include_can_chat?
      return false unless SiteSetting.topic_chat_enabled
      has_chat_live
    end

    private
    def chat_lookup
      object.chat_record
    end
  end

  require_dependency 'post_serializer'
  class ::PostSerializer
    attributes :chat_history

    def chat_history
      # TODO: user info not included
      msgs = @topic_view.chat_history_by_post[object.id]
      ActiveModel::ArraySerializer.new(msgs, each_serializer: TopicChatHistoryMessageSerializer, scope: scope, root: false) if msgs
    end

    def include_chat_history?
      @topic_view&.chat_record
    end
  end

  DiscourseTopicChat::Engine.routes.draw do
    get '/index' => 'chat#index'
    get '/t/:topic_id/recent' => 'chat#recent'
    get '/t/:topic_id/p/:post_id' => 'chat#historical'
    post '/t/:topic_id' => 'chat#send_chat'
    post '/t/:topic_id/enable' => 'chat#enable_chat'
    post '/t/:topic_id/disable' => 'chat#disable_chat'
    delete '/t/:topic_id/:message_id' => 'chat#delete'
    post '/t/:topic_id/:message_id/flag' => 'chat#flag'
  end

  Discourse::Application.routes.append do
    mount ::DiscourseTopicChat::Engine, at: '/chat'
  end
end
