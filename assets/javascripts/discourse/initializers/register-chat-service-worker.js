import { registerServiceWorker } from "discourse/lib/register-service-worker";

export default {
  name: "register-chat-service-worker",

  initialize(container) {
    registerServiceWorker(container, "chat/service-worker.js");
  },
};
