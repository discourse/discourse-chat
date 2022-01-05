import Component from "@ember/component";
import { computed } from "@ember/object";

export default Component.extend({
  cooked: null,
  edited: false,

  @computed("cooked")
  get isCollapsible() {
    return /^<div class="onebox lazyYT lazyYT-container"/.test(this.cooked);
  },
});
