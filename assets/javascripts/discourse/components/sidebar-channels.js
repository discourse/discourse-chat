import Component from "@ember/component";
import { action, computed } from "@ember/object";
import { inject as service } from "@ember/service";

export default class SidebarChannels extends Component {
  tagName = "";
  toggleSection = null;

  @service chat;
  @service router;

  @computed(
    "currentUser.chat_isolated",
    "chat.{userCanChat,isChatPage,isBrowsePage}"
  )
  get isDisplayed() {
    return (
      this.chat.userCanChat &&
      (!this.currentUser.chat_isolated ||
        this.chat.isChatPage ||
        this.chat.isBrowsePage)
    );
  }

  @action
  switchChannel(channel) {
    if (
      this.site.mobileView ||
      this.router.currentRouteName.startsWith("chat.")
    ) {
      this.router.transitionTo("chat.channel", channel.id, channel.title);
    } else {
      this.appEvents.trigger("chat:open-channel", channel);
    }
    return false;
  }
}
