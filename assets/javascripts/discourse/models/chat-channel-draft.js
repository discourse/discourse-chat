import EmberObject from "@ember/object";
import { isPresent } from "@ember/utils";

export default class ChatChannelDraft extends EmberObject {
  value = "";
  uploads = [];
  replyToMsg = null;

  get isValid() {
    return (
      isPresent(this.value) ||
      isPresent(this.uploads) ||
      isPresent(this.replyToMsg)
    );
  }
}
