import KeyValueStore from "discourse/lib/key-value-store";
import Service from "@ember/service";

const FULL_PAGE = "fullPage";
const STORE_NAMESPACE_CHAT_WINDOW = "discourse_chat_window_";

export default Service.extend({
  init() {
    this._super(...arguments);

    this.store = new KeyValueStore(STORE_NAMESPACE_CHAT_WINDOW);

    if (!this.store.getObject(FULL_PAGE)) {
      this.fullPage = false;
    }
  },

  get fullPage() {
    return this.store.getObject(FULL_PAGE) || false;
  },

  set fullPage(value) {
    this.store.setObject({ key: FULL_PAGE, value: value });
  },
});
