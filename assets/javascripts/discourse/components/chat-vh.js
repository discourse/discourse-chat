import { bind } from "discourse-common/utils/decorators";
import Component from "@ember/component";
import { throttle } from "@ember/runloop";

const CSS_VAR = "--chat-vh";

export default class ChatVh extends Component {
  tagName = "";

  didInsertElement() {
    this._super(...arguments);

    this.setVH();

    (window?.visualViewport || window).addEventListener(
      "resize",
      this.setVHThrottler,
      false
    );
  }

  willDestroyElement() {
    this._super(...arguments);

    (window?.visualViewport || window).removeEventListener(
      "resize",
      this.setVHThrottler
    );
  }

  @bind
  setVH() {
    if (this.isDestroying || this.isDestroyed) {
      return;
    }

    if (document.documentElement.clientWidth / window.innerWidth !== 1) {
      return;
    }

    const vhInPixels =
      (window.visualViewport?.height || window.innerHeight) * 0.01;
    document.documentElement.style.setProperty(CSS_VAR, `${vhInPixels}px`);
  }

  @bind
  setVHThrottler() {
    throttle(this, this.setVH, 100, false);
  }
}
