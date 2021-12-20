import RawHtml from "discourse/widgets/raw-html";
import { userPath } from "discourse/lib/url";
import { autoUpdatingRelativeAge } from "discourse/lib/formatter";
import I18n from "I18n";
import { createWidget } from "discourse/widgets/widget";

export default createWidget("chat-state-post-small-action", {
  click(event) {
    if (event.target.classList.contains("open-chat")) {
      event.preventDefault();

      const topicController = this.container.lookup("controller:topic");
      this.appEvents.trigger(
        "chat:open-channel-for-chatable",
        topicController.model.chat_channel
      );
    }
  },

  html(attrs) {
    const html = I18n.t(`action_codes.${attrs.actionCode}`, {
      who: `<a class="mention" href="${userPath(attrs.actionCodeWho)}">@${
        attrs.actionCodeWho
      }</a>`,
      when: autoUpdatingRelativeAge(new Date(attrs.created_at), {
        format: "medium-with-ago-and-on",
      }),
    }).htmlSafe();

    return new RawHtml({ html: `<span>${html}</span>` });
  },
});
