import { bind } from "discourse-common/utils/decorators";

import Component from "@ember/component";
import { schedule } from "@ember/runloop";
import { isTesting } from "discourse-common/config/environment";

export default class ComputeLivePaneHeight extends Component {
  tagName = "";

  selector = ".chat-live-pane";

  didInsertElement() {
    this._super(...arguments);

    window.addEventListener("resize", this._updateHeight, false);
    this.appEvents.on("composer:resized", this, "_updateHeight");
    this.appEvents.on("discourse:focus-changed", this, "_updateHeight");

    this._updateHeight();
  }

  willDestroyElement() {
    this._super(...arguments);

    window.removeEventListener("resize", this._updateHeight, false);
    this.appEvents.off("composer:resized", this, "_updateHeight");
    this.appEvents.off("discourse:focus-changed", this, "_updateHeight");

    document.body.style.removeProperty("--full-page-chat-live-pane-height");
  }

  @bind
  _updateHeight() {
    if (isTesting()) {
      return;
    }

    schedule("afterRender", () => {
      if (document.querySelector(this.selector)) {
        document.body.style.setProperty(
          "--full-page-chat-live-pane-height",
          `${this._calculateHeight(this.selector)}px`
        );
      }
    });
  }

  _calculateHeight(selector) {
    const main = document.getElementById("main-outlet");
    const padBottom = window
      .getComputedStyle(main, null)
      .getPropertyValue("padding-bottom");
    const chatContainerCoords = document
      .querySelector(selector)
      .getBoundingClientRect();

    return (
      window.innerHeight -
      chatContainerCoords.y -
      window.pageYOffset -
      parseInt(padBottom, 10)
    );
  }
}
