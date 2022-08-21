import Service from "@ember/service";

export default class ChatMessageVisibilityObserver extends Service {
  observer = new IntersectionObserver(this._observerCallback, {
    root: document,
    rootMargin: "-10px",
  });

  willDestroy() {
    this.observer.disconnect();
  }

  _observerCallback(entries) {
    entries.forEach((entry) => {
      entry.target.dataset.visible = entry.isIntersecting;
    });
  }

  observe(element) {
    this.observer.observe(element);
  }

  unobserve(element) {
    this.observer.unobserve(element);
  }
}
