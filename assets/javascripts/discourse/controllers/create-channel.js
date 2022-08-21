import bootbox from "bootbox";
import Controller from "@ember/controller";
import ChatApi from "discourse/plugins/discourse-chat/discourse/lib/chat-api";
import ChatChannel from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import escape from "discourse-common/lib/escape";
import I18n from "I18n";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { ajax } from "discourse/lib/ajax";
import { action, computed } from "@ember/object";
import { gt, notEmpty } from "@ember/object/computed";
import { inject as service } from "@ember/service";
import { isBlank } from "@ember/utils";

const DEFAULT_HINT = I18n.t(
  "chat.create_channel.choose_category.default_hint",
  {
    link: "/categories",
    category: "category",
  }
);

export default class CreateChannelController extends Controller.extend(
  ModalFunctionality
) {
  @service chat;

  category = null;
  categoryId = null;
  name = "";
  description = "";
  categoryPermissionsHint = null;
  autoJoinUsers = null;
  autoJoinWarning = "";

  @notEmpty("category") categorySelected;
  @gt("siteSettings.max_chat_auto_joined_users", 0) autoJoinAvailable;

  @computed("categorySelected", "name")
  get createDisabled() {
    return !this.categorySelected || isBlank(this.name);
  }

  onShow() {
    this.set("categoryPermissionsHint", DEFAULT_HINT);
  }

  onClose() {
    this.setProperties({
      categoryId: null,
      category: null,
      name: "",
      description: "",
      categoryPermissionsHint: DEFAULT_HINT,
      autoJoinWarning: "",
    });
  }

  _createChannel() {
    const data = {
      id: this.categoryId,
      name: this.name,
      description: this.description,
      auto_join_users: this.autoJoinUsers,
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
  }

  _buildCategorySlug(category) {
    const parent = category.parentCategory;

    if (parent) {
      return `${this._buildCategorySlug(parent)}/${category.slug}`;
    } else {
      return category.slug;
    }
  }

  _updateAutoJoinConfirmWarning(category, catPermissions) {
    const allowedGroups = catPermissions.allowed_groups;

    if (catPermissions.private) {
      const warningTranslationKey =
        allowedGroups.length < 3 ? "warning_groups" : "warning_multiple_groups";

      this.set(
        "autoJoinWarning",
        I18n.t(`chat.create_channel.auto_join_users.${warningTranslationKey}`, {
          members_count: catPermissions.members_count,
          group_1: allowedGroups[0],
          group_2: allowedGroups[1],
          count: allowedGroups.length,
        })
      );
    } else {
      this.set(
        "autoJoinWarning",
        I18n.t(`chat.create_channel.auto_join_users.public_category_warning`, {
          category: escape(category.name),
        })
      );
    }
  }

  _updatePermissionsHint(category) {
    if (category) {
      const fullSlug = this._buildCategorySlug(category);

      return ChatApi.categoryPermissions(category.id).then((catPermissions) => {
        this._updateAutoJoinConfirmWarning(category, catPermissions);
        const allowedGroups = catPermissions.allowed_groups;

        const translationKey =
          allowedGroups.length < 3 ? "hint_groups" : "hint_multiple_groups";

        this.set(
          "categoryPermissionsHint",
          I18n.t(`chat.create_channel.choose_category.${translationKey}`, {
            link: `/c/${escape(fullSlug)}/edit/security`,
            hint_1: allowedGroups[0],
            hint_2: allowedGroups[1],
            count: allowedGroups.length,
          })
        );
      });
    } else {
      this.set("categoryPermissionsHint", DEFAULT_HINT);
      this.set("autoJoinWarning", "");
    }
  }

  @action
  onCategoryChange(categoryId) {
    let category = categoryId
      ? this.site.categories.findBy("id", categoryId)
      : null;
    this._updatePermissionsHint(category);
    this.setProperties({
      categoryId,
      category,
      name: category?.name || "",
    });
  }

  @action
  create() {
    if (this.createDisabled) {
      return;
    }

    if (this.autoJoinUsers) {
      bootbox.confirm(this.autoJoinWarning, (confirmed) => {
        if (confirmed) {
          this._createChannel();
        }
      });
    } else {
      this._createChannel();
    }
  }
}
