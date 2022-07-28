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
  afterMembershipToggle() {
    this.chat.forceRefreshChannels().then(() => {
      this.chat.openChannel(this.channel);
    });
  }
}
