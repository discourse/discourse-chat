import { emojiUnescape } from "discourse/lib/text";
import { avatarFor } from "discourse/widgets/post";
import { createWidget } from "discourse/widgets/widget";
import { dateNode } from "discourse/helpers/node";
import { escapeExpression, formatUsername } from "discourse/lib/utilities";
import { h } from "virtual-dom";
import { prioritizeNameInUx } from "discourse/lib/settings";
import RawHtml from "discourse/widgets/raw-html";
import { autoUpdatingRelativeAge } from "discourse/lib/formatter";
import I18n from "I18n";

createWidget("tc-poster-name", {
  // see discourse/widgets/poster-name.js
  tagName: "span.names.trigger-user-card",

  html(attrs) {
    const username = attrs.username;
    const name = attrs.name;
    // TODO similar site setting for chat?
    const nameFirst =
      this.siteSettings.display_name_on_posts && prioritizeNameInUx(name);
    const classNames = nameFirst ? ["full-name first"] : ["username first"];
    const text = nameFirst ? name : username;

    if (attrs.staff) {
      classNames.push("staff");
    }
    if (attrs.admin) {
      classNames.push("admin");
    }
    if (attrs.moderator) {
      classNames.push("moderator");
    }
    if (attrs.groupModerator) {
      classNames.push("category-moderator");
    }

    return h("span", { className: classNames.join(" ") }, [
      //h("a", {
      h(
        "span",
        {
          attributes: {
            href: attrs.usernameUrl,
            "data-user-card": attrs.username,
          },
        },
        formatUsername(text)
      ),
    ]);
  },
});

createWidget("tc-message", {
  tagName: "div",

  buildAttributes(attrs) {
    if (attrs.action_code) {
      return {
        class: `tc-message tc-action tc-action-${attrs.action_code}`,
      };
    }
    return {
      class: "tc-message",
    };
  },

  html(attrs) {
    let content = [
      new RawHtml({
        html: `<p class="tc-text">${emojiUnescape(
          escapeExpression(attrs.message)
        )}</p>`,
      }),
    ];
    if (attrs.action_code) {
      // DANGER: we're trusting .message as html in this case
      // .message in this case may have HTML entities from the server, decode them
      const when = autoUpdatingRelativeAge(new Date(attrs.created_at), {
        format: "medium-with-ago",
      });

      const text = I18n.t(`action_codes.${attrs.action_code}`, {
        excerpt: attrs.message,
        when,
        who: "[INVALID]",
      });
      content = [
        new RawHtml({ html: `<span class="tc-action-text">${text}</span>` }),
      ];
    }
    return [
      h("div.tc-meta-data", [
        avatarFor("tiny", attrs.user),
        this.attach("tc-poster-name", attrs.user),
        dateNode(attrs.created_at),
      ]),
      h("div.tc-msgbody", content),
    ];
  },
});

const historyContainer = createWidget("tc-history-container", {
  tagName: "section.tc-history",

  html(attrs) {
    let contents = attrs.chat_history.map((msg) => {
      msg.user.template = msg.user.avatar_template; // HACK
      return this.attach("tc-message", msg);
    });

    return h("div.tc-messages-container", [contents]);
  },
});

export { historyContainer };
