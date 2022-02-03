import Controller from "@ember/controller";
import discourseComputed from "discourse-common/utils/decorators";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { equal } from "@ember/object/computed";

const chatFlagTypes = ["inappropriate", "spam"];

export default Controller.extend(ModalFunctionality, {
  message: null,
  model: null,

  onShow() {
    this.set("types", this.site.flagTypes.filter(
      (item) => chatFlagTypes.includes(item.name_key)
    ))
    this.set("selectedType", this.types[0]);
  },

  @action
  changeType(type) {
    this.set("selectedType", type);
  },

  @action
  createFlag() {
    ajax("/chat/flag", {
      method: "PUT",
      data: {
        chat_message_id: this.model.id,
        type: this.selectedType.id
      }
    });
  }
})
