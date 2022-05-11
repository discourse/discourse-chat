import Component from "@ember/component";
import { cancel, later } from "@ember/runloop";
import { action, computed } from "@ember/object";
import { emojiUrlFor } from "discourse/lib/text";

export default class ChatMessageReaction extends Component {
  emoji = null;
  showUsersList = null;
  hideUsersList = null;
  reacted = null;
  count = null;
  tagName = "";
  react = null;

  @computed("emoji")
  get emojiString() {
    return `:${this.emoji}:`;
  }

  @computed("emoji")
  get emojiUrl() {
    return emojiUrlFor(this.emoji);
  }

  @action
  handleClick() {
    if (this.capabilities.touch) {
      return;
    }

    cancel(this._hoverTimer);
    this?.react(this.emoji, this.reacted ? "remove" : "add");
    return false;
  }

  @action
  handleTouchstart(event) {
    if (!this.showUsersList) {
      return;
    }

    if (!this.capabilities.touch) {
      return;
    }

    cancel(this._touchTimeout);
    event.stopPropagation();

    this._touchTimeout = later(() => {
      this.showUsersList(this);
    }, 400);
  }

  @action
  handleTouchend() {
    if (!this.capabilities.touch) {
      return;
    }

    cancel(this._touchTimeout);

    this?.react(this.emoji, this.reacted ? "remove" : "add");
  }

  @action
  handleMouseover(event) {
    if (this.site.mobileView) {
      return;
    }

    if (!this.showUsersList) {
      return;
    }

    event.stopPropagation();

    cancel(this._hoverTimer);
    this._hoverTimer = later(() => {
      this.showUsersList(this);
    }, 500);
  }

  @action
  handleMouseout(event) {
    if (this.site.mobileView) {
      return;
    }

    if (!this.hideUsersList) {
      return;
    }

    event.stopPropagation();

    cancel(this._hoverTimer);
    this.hideUsersList();
  }
}
