import Service from "@ember/service";

export default class ChatMessageVisibilityObserver extends Service {
  constructor() {
    super(...arguments);
    this._setup();
  }

  _setup() {
    const options = {
      root: document,
      rootMargin: "-10px",
    };

    const callback = (entries) => {
      entries.forEach((entry) => {
        entry.target.dataset.visible = entry.isIntersecting;
      });
    };

    this.observer = new IntersectionObserver(callback, options);
  }

  willDestroy() {
    this.observer.disconnect();
  }

  observe(element) {
    this.observer.observe(element);
  }

  unobserve(element) {
    this.observer.unobserve(element);
  }
}
