import { withPluginApi } from "discourse/lib/plugin-api";
import { PLUGIN_ID } from "discourse/plugins/discourse-topic-chat/discourse/initializers/chat-topic-changes";

const CHAT_ENABLED_FIELD = "chat_enabled";
const CHAT_ISOLATED_FIELD = "chat_isolated";
const ONLY_CHAT_PUSH_NOTI_FIELD = "only_chat_push_notifications";

export default {
  name: "chat-user-options",

  initialize() {
    withPluginApi("0.11.0", (api) => {
      api.addSaveableUserOptionField(CHAT_ENABLED_FIELD);
      api.addSaveableUserOptionField(CHAT_ISOLATED_FIELD);
      api.addSaveableUserOptionField(ONLY_CHAT_PUSH_NOTI_FIELD);
    });
  },
};
