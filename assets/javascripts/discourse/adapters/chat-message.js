import RESTAdapter from "discourse/adapters/rest";

export default RESTAdapter.extend({
  pathFor(store, type, findArgs) {
    if (findArgs.targetMessageId) {
      return `/chat/lookup/${findArgs.targetMessageId}.json?page_size=${findArgs.pageSize}`;
    }

    let path = `/chat/${findArgs.channelId}/messages.json?page_size=${findArgs.pageSize}`;
    if (findArgs.beforeMessageId) {
      path += `&before_message_id=${findArgs.beforeMessageId}`;
    }
    if (findArgs.afterMessageId) {
      path += `&after_message_id=${findArgs.afterMessageId}`;
    }
    return path;
  },

  apiNameFor() {
    return "chat-message";
  },
});
