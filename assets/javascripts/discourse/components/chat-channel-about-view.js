import Component from "@ember/component";
import { action } from "@ember/object";
import ChatApi from "discourse/plugins/discourse-chat/discourse/lib/chat-api";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { inject as service } from "@ember/service";

export default class ChatChannelAboutView extends Component {
  tagName = "";
  channel = null;
  onEditChatChannelTitle = null;
  onEditChatChannelDescription = null;
  isLoading = false;

  @service chat;

  @action
  onJoinChannel() {
    this.set("isLoading", true);

    return ChatApi.followChatChannel(this.channel.id)
      .then((membership) => {
        this.channel.setProperties({
          following: true,
          muted: membership.muted,
          desktop_notification_level: membership.desktop_notification_level,
          mobile_notification_level: membership.mobile_notification_level,
          memberships_count: membership.user_count,
        });

        return this.chat
          .forceRefreshChannels()
          .then(() => this.chat.openChannel(this.channel));
      })
      .catch(popupAjaxError);
  }

  @action
  onLeaveChannel() {
    this.set("isLoading", true);

    return ChatApi.unfollowChatChannel(this.channel.id)
      .then((membership) => {
        this.channel.set("following", false);
        this.channel.set("memberships_count", membership.user_count);

        return this.chat
          .forceRefreshChannels()
          .then(() => this.chat.openChannel(this.channel));
      })
      .catch(popupAjaxError);
  }
}
