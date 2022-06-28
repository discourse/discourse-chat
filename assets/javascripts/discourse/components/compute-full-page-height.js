import { bind } from "discourse-common/utils/decorators";

import Component from "@ember/component";
import { schedule } from "@ember/runloop";
import { isTesting } from "discourse-common/config/environment";

export default class ComputeFullPageHeight extends Component {
  tagName = "";

  didInsertElement() {
    this._super(...arguments);

    window.addEventListener("resize", this._calculateHeight, false);
    this.appEvents.on("composer:resized", this, "_calculateHeight");
    this.appEvents.on("discourse:focus-changed", this, "_calculateHeight");

    this._calculateHeight();
  }

  willDestroyElement() {
    this._super(...arguments);

    window.removeEventListener("resize", this._calculateHeight, false);
    this.appEvents.off("composer:resized", this, "_calculateHeight");
    this.appEvents.off("discourse:focus-changed", this, "_calculateHeight");

    document.body.style.removeProperty("--full-page-chat-height");
  }

  @bind
  _calculateHeight() {
    if (isTesting()) {
      return;
    }

    schedule("afterRender", () => {
      let fullPageChatHeight;

      const main = document.getElementById("main-outlet");
      const padBottom = window
        .getComputedStyle(main, null)
        .getPropertyValue("padding-bottom");
      const chatContainerCoords = document
        .querySelector(".chat-live-pane")
        .getBoundingClientRect();

      fullPageChatHeight =
        window.innerHeight -
        chatContainerCoords.y -
        window.pageYOffset -
        parseInt(padBottom, 10);

      document.body.style.setProperty(
        "--full-page-chat-height",
        `${fullPageChatHeight}px`
      );
    });
  }
}
