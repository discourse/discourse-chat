import Controller from "@ember/controller";
import discourseComputed from "discourse-common/utils/decorators";
import DiscourseURL from "discourse/lib/url";
import I18n from "I18n";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { action } from "@ember/object";
import { equal } from "@ember/object/computed";
import { ajax } from "discourse/lib/ajax";
import { extractError } from "discourse/lib/ajax-error";
import { isEmpty } from "@ember/utils";

const NEW_TOPIC_SELECTION = "newTopic";
const EXISTING_TOPIC_SELECTION = "existingTopic";
const NEW_MESSAGE_SELECTION = "newMessage";

export default Controller.extend(ModalFunctionality, {
  selection: "newTopic",
  newTopic: equal("selection", NEW_TOPIC_SELECTION),
  existingTopic: equal("selection", EXISTING_TOPIC_SELECTION),
  newMessage: equal("selection", NEW_MESSAGE_SELECTION),

  saving: false,
  topicTitle: null,
  categoryId: null,
  tags: null,
  selectedTopicId: null,

  onShow() {
    this.set("selection", NEW_TOPIC_SELECTION);
  },

  @discourseComputed()
  instructionLabels() {
    const labels = {};
    labels[NEW_TOPIC_SELECTION] = I18n.t(
      "chat.selection.new_topic.instructions",
      {
        count: this.chatMessageIds.length,
      }
    );
    labels[EXISTING_TOPIC_SELECTION] = I18n.t(
      "chat.selection.existing_topic.instructions",
      {
        count: this.chatMessageIds.length,
      }
    );
    labels[NEW_MESSAGE_SELECTION] = I18n.t(
      "chat.selection.new_message.instructions",
      {
        count: this.chatMessageIds.length,
      }
    );
    return labels;
  },

  @discourseComputed("saving", "selectedTopicId", "topicTitle", "selection")
  buttonDisabled(saving, selectedTopicId, topicTitle) {
    if (saving) {
      return true;
    }
    if (
      (this.newTopic || this.newMessage) &&
      (!topicTitle ||
        topicTitle.length < this.siteSettings.min_topic_title_length ||
        topicTitle.length > this.siteSettings.max_topic_title_length)
    ) {
      return true;
    }

    if (this.existingTopic && isEmpty(selectedTopicId)) {
      return true;
    }
    return false;
  },

  @discourseComputed("saving", "newTopic", "existingTopic", "newMessage")
  buttonTitle(saving, newTopic, existingTopic, newMessage) {
    if (saving) {
      return I18n.t("saving");
    } else if (newTopic) {
      return I18n.t("chat.selection.new_topic.title");
    } else if (existingTopic) {
      return I18n.t("chat.selection.existing_topic.title");
    } else if (newMessage) {
      return I18n.t("chat.selection.new_message.title");
    }
  },

  @action
  cancel() {
    this.appEvents.trigger("chat:cancel-message-selection");
    this.send("closeModal");
  },

  _data() {
    const data = {
      type: this.selection,
      chat_message_ids: this.chatMessageIds,
      chat_channel_id: this.chatChannel.id,
    };
    if (this.newTopic || this.newMessage) {
      data.title = this.topicTitle;
    }
    if (this.newTopic) {
      data.category_id = this.categoryId;
      data.tags = this.tags;
    }
    if (this.existingTopic) {
      data.topic_id = this.selectedTopicId;
    }
    return data;
  },

  @action
  perform() {
    this.set("saving", true);
    return ajax("/chat/move_to_topic", { method: "POST", data: this._data() })
      .then((response) => {
        this.send("closeModal");
        DiscourseURL.routeTo(response.url);
      })
      .catch((xhr) => {
        this.flash(extractError(xhr, I18n.t("chat.selection.error")));
      })
      .finally(() => {
        this.set("saving", false);
      });
  },
});
