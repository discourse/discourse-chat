import Controller from "@ember/controller";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import { action } from "@ember/object";
import { alias, equal } from "@ember/object/computed";
import { ajax } from "discourse/lib/ajax";
import { isEmpty } from "@ember/utils";

const NEW_TOPIC_SELECTION = "newTopic";
const EXISTING_TOPIC_SELECTION = "existingTopic";
const NEW_MESSAGE_SELECTION = "newMessage";

export default Controller.extend(ModalFunctionality, {
  newTopicSelection: NEW_TOPIC_SELECTION,
  existingTopicSelection: EXISTING_TOPIC_SELECTION,
  newMessageSelection: NEW_MESSAGE_SELECTION,

  selection: "newTopic",
  newTopic: equal("selection", NEW_TOPIC_SELECTION),
  existingTopic: equal("selection", EXISTING_TOPIC_SELECTION),
  newMessage: equal("selection", NEW_MESSAGE_SELECTION),
  canAddTags: alias("site.can_create_tag"),
  canTagMessages: alias("site.can_tag_pms"),

  saving: false,
  topicName: null,
  categoryId: null,
  tags: null,
  selectedTopicId: null,

  onShow() {
    this.set("selection", NEW_TOPIC_SELECTION);
  },

  @discourseComputed("saving", "selectedTopicId", "topicName", "selection")
  buttonDisabled(saving, selectedTopicId, topicName) {
    if (saving) {
      return true;
    }
    if ((this.newTopic || this.newMessage) && isEmpty(topicName)) {
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

  @action
  perform() {
    let promise = "x";
    return;
    promise;
    // .then((result) => {
    // this.send("closeModal");
    // this.topicController.send("toggleMultiSelect");
    // DiscourseURL.routeTo(result.url);
    // })
    // .catch((xhr) => {
    // this.flash(extractError(xhr, I18n.t("topic.move_to.error")));
    // })
    // .finally(() => {
    // this.set("saving", false);
    // });

    return false;
  },
});
