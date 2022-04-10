// temporary stuff to be moved in core with discourse-loading-slider

import Component from "@ember/component";
import { cancel, later, schedule } from "@ember/runloop";

const STORE_LOADING_TIMES = 5;
const DEFAULT_LOADING_TIME = 0.3;
const MIN_LOADING_TIME = 0.1;
const STILL_LOADING_DURATION = 2;
const MIN_LOADING_TIME_TRIGGER = 0.5;

export default Component.extend({
  tagName: "",
  isLoading: false,
  key: null,

  init() {
    this._super(...arguments);

    this.loadingTimes = [DEFAULT_LOADING_TIME];
    this.set("averageTime", DEFAULT_LOADING_TIME);
    this.i = 0;
    this.scheduled = [];
  },

  cancelScheduled() {
    this.scheduled.forEach((s) => cancel(s));
    this.scheduled = [];
  },

  didReceiveAttrs() {
    this._super(...arguments);

    if (!this.key) {
      return;
    }

    if (this.isLoading) {
      this.start();
    } else {
      this.end();
    }
  },

  get container() {
    return document.getElementById(this.key);
  },

  start() {
    this.set("startedAt", Date.now());

    this.cancelScheduled();

    this.scheduled.push(
      later(() => {
        this.container?.classList?.add("loading");
        document.documentElement.style.setProperty(
          "--loading-duration",
          `${this.averageTime.toFixed(2)}s`
        );
      }, MIN_LOADING_TIME_TRIGGER * 1000)
    );

    this.scheduled.push(
      later(this, "stillLoading", STILL_LOADING_DURATION * 1000)
    );
  },

  stillLoading() {
    this.scheduled.push(
      schedule("afterRender", () => {
        this.container?.classList?.add("still-loading");
      })
    );
  },

  end() {
    this.updateAverage((Date.now() - this.startedAt) / 1000);

    this.cancelScheduled();
    this.scheduled.push(
      schedule("afterRender", () => {
        this.container?.classList?.remove("loading", "still-loading");
      })
    );
  },

  updateAverage(durationSeconds) {
    if (durationSeconds < MIN_LOADING_TIME) {
      durationSeconds = MIN_LOADING_TIME;
    }

    this.loadingTimes[this.i] = durationSeconds;

    this.i = (this.i + 1) % STORE_LOADING_TIMES;
    this.set(
      "averageTime",
      this.loadingTimes.reduce((p, c) => p + c, 0) / this.loadingTimes.length
    );
  },
});
