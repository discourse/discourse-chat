import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";
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
    let options = [];

    if (
      this.siteSettings.chat_allow_archiving_channels &&
      !this.channel.isArchived &&
      !this.channel.isReadOnly
    ) {
      options.push({
        id: "archiveChannel",
        name: I18n.t("chat.channel_settings.archive_channel"),
        icon: "archive",
      });
    }

    if (this.channel.isOpen) {
      options.push({
        id: "closeChannel",
        name: I18n.t("chat.channel_settings.close_channel"),
        icon: "lock",
      });
    } else if (this.channel.isClosed) {
      options.push({
        id: "openChannel",
        name: I18n.t("chat.channel_settings.open_channel"),
        icon: "unlock",
      });
    }

    return options;
  },

  @action
  handleChannelSettingsAction(id) {
    if (!this.currentUser.staff) {
      return;
    }
    if (!this.channelSettingsOptions.map((a) => a.id).includes(id)) {
      throw new Error(`The action ${id} is not allowed`);
    }
    this[id]();
  },

  archiveChannel() {
    showModal("chat-channel-archive-modal").set("chatChannel", this.channel);
  },

  closeChannel() {
    showModal("chat-channel-toggle-open-modal").set(
      "chatChannel",
      this.channel
    );
  },

  openChannel() {
    showModal("chat-channel-toggle-open-modal").set(
      "chatChannel",
      this.channel
    );
  },
});
