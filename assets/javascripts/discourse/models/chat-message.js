import RestModel from "discourse/models/rest";
import EmberObject from "@ember/object";

const ChatMessage = RestModel.extend({
  test: true,

  get flagsAvailable() {
    if (!this.site) {
      return [];
    }

    return this.site.flagTypes.filter(
      (item) => item.name_key !== "notify_user"
    );
  },

  get actions_summary() {
    return this.flagsAvailable.map((flag) => {
      return {
        id: flag.id,
        act: (chatMessage, opts) => act(flag, chatMessage, opts),
      };
    });
  },
});

const actOnFlag = (flag, chatMessage, opts) => {
  debugger;
  if (!opts) {
    opts = {};
  }

  // Mark it as acted
  this.setProperties({
    acted: true,
    count: this.count + 1,
    can_act: false,
    can_undo: true,
  });

  // Create our post action
  return ajax("/post_actions", {
    type: "POST",
    data: {
      id: this.chatMessage.id,
      post_action_type_id: this.id,
      message: opts.message,
      is_warning: opts.isWarning,
      take_action: opts.takeAction,
      queue_for_review: opts.queue_for_review,
    },
    returnXHR: true,
  })
    .then((data) => {
      const remaining = parseInt(
        data.xhr.getResponseHeader("Discourse-Actions-Remaining") || 0,
        10
      );
      const max = parseInt(
        data.xhr.getResponseHeader("Discourse-Actions-Max") || 0,
        10
      );
      return { acted: true, remaining, max };
    })
    .catch((error) => {
      popupAjaxError(error);
      this.removeAction(post);
    });
};

// ChatMessage.reopenClass({
// munge(json) {
// if (json.actions_summary) {
// const lookup = EmberObject.create();
// }

// return json;
// },
// });
export default ChatMessage;
