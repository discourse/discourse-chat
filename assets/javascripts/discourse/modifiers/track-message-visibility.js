import Modifier from "ember-modifier";
import { registerDestructor } from "@ember/destroyable";

export default class TrackMessageVisibility extends Modifier {
  element = null;
  observer = null;

  constructor(owner, args) {
    super(owner, args);
    registerDestructor(this, (instance) => instance.cleanup());
  }

  modify(element) {
    this.element = element;

    const options = {
      root: document.querySelector(".chat-messages-container"),
      rootMargin: "0px",
      threshold: 0.6,
    };

    const callback = (entries) => {
      entries.forEach((entry) => {
        entry.target.dataset.visible = entry.isIntersecting;
      });
    };

    this.observer = new IntersectionObserver(callback, options);
    this.observer.observe(element);
  }

  cleanup() {
    this.observer.disconnect();
  }
}
