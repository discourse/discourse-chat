import Component from "@ember/component";
import { isEmpty } from "@ember/utils";
import ChatApi from "discourse/plugins/discourse-chat/discourse/lib/chat-api";
import { action, computed } from "@ember/object";
import { inject as service } from "@ember/service";

export default class ChatChannelPreviewCard extends Component {
  tagName = "";

  @service chat;

  chatChanel = null;
  details = null;

  @action
  onJoinChannel() {
    this.set("isJoiningChannel", true);
    this.set("isLoading", true);

    return ChatApi.followChatChannel(this.chatChannel.id)
      .then((membership) => {
        this.chatChannel.set("following", true);
        this.chatChannel.set("memberships_count", membership.user_count);

        return this.chat
          .forceRefreshChannels()
          .then(() => this.chat.openChannel(this.chatChannel));
      })
      .catch(popupAjaxError);
  }

  get hasDescription() {
    return !isEmpty(this.chatChannel.description);
  }
}
