import DiscourseRoute from "discourse/routes/discourse";
import EmberObject from "@ember/object";
import { ajax } from "discourse/lib/ajax";

export default DiscourseRoute.extend({
  model() {
    if (!this.currentUser?.admin) {
      return { model: null };
    }

    return ajax("/admin/plugins/chat.json").then((model) => {
      model.incoming_chat_webhooks = model.incoming_chat_webhooks.map(
        (webhook) => EmberObject.create(webhook)
      );
      return model;
    });
  },
});
