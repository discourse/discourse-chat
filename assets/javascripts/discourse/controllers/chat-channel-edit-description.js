import Controller from "@ember/controller";
import { action } from "@ember/object";
import discourseComputed from "discourse-common/utils/decorators";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import ChatApi from "discourse/plugins/discourse-chat/discourse/lib/chat-api";

export default Controller.extend(ModalFunctionality, {
  @discourseComputed("model.description", "editedDescription")
  isSaveDisabled(description, editedDescription) {
    return description === editedDescription || editedDescription?.length > 280;
  },

  editedDescription: "",

  onShow() {
    this.set("editedDescription", this.model.description || "");
  },

  onClose() {
    this.set("editedDescription", "");
    this.clearFlash();
  },

  @action
  onSaveChatChannelDescription() {
    return ChatApi.modifyChatChannel(this.model.id, {
      description: this.editedDescription,
    })
      .then((chatChannel) => {
        this.model.set("description", chatChannel.description);
        this.send("closeModal");
      })
      .catch((event) => {
        if (event.jqXHR?.responseJSON?.errors) {
          this.flash(event.jqXHR.responseJSON.errors.join("\n"), "error");
        }
      });
  },

  @action
  onChangeChatChannelDescription(description) {
    this.clearFlash();
    this.set("editedDescription", description);
  },
});
