import { htmlSafe } from "@ember/template";
import slugifyChannel from "discourse/plugins/discourse-chat/discourse/lib/slugify-channel";
import { withPluginApi } from "discourse/lib/plugin-api";
import I18n from "I18n";
import { bind } from "discourse-common/utils/decorators";
import { tracked } from "@glimmer/tracking";
import showModal from "discourse/lib/show-modal";
import { getOwner } from "discourse-common/lib/get-owner";
import { DRAFT_CHANNEL_VIEW } from "discourse/plugins/discourse-chat/discourse/services/chat";
import { avatarUrl } from "discourse/lib/utilities";
import { dasherize } from "@ember/string";
import { emojiUnescape } from "discourse/lib/text";
import { decorateUsername } from "discourse/helpers/decorate-username-selector";

export default {
  name: "chat-sidebar",
  initialize(container) {
    this.chatService = container.lookup("service:chat");

    if (!this.chatService.userCanChat) {
      return;
    }

    withPluginApi("1.3.0", (api) => {
      api.addSidebarSection(
        (BaseCustomSidebarSection, BaseCustomSidebarSectionLink) => {
          const SidebarChatChannelsSectionLink = class extends BaseCustomSidebarSectionLink {
            @tracked chatChannelTrackingState =
              this.chatService.currentUser.chat_channel_tracking_state[
                this.channel.id
              ];

            constructor({ channel, chatService }) {
              super(...arguments);
              this.channel = channel;
              this.chatService = chatService;

              this.chatService.appEvents.on(
                "chat:user-tracking-state-changed",
                this._refreshTrackingState
              );
            }

            @bind
            willDestroy() {
              this.chatService.appEvents.off(
                "chat:user-tracking-state-changed",
                this._refreshTrackingState
              );
            }

            @bind
            _refreshTrackingState() {
              this.chatChannelTrackingState =
                this.chatService.currentUser.chat_channel_tracking_state[
                  this.channel.id
                ];
            }

            get name() {
              return dasherize(slugifyChannel(this.channel.title));
            }

            get route() {
              return "chat.channel";
            }

            get models() {
              return [this.channel.id, slugifyChannel(this.channel.title)];
            }

            get title() {
              return this.channel.title;
            }

            get text() {
              return htmlSafe(emojiUnescape(this.channel.title));
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
              return this.chatChannelTrackingState?.unread_count > 0
                ? "circle"
                : "";
            }

            get suffixCSSClass() {
              return this.chatChannelTrackingState?.unread_mentions > 0
                ? "urgent"
                : "unread";
            }
          };

          const SidebarChatChannelsSection = class extends BaseCustomSidebarSection {
            @tracked sectionLinks = [];

            @tracked sectionIndicator =
              this.chatService.publicChannels &&
              this.chatService.publicChannels[0].current_user_membership
                .unread_count;

            constructor() {
              super(...arguments);

              if (container.isDestroyed) {
                return;
              }
              this.chatService = container.lookup("service:chat");
              this.chatService.appEvents.on(
                "chat:refresh-channels",
                this._refreshChannels
              );
              this._refreshChannels();
            }

            @bind
            willDestroy() {
              if (!this.chatService) {
                return;
              }
              this.chatService.appEvents.off(
                "chat:refresh-channels",
                this._refreshChannels
              );
            }

            @bind
            _refreshChannels() {
              const newSectionLinks = [];
              this.chatService.getChannels().then((channels) => {
                channels.publicChannels.forEach((channel) => {
                  newSectionLinks.push(
                    new SidebarChatChannelsSectionLink({
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

          return SidebarChatChannelsSection;
        }
      );

      api.addSidebarSection(
        (BaseCustomSidebarSection, BaseCustomSidebarSectionLink) => {
          const SidebarChatDirectMessagesSectionLink = class extends BaseCustomSidebarSectionLink {
            @tracked chatChannelTrackingState =
              this.chatService.currentUser.chat_channel_tracking_state[
                this.channel.id
              ];

            constructor({ channel, chatService }) {
              super(...arguments);
              this.channel = channel;
              this.chatService = chatService;
            }

            get name() {
              return dasherize(this.channel.title);
            }

            get route() {
              return "chat.channel";
            }

            get models() {
              return [this.channel.id, slugifyChannel(this.channel.title)];
            }

            get title() {
              return this.channel.title;
            }

            get oneOnOneMessage() {
              return this.channel.chatable.users.length === 1;
            }

            get text() {
              const username = this.channel.title.replaceAll("@", "");
              if (this.oneOnOneMessage) {
                return htmlSafe(`${username} ${decorateUsername(username)}`);
              } else {
                return username;
              }
            }

            get prefixType() {
              if (this.oneOnOneMessage) {
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
              return this.chatChannelTrackingState?.unread_count > 0
                ? "circle"
                : "";
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
          };

          const SidebarChatDirectMessagesSection = class extends BaseCustomSidebarSection {
            @tracked sectionLinks = [];

            constructor() {
              super(...arguments);

              if (container.isDestroyed) {
                return;
              }
              this.chatService = container.lookup("service:chat");
              this.chatService.appEvents.on(
                "chat:user-tracking-state-changed",
                this._refreshPms
              );
              this._refreshPms();
            }

            @bind
            willDestroy() {
              if (container.isDestroyed) {
                return;
              }
              this.chatService.appEvents.off(
                "chat:user-tracking-state-changed",
                this._refreshPms
              );
            }

            @bind
            _refreshPms() {
              const newSectionLinks = [];
              this.chatService.getChannels().then((channels) => {
                this.chatService
                  .truncateDirectMessageChannels(channels.directMessageChannels)
                  .forEach((channel) => {
                    newSectionLinks.push(
                      new SidebarChatDirectMessagesSectionLink({
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

          return SidebarChatDirectMessagesSection;
        }
      );
    });
  },
};
