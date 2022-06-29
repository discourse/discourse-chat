import Component from "@ember/component";
import { action, computed } from "@ember/object";
import { inject as service } from "@ember/service";

export default class SidebarChannels extends Component {
  tagName = "";
  toggleSection = null;

  @service chat;
  @service router;

  @computed("currentUser.chat_isolated", "chat.{userCanChat,isFullPageChat}")
  get isDisplayed() {
    return (
      this.chat.userCanChat &&
      (!this.currentUser.chat_isolated || this.chat.fullScreenChatOpen)
    );
  }

  @action
  switchChannel(channel) {
    this.chat.openChannel(channel);
  }
}
