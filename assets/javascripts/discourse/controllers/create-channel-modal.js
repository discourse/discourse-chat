import Controller from "@ember/controller";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { ajax } from "discourse/lib/ajax";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default Controller.extend(ModalFunctionality, {
  chat: service(),

  type: "category",
  topic: null,
  category: null,
  categoryId: null,
  name: "",
  description: "",

  @discourseComputed("type", "topic", "category")
  entitySelected(type, topic, category) {
    return (type === "topic" && topic) || (type === "category" && category);
  },

  @discourseComputed
  types() {
    return ["category", "topic"].map((id) => {
      return { id, name: I18n.t(`chat.create_channel.types.${id}`) };
    });
  },

  @discourseComputed("type", "topic", "category", "name")
  createDisabled(type, topic, category, name) {
    return !this.entitySelected || !name?.length > 0;
  },

  @action
  onCategoryChange(categoryId) {
    let category = categoryId
      ? this.site.categories.findBy("id", categoryId)
      : null;
    this.setProperties({
      categoryId,
      category,
      name: category?.name || "",
    });
  },

  @action
  onTopicChange(topic) {
    this.setProperties({
      topic,
      name: topic.fancy_title,
    });
  },

  @action
  onTopicCleared() {
    this.setProperties({
      topic: null,
      name: "",
    });
  },

  @action
  create() {
    if (this.createDisabled) {
      return;
    }

    const data = {
      type: this.type,
      id: this.type === "topic" ? this.topic.id : this.categoryId,
      name: this.name,
      description: this.description,
    };
    ajax("/chat/chat_channels", { method: "PUT", data })
      .then((response) => {
        this.chat.startTrackingChannel(response.chat_channel).then(() => {
          this.send("closeModal");
          this.appEvents.trigger("chat:open-channel", response.chat_channel);
        });
      })
      .catch((e) => {
        this.flash(e.jqXHR.responseJSON.errors[0], "error");
      });
  },

  onClose() {
    this.setProperties({
      type: "category",
      categoryId: null,
      category: null,
      topic: null,
      name: "",
      description: "",
    });
  },
});
