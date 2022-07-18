import { withPluginApi } from "discourse/lib/plugin-api";
import I18n from "I18n";
import { bind } from "discourse-common/utils/decorators";
import { getOwner } from "discourse-common/lib/get-owner";
import { MENTION_KEYWORDS } from "discourse/plugins/discourse-chat/discourse/components/chat-message";
import { clearChatComposerButtons } from "discourse/plugins/discourse-chat/discourse/lib/chat-composer-buttons";
import { tracked } from "@glimmer/tracking";
import showModal from "discourse/lib/show-modal";
import { DRAFT_CHANNEL_VIEW } from "discourse/plugins/discourse-chat/discourse/services/chat";
import { avatarUrl } from "discourse/lib/utilities";

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
            constructor({ channel, chatService }) {
              super(...arguments);
              this.channel = channel;
              this.chatService = chatService;
            }

            get name() {
              return `${this.channel.chatable_type.toLowerCase()}-${
                this.channel.chatable_id
              }`;
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

            get prefixType() {
              return "icon";
            }

            get prefixValue() {
              return "hashtag";
            }

            get prefixColor() {
              return this.channel.chatable.color;
            }

            get prefixBadge() {
              return this.channel.chatable.read_restricted ? "lock" : "";
            }

            get suffixType() {
              return "icon";
            }

            get suffixValue() {
              return this.channel.unread_count > 0 ? "circle" : "";
            }

            get suffixCSSClass() {
              return this.channel.unread_mentions > 0 ? "urgent" : "unread";
            }

            get currentWhen() {
              return (
                this.chatService.router.currentRouteName?.startsWith(
                  "chat.channel"
                ) && this.channel.id === this.chatService.activeChannel?.id
              );
            }
          };

          const SidebarChatSection = class extends BaseCustomSidebarSection {
            @tracked sectionLinks = [];

            constructor() {
              super(...arguments);

              this.chatService = container.lookup("service:chat");
              this.chatService.appEvents.on(
                "chat:refresh-channels",
                this._refreshChannels
              );
              this.chatService.appEvents.on(
                "chat:navigated-to-full-page",
                this._refreshChannels
              );
              this._refreshChannels();
            }

            teardown() {
              this.chatService.appEvents.off(
                "chat:refresh-channels",
                this._refreshChannels
              );
              this.chatService.appEvents.off(
                "chat:navigated-to-full-page",
                this._refreshChannels
              );
            }

            @bind
            _refreshChannels() {
              const newSectionLinks = [];
              this.chatService.getChannels().then((channels) => {
                channels.publicChannels.forEach((channel) => {
                  newSectionLinks.push(
                    new SidebarChatSectionLink({
                      channel,
                      chatService: this.chatService,
                    })
                  );
                });
                this.sectionLinks = newSectionLinks;
              });
            }

            get name() {
              return "chat-channels";
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
              if (this.sidebar.currentUser.staff) {
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

      api.addSidebarSection(
        (BaseCustomSidebarSection, BaseCustomSidebarSectionLink) => {
          const SidebarChatSectionLink = class extends BaseCustomSidebarSectionLink {
            constructor({ channel, chatService }) {
              super(...arguments);
              this.channel = channel;
              this.chatService = chatService;
            }

            get name() {
              return `${this.channel.chatable_type.toLowerCase()}-${
                this.channel.chatable_id
              }`;
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

            get prefixType() {
              if (this.channel.chatable.users.length === 1) {
                return "image";
              } else {
                return "text";
              }
            }

            get prefixValue() {
              if (this.channel.chatable.users.length === 1) {
                return avatarUrl(
                  this.channel.chatable.users[0].avatar_template,
                  "tiny"
                );
              } else {
                return this.channel.chatable.users.length;
              }
            }

            get prefixCSSClass() {
              const activeUsers = this.chatService.presenceChannel.users;
              const user = this.channel.chatable.users[0];
              if (
                !!activeUsers?.findBy("id", user?.id) ||
                !!activeUsers?.findBy("username", user?.username)
              ) {
                return "active";
              }
              return "";
            }

            get suffixType() {
              return "icon";
            }

            get suffixValue() {
              return this.channel.unread_count > 0 && "circle";
            }

            get suffixCSSClass() {
              return "urgent";
            }

            get hoverType() {
              return "icon";
            }

            get hoverValue() {
              return "times";
            }

            get hoverAction() {
              return () => {
                this.chatService.unfollowChannel(this.channel);
              };
            }

            get hoverTitle() {
              return I18n.t("chat.direct_messages.leave");
            }

            get currentWhen() {
              return (
                this.chatService.router.currentRouteName?.startsWith(
                  "chat.channel"
                ) && this.channel.id === this.chatService.activeChannel?.id
              );
            }
          };

          const SidebarChatSection = class extends BaseCustomSidebarSection {
            @tracked sectionLinks = [];

            constructor() {
              super(...arguments);

              this.chatService = container.lookup("service:chat");
              this.sidebar.appEvents.on(
                "chat:refresh-channels",
                this._refreshPms
              );
              this.sidebar.appEvents.on(
                "chat:navigated-to-full-page",
                this._refreshPms
              );
              this._refreshPms();
            }

            willDestory() {
              this.sidebar.appEvents.off(
                "chat:refresh-channels",
                this._refreshPms
              );
              this.sidebar.appEvents.off(
                "chat:navigated-to-full-page",
                this._refreshPms
              );
            }

            @bind
            _refreshPms() {
              const newSectionLinks = [];
              this.chatService.getChannels().then((channels) => {
                channels.directMessageChannels.forEach((channel) => {
                  newSectionLinks.push(
                    new SidebarChatSectionLink({
                      channel,
                      chatService: this.chatService,
                    })
                  );
                });
                this.sectionLinks = newSectionLinks;
              });
            }

            get name() {
              return "chat-dms";
            }

            get title() {
              return I18n.t("chat.direct_messages.title");
            }

            get text() {
              return I18n.t("chat.direct_messages.title");
            }

            get actions() {
              const site = getOwner(this).lookup("site:main");
              return [
                {
                  id: "startDm",
                  title: I18n.t("chat.direct_messages.new"),
                  action: () => {
                    if (
                      site.mobileView ||
                      this.chatService.router.currentRouteName.startsWith("")
                    ) {
                      this.chatService.router.transitionTo(
                        "chat.draft-channel"
                      );
                    } else {
                      this.appEvents.trigger(
                        "chat:open-view",
                        DRAFT_CHANNEL_VIEW
                      );
                    }
                  },
                },
              ];
            }

            get actionsIcon() {
              return "plus";
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
