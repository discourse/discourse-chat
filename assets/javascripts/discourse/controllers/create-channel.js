import Controller from "@ember/controller";
import ChatChannel from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import discourseComputed from "discourse-common/utils/decorators";
import escape from "discourse-common/lib/escape";
import I18n from "I18n";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { ajax } from "discourse/lib/ajax";
import { action } from "@ember/object";
import { notEmpty } from "@ember/object/computed";
import { inject as service } from "@ember/service";
import { isBlank } from "@ember/utils";


export default Controller.extend(ModalFunctionality, {
  chat: service(),
  category: null,
  categoryId: null,
  name: "",
  description: "",
  categorySelected: notEmpty("category"),
  categoryHintText: null,

  onShow() {
    this.set("categoryHintText", this._defaultHint());
  },

  @discourseComputed("categorySelected", "name")
  createDisabled(categorySelected, name) {
    return !this.categorySelected || isBlank(name);
  },

  @action
  onCategoryChange(categoryId) {
    let category = categoryId
      ? this.site.categories.findBy("id", categoryId)
      : null;
    this._updateCategoryHint(category);
    this.setProperties({
      categoryId,
      category,
      name: category?.name || "",
    });
  },

  @action
  create() {
    if (this.createDisabled) {
      return;
    }

    const data = {
      id: this.categoryId,
      name: this.name,
      description: this.description,
    };

    return ajax("/chat/chat_channels", { method: "PUT", data })
      .then((response) => {
        const chatChannel = ChatChannel.create(response.chat_channel);
        return this.chat.startTrackingChannel(chatChannel).then(() => {
          this.send("closeModal");
          this.chat.openChannel(chatChannel);
        });
      })
      .catch((e) => {
        this.flash(e.jqXHR.responseJSON.errors[0], "error");
      });
  },

  onClose() {
    this.setProperties({
      categoryId: null,
      category: null,
      name: "",
      description: "",
      categoryHintText: this._defaultHint(),
    });
  },

  _buildCategorySlug(category) {
    const parent = category.parentCategory;

    if (parent) {
      return `${this._buildCategorySlug(parent)}/${category.slug}`;
    } else {
      return category.slug;
    }
  },

  _defaultHint() {
    return I18n.t("chat.create_channel.choose_category.default_hint", {
      link: "/categories",
      category: "category",
    });
  },

  _updateCategoryHint(category) {
    if (category) {
      const fullSlug = this._buildCategorySlug(category);

      return ajax(`/chat/api/category-chatables/${category.id}/permissions.json`).then((response) => {
        const groupHints = response.permissions;

        if (groupHints?.length > 0) {
          const translationKey =
            groupHints.length === 1 ? "hint_single" : "hint_multiple";

          this.set(
            "categoryHintText",
            I18n.t(`chat.create_channel.choose_category.${translationKey}`, {
              link: `/c/${escape(fullSlug)}/edit/security`,
              hint_1: groupHints[0],
              hint_2: groupHints[1],
              count: groupHints.length,
            })
          );
        }
      });
    } else {
      this.set("categoryHintText", this._defaultHint());
    }
  },
});
