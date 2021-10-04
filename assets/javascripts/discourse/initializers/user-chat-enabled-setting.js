import { withPluginApi } from "discourse/lib/plugin-api";

const USER_OPTION_FIELD = "chat_enabled";

export default {
  name: "user-chat-enabled-setting",

  initialize() {
    withPluginApi("0.11.0", (api) => {
      api.addSaveableUserOptionField(USER_OPTION_FIELD);

      api.modifyClass("controller:preferences/interface", {
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
