import { avatarFor } from "discourse/widgets/post";
import { createWidget } from "discourse/widgets/widget";
import { dateNode } from "discourse/helpers/node";
import { formatUsername } from "discourse/lib/utilities";
import { h } from "virtual-dom";
import { prioritizeNameInUx } from "discourse/lib/settings";

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
  tagName: "div.tc-message",

  html(attrs) {
    return [
      h("div.tc-meta-data", [
        avatarFor("tiny", attrs.user),
        this.attach("tc-poster-name", attrs.user),
        dateNode(attrs.created_at),
      ]),
      h("div.tc-msgbody", [attrs.message]),
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
