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

    this.observer = new IntersectionObserver(this._observerCallback, options);
  }

  _observerCallback(entries) {
    entries.forEach((entry) => {
      entry.target.dataset.visible = entry.isIntersecting;
    });
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
