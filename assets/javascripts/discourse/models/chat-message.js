import RestModel from "discourse/models/rest";
import EmberObject from "@ember/object";

const ChatMessage = RestModel.extend({
  test: true,

  flagsAvailable() {
    return ["test"];
  },
});

ChatMessage.reopenClass({
  munge(json) {
    console.log(json);
    if (json.actions_summary) {
      const lookup = EmberObject.create();
    }

    return json;
  },
});
export default ChatMessage;
