import Service from "@ember/service";

export default Service.extend({
  lastTopicEntered: null,
  appEvents: null,

  start(appEvents) {
    this.set("appEvents", appEvents);
    this.appEvents.on("page:topic-loaded", this, "_captureLastEnteredTopic");
  },

  stop() {
    this.appEvents.off("page:topic-loaded", this, "_captureLastEnteredTopic");
  },

  _captureLastEnteredTopic(topic) {
    this.set("lastTopicEntered", topic);
  },
});
