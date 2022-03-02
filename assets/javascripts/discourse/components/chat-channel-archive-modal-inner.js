import Component from "@ember/component";
import { later } from "@ember/runloop";
import { isEmpty } from "@ember/utils";
import discourseComputed from "discourse-common/utils/decorators";
import { action } from "@ember/object";
import ChatChannel from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import { equal } from "@ember/object/computed";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";
import { popupAjaxError } from "discourse/lib/ajax-error";

// TODO (martin) move into shared class
const NEW_TOPIC_SELECTION = "newTopic";
const EXISTING_TOPIC_SELECTION = "existingTopic";

export default Component.extend({
  chat: service(),
  tagName: "",
  chatChannel: null,

  selection: "newTopic",
  newTopic: equal("selection", NEW_TOPIC_SELECTION),
  existingTopic: equal("selection", EXISTING_TOPIC_SELECTION),

  saving: false,

  // TODO (martin) REMOVE THIS, REVERT TO NULL, TEST ONLY
  topicTitle: "this is a test topic for archiving",
  categoryId: null,
  tags: null,
  selectedTopicId: null,

  @action
  archiveChannel() {
    this.set("saving", true);
    return ajax({
      url: `/chat/chat_channels/${this.chatChannel.id}/archive.json`,
      type: "PUT",
      data: this._data(),
    })
      .then((response) => {
        this.appEvents.trigger("modal-body:flash", {
          text: I18n.t("chat.channel_archive.process_started"),
          messageClass: "success",
        });
        later(() => window.location.reload(), 3000);
      })
      .catch((error) => popupAjaxError(error))
      .finally(() => this.set("saving", false));
  },

  _data() {
    const data = {
      type: this.selection,
      chat_channel_id: this.chatChannel.id,
    };
    if (this.newTopic) {
      data.title = this.topicTitle;
      data.category_id = this.categoryId;
      data.tags = this.tags;
    }
    if (this.existingTopic) {
      data.topic_id = this.selectedTopicId;
    }
    return data;
  },

  @discourseComputed("saving", "selectedTopicId", "topicTitle", "selection")
  buttonDisabled(saving, selectedTopicId, topicTitle) {
    if (saving) {
      return true;
    }
    if (
      this.newTopic &&
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

  @discourseComputed()
  instructionLabels() {
    const labels = {};
    labels[NEW_TOPIC_SELECTION] = I18n.t(
      "chat.selection.new_topic.instructions_channel_archive"
    );
    labels[EXISTING_TOPIC_SELECTION] = I18n.t(
      "chat.selection.existing_topic.instructions_channel_archive"
    );
    return labels;
  },
});
