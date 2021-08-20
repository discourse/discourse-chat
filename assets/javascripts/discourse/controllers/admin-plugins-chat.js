import Controller from "@ember/controller";
import EmberObject, { action } from "@ember/object";
import { and } from "@ember/object/computed";
import { ajax } from "discourse/lib/ajax";

export default Controller.extend({
  queryParams: { selectedWebhookId: "id" },

  loading: false,
  creatingNew: false,
  newWebhookName: "",
  newWebhookChannelId: null,
  nameAndChannelValid: and("newWebhookName", "newWebhookChannelId"),
  selectedWebhook: null,

  @action
  startCreatingWebhook() {
    this.set("creatingNew", true);
  },

  @action
  createNewWebhook() {
    if (this.loading) {
      return;
    }
    this.set("loading", true)
    const data = {
      name: this.newWebhookName,
      chat_channel_id: this.newWebhookChannelId
    };
    ajax("/admin/plugins/chat/hooks", { data, type: "POST" }).then((webhook) => {
      const newWebhook = EmberObject.create(webhook);
      this.set("model.incoming_chat_webhooks", [newWebhook].concat(this.model.incoming_chat_webhooks))
      this.setProperties({
        loading: false,
        selectedWebhookId: newWebhook.id,
        selectedWebhook: newWebhook,
      })
    });
  },

  @action
  cancelNewWebhook() {
    this.setProperties({
      creatingNew: false,
      newWebhookName: "",
      newWebhookChannelId: null
    });
  },

  @action
  editWebhook(webhook) {
    console.log(webhook)
  },

  @action
  destroyWebhook(webhook) {
    console.log(webhook)
  }
})
