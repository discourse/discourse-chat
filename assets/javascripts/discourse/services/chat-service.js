import Service from "@ember/service";

export default Service.extend({
  messageId: null,

  setMessageId(messageId) {
    this.set("messageId", messageId)
  },

  getMessageId() {
    return this.messageId
  },

  clearMessageId(messageId) {
    this.set("messageId", null)
  },
});
