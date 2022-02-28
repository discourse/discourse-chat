import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { alias, equal } from "@ember/object/computed";

const NEW_TOPIC_SELECTION = "newTopic";
const EXISTING_TOPIC_SELECTION = "existingTopic";
const NEW_MESSAGE_SELECTION = "newMessage";

export default Component.extend({
  newTopicSelection: NEW_TOPIC_SELECTION,
  existingTopicSelection: EXISTING_TOPIC_SELECTION,
  newMessageSelection: NEW_MESSAGE_SELECTION,

  selection: null,
  newTopic: equal("selection", NEW_TOPIC_SELECTION),
  existingTopic: equal("selection", EXISTING_TOPIC_SELECTION),
  newMessage: equal("selection", NEW_MESSAGE_SELECTION),
  canAddTags: alias("site.can_create_tag"),
  canTagMessages: alias("site.can_tag_pms"),

  topicTitle: null,
  categoryId: null,
  tags: null,
  selectedTopicId: null,

  // TODO (martin) (maybe just use channel not id)
  chatMessageIds: null,
  chatChannelId: null,

  @discourseComputed()
  newTopicInstruction() {
    return this.instructionLabels[NEW_TOPIC_SELECTION];
  },

  @discourseComputed()
  existingTopicInstruction() {
    return this.instructionLabels[EXISTING_TOPIC_SELECTION];
  },

  @discourseComputed()
  newMessageInstruction() {
    return this.instructionLabels[NEW_MESSAGE_SELECTION];
  },
});
