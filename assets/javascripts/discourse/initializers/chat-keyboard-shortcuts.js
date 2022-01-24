import { withPluginApi } from "discourse/lib/plugin-api";
import showModal from "discourse/lib/show-modal";

function openChannelSelector(appEvents) {
  if (document.getElementById("chat-channel-selector-modal-inner")) {
    appEvents.trigger("chat-channel-selector-modal:close")
  } else {
    showModal("chat-channel-selector-modal");
  }
};

export default {
  name: "chat-keyboard-shortcuts",
  initialize(container) {
    const appEvents = container.lookup("service:app-events");
    const chatService = container.lookup("service:chat");

    if (!chatService.userCanChat) {
      return;
    }

    withPluginApi("0.12.1", (api) => {
      api.addKeyboardShortcut("command+k", () => { openChannelSelector(appEvents) }, { global: true });
      api.addKeyboardShortcut("ctrl+k", () => { openChannelSelector(appEvents) }, { global: true });
    })
  }
}
