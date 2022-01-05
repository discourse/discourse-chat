import Component from "@ember/component";
import { computed } from "@ember/object";

export default Component.extend({
  cooked: null,
  uploads: null,
  edited: false,

  @computed("cooked", "uploads")
  get isCollapsible() {
    return /^<div class="onebox lazyYT lazyYT-container"/.test(this.cooked);
  },
});
