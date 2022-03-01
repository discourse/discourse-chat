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

    const handleMoveUpShortcut = (e) => {
      e.preventDefault();
      e.stopPropagation();
      chatService.switchChannelUpOrDown("up");
    };

    const handleMoveDownShortcut = (e) => {
      e.preventDefault();
      e.stopPropagation();
      chatService.switchChannelUpOrDown("down");
    };

    const isChatComposer = (el) => el.classList.contains("chat-composer-input");
    const modifyComposerSelection = (event, type) => {
      if (!isChatComposer(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      appEvents.trigger("chat:modify-selection", { type });
    };

    withPluginApi("0.12.1", (api) => {
      const mac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const mod = mac ? "meta" : "ctrl";

      api.addKeyboardShortcut(`${mod}+k`, openChannelSelector, {
        global: true,
        shortcutHelp: {
          category: "chat",
          details: {
            name: "chat.keyboard_shortcuts.open_quick_channel_selector",
            definition: {
              keys1: ["meta", "k"],
              keysDelimiter: "plus",
            },
          },
        },
      });
      api.addKeyboardShortcut("alt+up", handleMoveUpShortcut, {
        global: true,
        shortcutHelp: {
          category: "chat",
          details: {
            name: "chat.keyboard_shortcuts.switch_channel_arrows",
            definition: {
              keys1: ["alt", "&uarr;"],
              keys2: ["alt", "&darr;"],
              keysDelimiter: "plus",
              shortcutsDelimiter: "slash",
            },
          },
        },
      });

      api.addKeyboardShortcut("alt+down", handleMoveDownShortcut, {
        global: true,
        shortcutHelp: {
          category: "jump_to",
          details: {
            name: "chat.keyboard_shortcuts.switch_channel_arrows",
            definition: {
              keys1: ["alt", "&uarr;"],
              keys2: ["alt", "&darr;"],
              keysDelimiter: "plus",
              shortcutsDelimiter: "slash",
            },
          },
        },
      });

      api.addKeyboardShortcut(
        `${mod}+b`,
        (event) => modifyComposerSelection(event, "bold"),
        { global: true }
      );
      api.addKeyboardShortcut(
        `${mod}+i`,
        (event) => modifyComposerSelection(event, "italic"),
        { global: true }
      );
      api.addKeyboardShortcut(
        `${mod}+e`,
        (event) => modifyComposerSelection(event, "code"),
        { global: true }
      );
    });
  },
};
