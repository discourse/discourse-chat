import { withPluginApi } from "discourse/lib/plugin-api";
import I18n from "I18n";
import { bind } from "discourse-common/utils/decorators";
import { tracked } from "@glimmer/tracking";
import showModal from "discourse/lib/show-modal";
import { getOwner } from "discourse-common/lib/get-owner";
import { DRAFT_CHANNEL_VIEW } from "discourse/plugins/discourse-chat/discourse/services/chat";
import { avatarUrl } from "discourse/lib/utilities";

export default {
  name: "chat-sidebar",
  initialize(container) {
    this.chatService = container.lookup("service:chat");

    withPluginApi("1.3.0", (api) => {
      api.addSidebarSection(
        (BaseCustomSidebarSection, BaseCustomSidebarSectionLink) => {
          const SidebarChatChannelsSectionLink = class extends BaseCustomSidebarSectionLink {
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
          };

          const SidebarChatChannelsSection = class extends BaseCustomSidebarSection {
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

            willDestroy() {
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
          };

          const SidebarChatDirectMessagesSection = class extends BaseCustomSidebarSection {
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

            willDestroy() {
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
