import { htmlSafe } from "@ember/template";
import slugifyChannel from "discourse/plugins/discourse-chat/discourse/lib/slugify-channel";
import { withPluginApi } from "discourse/lib/plugin-api";
import I18n from "I18n";
import { bind } from "discourse-common/utils/decorators";
import { tracked } from "@glimmer/tracking";
import showModal from "discourse/lib/show-modal";
import { DRAFT_CHANNEL_VIEW } from "discourse/plugins/discourse-chat/discourse/services/chat";
import { avatarUrl, escapeExpression } from "discourse/lib/utilities";
import { dasherize } from "@ember/string";
import { emojiUnescape } from "discourse/lib/text";
import { decorateUsername } from "discourse/helpers/decorate-username-selector";
import { until } from "discourse/lib/formatter";
import { inject as service } from "@ember/service";

export default {
  name: "chat-sidebar",
  initialize(container) {
    this.chatService = container.lookup("service:chat");

    if (!this.chatService.userCanChat) {
      return;
    }

    withPluginApi("1.3.0", (api) => {
      const currentUser = api.getCurrentUser();

      // TODO (martin) When sidebar has a displaySection option, we should
      // move this logic there so the section can show up if the user does
      // get new public or DM channels where they didn't before.
      const hasPublicChannels =
        currentUser?.chat_channels?.public_channels?.length;
      const shouldDisplayPublicChannelsSection = hasPublicChannels
        ? true
        : currentUser?.staff || currentUser?.has_joinable_public_channels;

      const hasDirectMessageChannels =
        currentUser?.chat_channels?.direct_message_channels?.length;
      const shouldDisplayDirectMessageChannelsSection = hasDirectMessageChannels
        ? true
        : this.chatService.userCanDirectMessage;

      shouldDisplayPublicChannelsSection &&
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
                return dasherize(slugifyChannel(this.title));
              }

              get route() {
                return "chat.channel";
              }

              get models() {
                return [this.channel.id, slugifyChannel(this.title)];
              }

              get title() {
                return escapeExpression(this.channel.title);
              }

              get text() {
                return htmlSafe(emojiUnescape(this.title));
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

      shouldDisplayDirectMessageChannelsSection &&
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

                if (this.oneOnOneMessage) {
                  this.channel.chatable.users[0].trackStatus();
                }
              }

              @bind
              willDestroy() {
                if (this.oneOnOneMessage) {
                  this.channel.chatable.users[0].stopTrackingStatus();
                }
              }

              get name() {
                return dasherize(this.title);
              }

              get route() {
                return "chat.channel";
              }

              get models() {
                return [this.channel.id, slugifyChannel(this.title)];
              }

              get title() {
                return escapeExpression(this.channel.title);
              }

              get oneOnOneMessage() {
                return this.channel.chatable.users.length === 1;
              }

              get text() {
                const username = this.title.replaceAll("@", "");
                if (this.oneOnOneMessage) {
                  const status = this.channel.chatable.users[0].get("status");
                  const statusHtml = status ? this._userStatusHtml(status) : "";
                  return htmlSafe(
                    `${escapeExpression(
                      username
                    )}${statusHtml} ${decorateUsername(
                      escapeExpression(username)
                    )}`
                  );
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

              _userStatusHtml(status) {
                const emoji = escapeExpression(`:${status.emoji}:`);
                const title = this._userStatusTitle(status);
                return `<span class="user-status">${emojiUnescape(emoji, {
                  title,
                })}</span>`;
              }

              _userStatusTitle(status) {
                let title = `${escapeExpression(status.description)}`;

                if (status.ends_at) {
                  const untilFormatted = until(
                    status.ends_at,
                    this.chatService.currentUser.timezone,
                    this.chatService.currentUser.locale
                  );
                  title += ` ${untilFormatted}`;
                }

                return title;
              }
            };

            const SidebarChatDirectMessagesSection = class extends BaseCustomSidebarSection {
              @service site;
              @tracked sectionLinks = [];

              constructor() {
                super(...arguments);

                if (container.isDestroyed) {
                  return;
                }
                this.chatService = container.lookup("service:chat");
                this.chatService.appEvents.on(
                  "chat:user-tracking-state-changed",
                  this._refreshDirectMessageChannels
                );
                this._refreshDirectMessageChannels();
              }

              @bind
              willDestroy() {
                if (container.isDestroyed) {
                  return;
                }
                this.chatService.appEvents.off(
                  "chat:user-tracking-state-changed",
                  this._refreshDirectMessageChannels
                );
              }

              @bind
              _refreshDirectMessageChannels() {
                const newSectionLinks = [];
                this.chatService.getChannels().then((channels) => {
                  this.chatService
                    .truncateDirectMessageChannels(
                      channels.directMessageChannels
                    )
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
                if (!this.chatService.userCanDirectMessage) {
                  return [];
                }

                return [
                  {
                    id: "startDm",
                    title: I18n.t("chat.direct_messages.new"),
                    action: () => {
                      if (
                        this.site.mobileView ||
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
