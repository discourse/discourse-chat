import Controller from "@ember/controller";
import discourseComputed from "discourse-common/utils/decorators";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { ajax } from "discourse/lib/ajax";
import { action } from "@ember/object";

export default Controller.extend(ModalFunctionality, {
  type: "category",
  categoryId: null,
  tags: null,
  suffixEnabled: false,
  suffix: "",

  @discourseComputed("tags")
  tag(tags) {
    return tags?.[0];
  },

  @discourseComputed("categoryId")
  category(categoryId) {
    return this.site.categories.findBy("id", categoryId);
  },

  @discourseComputed("type", "tag", "category", "suffix", "suffixEnabled")
  name(type, tag, category, suffix, suffixEnabled) {
    let name = type === "category" ? category.slug : tag;
    if (suffixEnabled && suffix.length) {
      name += ` - ${suffix}`
    }
    return name;
  },

  @discourseComputed
  types() {
    return [
      "category",
      "tag",
    ].map((id) => {
      return { id, name: I18n.t(`chat.create_channel.types.${id}`) };
    });
  },

  @discourseComputed("type")
  namePlaceholder(type) {
    return ""
  },

  @action
  toggleSuffix() {
    this.set("suffixEnabled", !this.suffixEnabled);
    return false;
  },

  @action
  create() {
<<<<<<< HEAD
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
=======

  }
})
>>>>>>> WIP!
