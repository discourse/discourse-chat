import Service from "@ember/service";

export default Service.extend({
  lastTopicEntered: null,
  appEvents: null,

  start(appEvents) {
    if (!this.currentUser || !this.currentUser.can_chat) return;

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
