# frozen_string_literal: true

class DiscourseChat::ChatBaseController < ::ApplicationController
  before_action :ensure_logged_in
  before_action :ensure_can_chat

  skip_before_action :check_xhr, only: [:service_worker_asset]
  skip_before_action :verify_authenticity_token, only: [:service_worker_asset]
  skip_before_action :preload_json, only: [:service_worker_asset]
  skip_before_action :handle_theme, only: [:service_worker_asset]
  before_action :apply_cdn_headers, only: [:service_worker_asset]

  def manifest
    expires_in 1.minutes
    render json: chat_manifest.to_json, content_type: 'application/manifest+json'
  end

  def service_worker_asset
    is_asset_path

    respond_to do |format|
      format.js do
        # https://github.com/w3c/ServiceWorker/blob/master/explainer.md#updating-a-service-worker
        # Maximum cache that the service worker will respect is 24 hours.
        # However, ensure that these may be cached and served for longer on servers.
        # immutable_for 1.year

        if Rails.application.assets_manifest.assets['chat-service-worker.js']
          path = File.expand_path(Rails.root + "public/assets/#{Rails.application.assets_manifest.assets['chat-service-worker.js']}")
          response.headers["Last-Modified"] = File.ctime(path).httpdate
        end
        puts '#####################'
        puts Rails.application.assets_manifest.find_sources('chat-service-worker.js').first.inspect
        puts '#####################'
        render(
          plain: Rails.application.assets_manifest.find_sources('chat-service-worker.js').first,
          content_type: 'application/javascript'
        )
      end
    end
  end

  private

  def ensure_can_chat
    raise Discourse::NotFound unless SiteSetting.topic_chat_enabled
    guardian.ensure_can_chat!(current_user)
  end

  def set_channel_and_chatable
    @chat_channel = ChatChannel.find_by(id: params[:chat_channel_id])
    raise Discourse::NotFound unless @chat_channel

    @chatable = nil
    if @chat_channel.site_channel?
      guardian.ensure_can_access_site_chat!
    else
      @chatable = @chat_channel.chatable
      guardian.ensure_can_see!(@chatable)
    end
  end

  def chat_manifest
    display = "standalone"
    if request.user_agent
      regex = Regexp.new(SiteSetting.pwa_display_browser_regex)
      if regex.match(request.user_agent)
        display = "browser"
      end
    end

    scheme_id = view_context.scheme_id
    primary_color = ColorScheme.hex_for_name('primary', scheme_id)
    icon_url_base = UrlHelper.absolute("/svg-sprite/#{Discourse.current_hostname}/icon/#{primary_color}")
    title =

    manifest = {
      name: "#{I18n.t('chat.title')} - #{SiteSetting.title}",
      short_name: "#{I18n.t('chat.title')} - #{SiteSetting.short_title.presence || SiteSetting.title.truncate(12, separator: ' ', omission: '')}",
      description: SiteSetting.site_description,
      display: display,
      start_url: Discourse.base_path.present? ? "#{Discourse.base_path}/chat" : '/chat',
      background_color: "##{ColorScheme.hex_for_name('secondary', scheme_id)}",
      theme_color: "##{ColorScheme.hex_for_name('header_background', scheme_id)}",
      icons: []
    }

    logo = SiteSetting.site_manifest_icon_url
    if logo
      icon_entry = {
        src: UrlHelper.absolute(logo),
        sizes: "512x512",
        type: MiniMime.lookup_by_filename(logo)&.content_type || "image/png"
      }
      manifest[:icons] << icon_entry.dup
      icon_entry[:purpose] = "maskable"
      manifest[:icons] << icon_entry
    end

    SiteSetting.manifest_screenshots.split('|').each do |image|
      next unless Discourse.store.has_been_uploaded?(image)

      upload = Upload.find_by(sha1: Upload.extract_sha1(image))
      next if upload.nil?

      manifest[:screenshots] = [] if manifest.dig(:screenshots).nil?

      manifest[:screenshots] << {
        src: UrlHelper.absolute(image),
        sizes: "#{upload.width}x#{upload.height}",
        type: "image/#{upload.extension}"
      }
    end

    if current_user && current_user.trust_level >= 1 && SiteSetting.native_app_install_banner_android
      manifest = manifest.merge(
        prefer_related_applications: true,
        related_applications: [
          {
            platform: "play",
            id: SiteSetting.android_app_id
          }
        ]
      )
    end

    manifest
  end
end
