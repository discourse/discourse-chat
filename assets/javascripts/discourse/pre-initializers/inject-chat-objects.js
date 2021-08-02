import ChatService from "discourse/plugins/discourse-topic-chat/discourse/services/chat-service";

export default {
  name: "inject-chat-service",
  after: "discourse-bootstrap",

  initialize(_, app) {
    app.register("service:chat", ChatService);
    app.inject("component", "chatService", "service:chat")
  }
}
