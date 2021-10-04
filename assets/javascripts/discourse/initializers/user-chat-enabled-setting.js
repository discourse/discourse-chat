import { withPluginApi } from "discourse/lib/plugin-api";
import { PLUGIN_ID } from "discourse/plugins/discourse-topic-chat/discourse/initializers/chat-topic-changes"

const USER_OPTION_FIELD = "chat_enabled";

export default {
  name: "user-chat-enabled-setting",

  initialize() {
    withPluginApi("0.11.0", (api) => {
      api.addSaveableUserOptionField(USER_OPTION_FIELD);

      api.modifyClass("controller:preferences/interface", {
        pluginId: PLUGIN_ID,
        actions: {
          save() {
            this.saveAttrNames.push(USER_OPTION_FIELD);
            this._super(...arguments);
          },
        },
      });
    });
  },
};
