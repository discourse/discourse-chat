import { withPluginApi } from "discourse/lib/plugin-api";

const CHAT_ENABLED_FIELD = "chat_enabled";
const CHAT_ISOLATED_FIELD = "chat_isolated";
const ONLY_CHAT_PUSH_NOTI_FIELD = "only_chat_push_notifications";
const CHAT_SOUND = "chat_sound";

export default {
  name: "chat-user-options",

  initialize() {
    withPluginApi("0.11.0", (api) => {
      api.addSaveableUserOptionField(CHAT_ENABLED_FIELD);
      api.addSaveableUserOptionField(CHAT_ISOLATED_FIELD);
      api.addSaveableUserOptionField(ONLY_CHAT_PUSH_NOTI_FIELD);
      api.addSaveableUserOptionField(CHAT_SOUND);
    });
  },
};
