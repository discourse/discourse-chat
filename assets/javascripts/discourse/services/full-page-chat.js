import KeyValueStore from "discourse/lib/key-value-store";
import Service from "@ember/service";
import Site from "discourse/models/site";

const FULL_PAGE = "fullPage";
const STORE_NAMESPACE_CHAT_WINDOW = "discourse_chat_window_";

export default class FullPageChat extends Service {
  constructor() {
    super(...arguments);

    this.store = new KeyValueStore(STORE_NAMESPACE_CHAT_WINDOW);
    this._fromTransition = null;
    this._fullPage = false;
  }

  enter(fromTransition) {
    this._fromTransition = fromTransition;
    this._fullPage = true;
  }

  exit() {
    this._fullPage = false;
    return this._fromTransition;
  }

  get isActive() {
    return this._fullPage;
  }

  get isPrefered() {
    return !!(
      Site.currentProp("mobileView") || this.store.getObject(FULL_PAGE)
    );
  }

  set isPrefered(value) {
    this.store.setObject({ key: FULL_PAGE, value });
  }
}
