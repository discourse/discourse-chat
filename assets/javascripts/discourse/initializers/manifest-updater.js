import getURL from "discourse-common/lib/get-url";
import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "chat-manifest-updater",
  initialize(container) {
    const currentUser = container.lookup("current-user:main");
    if (!currentUser?.has_chat_enabled) {
      return;
    }

    withPluginApi("0.12.1", (api) => {
      api.onPageChange((url) => {
        const manifest = document.getElementById("manifest-link")
        if (!manifest) return;

        const manifestHref = (url === "/chat" || url.startsWith("/chat/channel/"))
          ? "/chat/manifest.webmanifest"
          : "/manifest.webmanifest";
        manifest.href = getURL(manifestHref);
      })
    })
  }
}
