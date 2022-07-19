import Component from "@ember/component";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { isEmpty } from "@ember/utils";
import ChatApi from "discourse/plugins/discourse-chat/discourse/lib/chat-api";
import { action, computed } from "@ember/object";
import { readOnly } from "@ember/object/computed";
import { inject as service } from "@ember/service";

export default class ChatChannelPreviewCard extends Component {
  tagName = "";

  @service chat;

  channel = null;

  @readOnly("channel.isOpen") showJoinButton;

  @action
  onJoinChannel() {
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

  @computed("channel.description")
  get hasDescription() {
    return !isEmpty(this.channel.description);
  }

  @computed("hasDescription")
  get cardClasses() {
    return `chat-channel-preview-card ${
      !this.hasDescription ? "chat-channel-preview-card--no-description" : ""
    }`.trim();
  }
}
