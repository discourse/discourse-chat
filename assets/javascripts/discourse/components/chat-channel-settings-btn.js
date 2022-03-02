import discourseComputed from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import showModal from "discourse/lib/show-modal";
import Component from "@ember/component";
import { inject as service } from "@ember/service";

export default Component.extend({
  tagName: "",
  channel: null,
  chat: service(),

  @discourseComputed()
  channelSettingsOptions() {
    // TODO (martin): Add closeChannel and deleteChannel options at a later date
    //
    // TODO (martin) Add logic to change these options based on current channel status
    let options = [];

    if (this.siteSettings.chat_allow_archiving_channels) {
      options.push({
        id: "archiveChannel",
        name: I18n.t("chat.channel_settings.archive_channel"),
        icon: "archive",
      });
    }

    return options;
  },

  @action
  handleChannelSettingsAction(id) {
    if (!this.currentUser.staff) {
      return;
    }
    this[id]();
  },

  archiveChannel() {
    showModal("chat-channel-archive-modal").set("chatChannel", this.channel);
  },
});
