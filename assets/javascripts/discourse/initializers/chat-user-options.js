import { withPluginApi } from "discourse/lib/plugin-api";
import { PLUGIN_ID } from "discourse/plugins/discourse-topic-chat/discourse/initializers/chat-topic-changes";

const CHAT_ENABLED_FIELD = "chat_enabled";
const CHAT_ISOLATED_FIELD = "chat_isolated";

export default {
  name: "chat-user-options",

  initialize() {
    withPluginApi("0.11.0", (api) => {
      api.addSaveableUserOptionField(CHAT_ENABLED_FIELD);
      api.addSaveableUserOptionField(CHAT_ISOLATED_FIELD);

      api.modifyClass("controller:preferences/interface", {
        pluginId: PLUGIN_ID,
        actions: {
          save() {
            this.saveAttrNames.push(CHAT_ENABLED_FIELD);
            this.saveAttrNames.push(CHAT_ISOLATED_FIELD);
            this._super(...arguments);
          },
        },
      });
    });
  },
};
