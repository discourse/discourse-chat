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

  @discourseComputed("channel.status")
  channelSettingsOptions() {
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

    options.push({
      id: "deleteChannel",
      name: I18n.t("chat.channel_settings.delete_channel"),
      icon: "trash-alt",
    });

    if (this.channel.isOpen) {
      options.push({
        id: "showToggleOpenModal",
        name: I18n.t("chat.channel_settings.close_channel"),
        icon: "lock",
      });
    } else if (this.channel.isClosed) {
      options.push({
        id: "showToggleOpenModal",
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

  deleteChannel() {
    showModal("chat-channel-delete-modal").set("chatChannel", this.channel);
  },

  archiveChannel() {
    showModal("chat-channel-archive-modal").set("chatChannel", this.channel);
  },

  showToggleOpenModal() {
    showModal("chat-channel-toggle-open-modal").set(
      "chatChannel",
      this.channel
    );
  },
});
