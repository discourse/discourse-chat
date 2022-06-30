import Component from "@ember/component";
import { action, computed } from "@ember/object";
import { inject as service } from "@ember/service";

export default class SidebarChannels extends Component {
  tagName = "";
  toggleSection = null;

  @service chat;
  @service router;

  @computed("chat.{userCanChat,isFullPageChat}")
  get isDisplayed() {
    return this.chat.userCanChat && this.chat.fullScreenChatOpen;
  }

  @action
  switchChannel(channel) {
    this.chat.openChannel(channel);
  }
}
