# frozen_string_literal: true

# name: discourse-topic-chat
# about: Topic or category scoped chat for Discourse sites
# version: 0.1
# authors: Kane York
# url: https://github.com/discourse/discourse-topic-chat

enabled_site_setting :topic_chat_enabled


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
  load File.expand_path('../app/serializers/topic_chat_message_serializer.rb', __FILE__)
  load File.expand_path('../app/services/topic_chat_publisher.rb', __FILE__)
  load File.expand_path('../lib/guardian_extensions.rb', __FILE__)

  reloadable_patch do |plugin|
    Guardian.class_eval { include DiscourseTopicChat::GuardianExtensions }
  end

  Topic.class_eval {
    has_one :topic_chat
  }

  require_dependency "application_controller"

  class DiscourseTopicChat::ChatController < ::ApplicationController
    requires_plugin DiscourseTopicChat::PLUGIN_NAME
    before_action :ensure_enabled
    before_action :ensure_logged_in, only: [:send]

    def index
      raise NotImplementedError
    end

    def enable
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
        t.add_small_action(current_user, 'chat_enabled', current_user)
      end

      success ? render_serialized(tc, TopicChatSerializer) : render_json_error(tc)
    end

    def disable
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
        t.add_small_action(current_user, 'chat_disabled', current_user)
      end

      success ? render_success_json : render_json_error(tc)
    end

    def send
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

      TopicChatPublisher.publish_new!(msg)
      render_success_json
    end

    def recent
      t = Topic.find(params[:topic_id])
      raise Discourse::NotFound unless guardian.can_see?(t)
      tc = TopicChat.find_by(topic: t)
      raise Discourse::NotFound unless tc

      messages = TopicChatMessage.where(topic: t).order_by(created_at: :desc).limit(20)
      # TODO: send message bus position
      render_serialized(message, TopicChatMessageSerializer)
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

    private

    def ensure_enabled
      if !SiteSetting.topic_chat_enabled
        raise Discourse::NotFound
      end
    end
  end

  DiscourseTopicChat::Engine.routes.draw do
    get '/index' => 'chat#index'
    get '/t/:topic_id/recent' => 'chat#recent'
    post '/t/:topic_id' => 'chat#send'
    delete '/t/:topic_id/:message_id' => 'chat#delete'
    post '/t/:topic_id/:message_id/flag' => 'chat#flag'
  end

  Discourse::Application.routes.append do
    mount ::DiscourseTopicChat::Engine, at: '/chat'

    post '/t/:topic_id/chat' => 'discoursre_topic_chat/chat#enable'
  end
end
