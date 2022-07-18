import Component from "@ember/component";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import ChatApi from "discourse/plugins/discourse-chat/discourse/lib/chat-api";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default class ChatChannelCard extends Component {
  tagName = "";

  @service chat;

  @action
  onJoinChannel() {
    return ChatApi.followChatChannel(this.channel.id)
      .then((membership) => {
        this.channel.set("following", true);
        this.channel.set("memberships_count", membership.user_count);
        this.chat.openChannel(this.channel);

        return this.chat.forceRefreshChannels();
      })
      .catch(popupAjaxError);
  }
}
