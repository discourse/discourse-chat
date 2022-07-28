import Component from "@ember/component";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";
import ChatApi from "discourse/plugins/discourse-chat/discourse/lib/chat-api";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default class ChatChannelCard extends Component {
  tagName = "";

  @service chat;

  @action
  afterMembershipToggle() {
    this.chat.forceRefreshChannels()
  }
}
