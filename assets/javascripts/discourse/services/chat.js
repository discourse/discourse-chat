import Service from "@ember/service";

export default Service.extend({
  messageId: null,
  chatOpen: false,
  hasUnreadMessages: false,

  setMessageId(messageId) {
    this.set("messageId", messageId);
  },

  getMessageId() {
    return this.messageId;
  },

  clearMessageId() {
    this.set("messageId", null);
  },

  setChatOpenStatus(status) {
    this.set("chatOpen", status);
  },
  getChatOpenStatus() {
    return this.chatOpen;
  },

  setHasUnreadMessages(value) {
    this.set("hasUnreadMessages", value);
  },
  getHasUnreadMessages() {
    return this.hasUnreadMessages;
  }
});
