import I18n from "I18n";
import { ajax } from "discourse/lib/ajax";
import { createWidget } from "discourse/widgets/widget";
import { iconNode } from "discourse-common/lib/icon-library";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default createWidget("hamburger-chat-toggle", {
  tagName: "div.hamburger-chat-toggle",
  text() {
    return I18n.t(
    this.currentUser.has_chat_enabled ? "chat.disable" : "chat.enable"
  )
  },
  title() { this.text() },


  html() {
    return this.text();
  },


  click() {
    ajax(`/chat/user_chat_enabled/${this.currentUser.id}`, {
      method: "PUT",
      data: {
        chat_enabled: !this.currentUser.has_chat_enabled,
      },
    })
      .then((response) => {
        window.location.reload(true);
      })
      .catch(popupAjaxError);
  },
});
