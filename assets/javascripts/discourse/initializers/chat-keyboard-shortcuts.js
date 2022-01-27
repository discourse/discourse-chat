import { withPluginApi } from "discourse/lib/plugin-api";
import showModal from "discourse/lib/show-modal";

export default {
  name: "chat-keyboard-shortcuts",
  initialize(container) {
    const chatService = container.lookup("service:chat");
    if (!chatService.userCanChat) {
      return;
    }

    const appEvents = container.lookup("service:app-events");
    const openChannelSelector = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (document.getElementById("chat-channel-selector-modal-inner")) {
        appEvents.trigger("chat-channel-selector-modal:close");
      } else {
        showModal("chat-channel-selector-modal");
      }
    };

    withPluginApi("0.12.1", (api) => {
      api.addKeyboardShortcut("command+k", openChannelSelector, {
        global: true,
      });
      api.addKeyboardShortcut("ctrl+k", openChannelSelector, { global: true });
    });
  },
};
