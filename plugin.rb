# frozen_string_literal: true

# name: discourse-topic-chat
# about: Topic or category scoped chat for Discourse sites
# version: 0.1
# authors: Riking
# url: https://github.com/discourse/discourse-topic-chat

enabled_site_setting :topic_chat_enabled

PLUGIN_NAME ||= "discourse-topic-chat"

after_initialize do
  module ::TopicChat
    class Engine < ::Rails::Engine
      engine_name PLUGIN_NAME
      isolate_namespace TopicChat
    end
  end

  require_dependency "application_controller"

  class TopicChat::ChatController < ::ApplicationController
    requires_plugin PLUGIN_NAME
    before_action :ensure_enabled
    before_action :ensure_logged_in, only: [:send]

    def index
    end

    def enable
      t = Topic.find(params[:topic_id])
      guardian.ensure_can_enable_chat!(t)

      new_state = params[:enabled].to_i == 1

    end

    def send
    end

    private

    def ensure_enabled
      if !SiteSetting.topic_chat_enabled
        raise Discourse::NotFound
      end
    end
  end

  TopicChat::Engine.routes.draw do
    get '/index' => 'chat#index'
    get '/t/:topic_id/recent' => 'chat#recent'
    post '/t/:topic_id' => 'chat#send'
  end

  Discourse::Application.routes.append do
    mount ::TopicChat::Engine, at: '/chat'

    post '/t/:topic_id/chat' => 'topic_chat/chat#enable'
  end
end
