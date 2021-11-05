import DiscourseRoute from "discourse/routes/discourse";
import I18n from "I18n";
import { ajax } from "discourse/lib/ajax";
import { defaultHomepage } from "discourse/lib/utilities";
import { inject as service } from "@ember/service";

export default DiscourseRoute.extend({
  chat: service(),
  foundChannel: false,

  titleToken() {
    return I18n.t("chat.title_capitalized");
  },

  beforeModel(params) {
    this.set("foundChannel", false);
    if (
      !this.currentUser?.has_chat_enabled ||
      !this.siteSettings.topic_chat_enabled
    ) {
      return this.transitionTo(`discovery.${defaultHomepage()}`);
    }
    if (params.to.name === "chat.channel") {
      // The target is a specific chat channel, so return and let
      // the chat-channel route handle it.
      this.set("foundChannel", true);
      return;
    }

    return this.chat.getIdealFirstChannelTitle().then((channelTitle) => {
      if (channelTitle) {
        this.set("foundChannel", true);
        return this.transitionTo("chat.channel", channelTitle);
      }
    });
  },

  model() {
    if (!this.foundChannel) {
      return ajax("/chat/chat_channels/all.json");
    }
  },

  setupController(controller, model) {
    if (!this.foundChannel) {
      controller.setProperties({
        blankPage: true,
        hasAvailableChannel: model?.length
      });
    }
  }
});
