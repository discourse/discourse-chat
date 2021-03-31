# frozen_string_literal: true

# name: discourse-topic-chat
# about: Topic or category scoped chat for Discourse sites
# version: 0.1
# authors: Kane York
# url: https://github.com/discourse/discourse-topic-chat

enabled_site_setting :topic_chat_enabled

register_asset 'stylesheets/drawer.scss'

after_initialize do
  module ::DiscourseTopicChat
    PLUGIN_NAME = "discourse-topic-chat"

    class Engine < ::Rails::Engine
      engine_name PLUGIN_NAME
      isolate_namespace DiscourseTopicChat
    end
  end

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

  # MessageBus.register_client_message_filter

  require_dependency "application_controller"

  class DiscourseTopicChat::ChatController < ::ApplicationController
    requires_plugin DiscourseTopicChat::PLUGIN_NAME
    before_action :ensure_logged_in, only: [:send]

    def enable_chat
      t = Topic.find(params[:topic_id])
      guardian.ensure_can_see!(t)
      guardian.ensure_can_enable_chat!(t)

      success = true

      tc = TopicChat.with_deleted.find_by(topic_id: t.id)
      if tc && tc.trashed?
        tc.recover!
      else if tc
        return render_json_error I18n.t("chat.already_enabled")
      end
        tc = TopicChat.new(topic_id: t.id)
      end

      success = tc.save
      if success
        t.add_small_action(current_user, 'chat.enabled', current_user)
      end

      success ? (render json: success_json) : render_json_error(tc)
    end

    def disable_chat
      t = Topic.with_deleted.find(params[:topic_id])
      guardian.ensure_can_see!(t)
      guardian.ensure_can_enable_chat!(t)

      tc = TopicChat.with_deleted.find_by(topic_id: t.id)
      if tc.trashed?
        return render_json_error I18n.t("chat.already_disabled")
      end
      tc.trash!(current_user)

      success = tc.save
      if success
        t.add_small_action(current_user, 'chat.disabled', current_user)
      end

      success ? (render json: success_json) : (render_json_error(tc))
    end

    def send_chat
      t = Topic.find(params[:topic_id])
      raise Discourse::NotFound unless guardian.can_see?(t)
      tc = TopicChat.find_by(topic: t)
      raise Discourse::NotFound unless tc
      guardian.ensure_can_chat!(tc)

      post_id = params[:post_id]
      if post_id
        raise Discourse::NotFound if Post.find(post_id).topic_id != t.id
      end

      reply_to_msg_id = params[:in_reply_to_id]
      if reply_to_msg_id
        rm = TopicChatMessage.find(reply_to_msg_id)
        raise Discourse::NotFound if rm.topic_id != t.id
        post_id = rm.post_id
      end

      # chat can't be viewed on a small-action
      post_id ||= t.posts.where(post_type: Post.types[:regular]).last.id
      content = params[:message]

      msg = TopicChatMessage.new(
        topic_id: t.id,
        post_id: post_id,
        user_id: current_user.id,
        in_reply_to_id: reply_to_msg_id,
        message: content,
      )
      if !msg.save
        return render_json_error(msg)
      end

      TopicChatPublisher.publish_new!(t, msg)
      render json: success_json
    end

    def recent
      topic = Topic.find(params[:topic_id])
      raise Discourse::NotFound unless guardian.can_see?(topic)
      tc = TopicChat.find_by(topic: topic)
      raise Discourse::NotFound unless tc

      # n.b.: must fetch ID before querying DB
      message_bus_last_id = TopicChatPublisher.last_id(topic)
      messages = TopicChatMessage.where(topic: topic).order(created_at: :desc).limit(20)

      render_serialized(TopicChatView.new(topic, messages, message_bus_last_id), TopicChatViewSerializer, root: :topic_chat_view)
    end

    def historical
      t = Topic.with_deleted.find(params[:topic_id])
      raise Discourse::NotFound unless guardian.can_see?(t)
      tc = TopicChat.with_deleted.find_by(topic: t)
      raise Discourse::NotFound unless tc

      raise NotImplementedError
    end

    def delete
      raise NotImplementedError
    end

    def flag
      raise NotImplementedError
    end

    def index
      render json: success_json
    end
  end

  require_dependency 'topic_view'
  class ::TopicView
    def chat_record
      return @chat_record if @chat_record_lookup_done
      begin
        @chat_record = TopicChat.with_deleted.find_by(topic_id: @topic.id)
        @chat_record_lookup_done = true
        @chat_record
      end
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
    attributes :has_chat_live #, :has_chat_history
    attributes :can_chat

    # overrides has_chat_live from ListableTopicSerializer
    def has_chat_live
      chat_lookup && !chat_lookup.trashed?
    end

    #def has_chat_history
    #  !chat_lookup.nil?
    #end

    def can_chat
      scope.can_chat?(self.object)
    end

    def include_can_chat?
      has_chat_live
    end

    private
    def chat_lookup
      @chat_lookup ||= TopicChat.with_deleted.find_by(topic_id: object.topic.id)
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
