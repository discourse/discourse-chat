import { withPluginApi } from "discourse/lib/plugin-api";
import I18n from "I18n";
import { bind } from "discourse-common/utils/decorators";
import { getOwner } from "discourse-common/lib/get-owner";
import { MENTION_KEYWORDS } from "discourse/plugins/discourse-chat/discourse/components/chat-message";
import { clearChatComposerButtons } from "discourse/plugins/discourse-chat/discourse/lib/chat-composer-buttons";
import { tracked } from "@glimmer/tracking";
import showModal from "discourse/lib/show-modal";

let _lastForcedRefreshAt;
const MIN_REFRESH_DURATION_MS = 180000; // 3 minutes

export default {
  name: "chat-setup",
  initialize(container) {
    this.chatService = container.lookup("service:chat");
    this.siteSettings = container.lookup("site-settings:main");
    this.appEvents = container.lookup("service:appEvents");
    this.appEvents.on("discourse:focus-changed", this, "_handleFocusChanged");

    withPluginApi("0.12.1", (api) => {
      api.registerChatComposerButton({
        id: "chat-upload-btn",
        icon: "far-image",
        label: "chat.upload",
        position: "dropdown",
        action: "uploadClicked",
        dependentKeys: ["canAttachUploads"],
        displayed() {
          return this.canAttachUploads;
        },
      });

      if (this.siteSettings.discourse_local_dates_enabled) {
        api.registerChatComposerButton({
          label: "discourse_local_dates.title",
          id: "local-dates",
          class: "chat-local-dates-btn",
          icon: "calendar-alt",
          position: "dropdown",
          action() {
            this.insertDiscourseLocalDate();
          },
        });
      }

      // we want to decorate the chat quote dates regardless
      // of whether the current user has chat enabled
      api.decorateCookedElement(
        (elem) => {
          const currentUser = getOwner(this).lookup("current-user:main");
          const currentUserTimezone =
            currentUser?.resolvedTimezone(currentUser);
          const chatTranscriptElements = elem.querySelectorAll(
            ".discourse-chat-transcript"
          );

          chatTranscriptElements.forEach((el) => {
            const dateTimeRaw = el.dataset["datetime"];
            const dateTimeEl = el.querySelector(
              ".chat-transcript-datetime a, .chat-transcript-datetime span"
            );

            if (currentUserTimezone) {
              dateTimeEl.innerText = moment
                .tz(dateTimeRaw, currentUserTimezone)
                .format(I18n.t("dates.long_no_year"));
            } else {
              dateTimeEl.innerText = moment(dateTimeRaw).format(
                I18n.t("dates.long_no_year")
              );
            }
          });
        },
        { id: "chat-transcript-datetime" }
      );

      if (!this.chatService.userCanChat) {
        return;
      }

      document.body.classList.add("chat-enabled");

      this.chatService.getChannels();

      const chatNotificationManager = container.lookup(
        "service:chat-notification-manager"
      );
      chatNotificationManager.start();

      if (!this._registeredDocumentTitleCountCallback) {
        api.addDocumentTitleCounter(this.documentTitleCountCallback);
        this._registeredDocumentTitleCountCallback = true;
      }

      api.addCardClickListenerSelector(".topic-chat-float-container");

      api.dispatchWidgetAppEvent(
        "site-header",
        "header-chat-link",
        "chat:rerender-header"
      );

      api.dispatchWidgetAppEvent(
        "sidebar-header",
        "header-chat-link",
        "chat:rerender-header"
      );

      api.addToHeaderIcons("header-chat-link");

      api.decorateChatMessage(function (chatMessage) {
        if (!this.currentUser) {
          return;
        }

        const highlightable = [
          `@${this.currentUser.username}`,
          ...MENTION_KEYWORDS.map((k) => `@${k}`),
        ];

        chatMessage.querySelectorAll(".mention").forEach((node) => {
          const mention = node.textContent.trim();
          if (highlightable.includes(mention)) {
            node.classList.add("highlighted", "valid-mention");
          }
        });
      });
    });

    withPluginApi("1.3.0", (api) => {
      api.addSidebarSection(
        (BaseCustomSidebarSection, BaseCustomSidebarSectionLink) => {
          const SidebarChatSectionLink = class extends BaseCustomSidebarSectionLink {
            constructor({ channel }) {
              super(...arguments);
              this.channel = channel;
            }

            get name() {
              return this.channel.chatable_id;
            }

            get route() {
              return "chat.channel";
            }

            get model() {
              return {
                chatChannel: this.channel,
                channelId: this.channel.id,
                channelTitle: this.channel.chatable.slug,
              };
            }

            get title() {
              return this.channel.title;
            }

            get text() {
              return this.channel.title;
            }

            get prefixIcon() {
              return "hashtag";
            }

            get prefixIconColor() {
              return this.channel.chatable.color;
            }

            get prefixIconBadge() {
              return this.channel.chatable.read_restricted && "lock";
            }

            get suffixIcon() {
              return this.channel.unread_count > 0 && "circle";
            }

            get suffixCssClass() {
              return this.channel.unread_mentions > 0 ? "urgent" : "unread";
            }
          };

          const SidebarChatSection = class extends BaseCustomSidebarSection {
            @tracked sectionLinks = [];

            constructor({ sidebar }) {
              super(...arguments);

              this.sidebar = sidebar;
              this.chatService = container.lookup("service:chat");
              this.currentUser = container.lookup("current-user:main");
              this.appEvents = container.lookup("service:appEvents");
              this.appEvents.on("chat:refresh-channels", this._refreshChannels);
              this.appEvents.on(
                "chat:navigated-to-full-page",
                this._refreshChannels
              );
            }

            willDestroy() {
              this._super(...arguments);
              this.appEvents.off(
                "chat:refresh-channels",
                this._refreshChannels
              );
              this.appEvents.off(
                "chat:navigated-to-full-page",
                this._refreshChannels
              );
            }

            @bind
            _refreshChannels() {
              const newSectionLinks = [];
              this.chatService.getChannels().then((channels) => {
                channels.publicChannels.forEach((channel) => {
                  const trackingState =
                    this.currentUser.chat_channel_tracking_state[channel.id];
                  if (channel === this.chatService.activeChannel) {
                    channel.unread_count = 0;
                    channel.unread_mentions = 0;
                  } else {
                    channel.unread_count = trackingState.unread_count;
                    channel.unread_mentions = trackingState.unread_mentions;
                  }
                  newSectionLinks.push(new SidebarChatSectionLink({ channel }));
                });
              });
              this.sectionLinks = newSectionLinks;
            }

            get name() {
              return I18n.t("chat.chat_channels");
            }

            get title() {
              return I18n.t("chat.chat_channels");
            }

            get text() {
              return I18n.t("chat.chat_channels");
            }

            get actions() {
              const actions = [
                {
                  id: "browseChannels",
                  title: I18n.t("chat.channels_list_popup.browse"),
                  action: () => {
                    this.chatService.router.transitionTo("chat.browse");
                  },
                },
              ];
              if (this.currentUser.staff) {
                actions.push({
                  id: "openCreateChannelModal",
                  title: I18n.t("chat.channels_list_popup.create"),
                  action: () => {
                    showModal("create-channel");
                  },
                });
              }
              return actions;
            }

            get actionsIcon() {
              return "cog";
            }

            get links() {
              return this.sectionLinks;
            }
          };

          return SidebarChatSection;
        }
      );
    });
  },

  @bind
  documentTitleCountCallback() {
    return this.chatService.getDocumentTitleCount();
  },

  teardown() {
    this.appEvents.off("discourse:focus-changed", this, "_handleFocusChanged");
    _lastForcedRefreshAt = null;
    clearChatComposerButtons();
  },

  @bind
  _handleFocusChanged(hasFocus) {
    if (!hasFocus) {
      _lastForcedRefreshAt = Date.now();
      return;
    }

    _lastForcedRefreshAt = _lastForcedRefreshAt || Date.now();

    const duration = Date.now() - _lastForcedRefreshAt;
    if (duration <= MIN_REFRESH_DURATION_MS) {
      return;
    }

    _lastForcedRefreshAt = Date.now();
    this.chatService.refreshTrackingState();
  },
};
