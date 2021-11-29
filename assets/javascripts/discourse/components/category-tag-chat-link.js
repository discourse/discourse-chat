import Component from "@ember/component";
import { ajax } from "discourse/lib/ajax";
import { action } from "@ember/object";
import { schedule } from "@ember/runloop";

export default Component.extend({
  category: null,
  tag: null,
  show: false,

  init() {
    this._super(...arguments);

    if (!this.currentUser?.has_chat_enabled) {
      return;
    }

    if (this.category?.custom_fields.has_chat_enabled) {
      this._fetchChannel("category", this.category.id);
    }

    if (this.tag) {
      this._fetchChannel("tag", this.tag.id);
    }
  },

  _fetchChannel(type, id) {
    ajax(`/chat/chat_channels/for_${type}/${id}`).then((response) => {
      if (response.chat_channel && !this.isDestroying && !this.isDestroyed) {
        this.setProperties({
          show: true,
          channel: response.chat_channel,
        });
        schedule("afterRender", () => {
          this.appEvents.trigger("sidebar:recalculate-button-width");
        });
      }
    });
  },

  @action
  openChat() {
    this.appEvents.trigger("chat:open-channel-for-chatable", this.channel);

    if (this.element && !this.isDestroying && !this.isDestroyed) {
      const button = this.element.querySelector(".category-tag-chat-link");
      if (button) {
        button.blur();
      }
    }
  },
});
