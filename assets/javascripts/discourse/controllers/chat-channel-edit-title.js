import Controller from "@ember/controller";
import { action } from "@ember/object";
import discourseComputed from "discourse-common/utils/decorators";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import ChatApi from "discourse/plugins/discourse-chat/discourse/lib/chat-api";

export default Controller.extend(ModalFunctionality, {
  @discourseComputed("model.title", "editedTitle")
  isSaveDisabled(title, editedTitle) {
    return (
      title === editedTitle ||
      editedTitle?.length > this.siteSettings.max_topic_title_length
    );
  },

  editedTitle: "",

  onShow() {
    this.set("editedTitle", this.model.title || "");
  },

  onClose() {
    this.set("editedTitle", "");
    this.clearFlash();
  },

  @action
  onSaveChatChannelTitle() {
    return ChatApi.modifyChatChannel(this.model.id, {
      name: this.editedTitle,
    })
      .then((chatChannel) => {
        this.model.set("title", chatChannel.title);
        this.send("closeModal");
      })
      .catch((event) => {
        if (event.jqXHR?.responseJSON?.errors) {
          this.flash(event.jqXHR.responseJSON.errors.join("\n"), "error");
        }
      });
  },

  @action
  onChangeChatChannelTitle(title) {
    this.clearFlash();
    this.set("editedTitle", title);
  },
});
