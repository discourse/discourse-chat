import Component from "@ember/component";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default class ChatChannelCard extends Component {
  tagName = "";

  @service chat;

  @action
  afterMembershipToggle() {
    this.chat.forceRefreshChannels();
  }
}
