import { ajax } from "discourse/lib/ajax";
import { avatarFor } from "discourse/widgets/post";
import { createWidget } from "discourse/widgets/widget";
import { dateNode } from "discourse/helpers/node";
import { emojiUnescape } from "discourse/lib/text";
import { escapeExpression, formatUsername } from "discourse/lib/utilities";
import { h } from "virtual-dom";
import { iconNode } from "discourse-common/lib/icon-library";
import { popupAjaxError } from "discourse/lib/ajax-error";
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

createWidget("tc-message-actions", {
  tagName: "div.tc-msgactions-hover",

  html(attrs) {
    let buttons = [];
    if (attrs.details.can_chat && !attrs.message.action_code) {
      buttons.push(
        this.attach("flat-button", {
          action: "reply",
          icon: "reply",
          title: "chat.reply",
        })
      );
    }
    if (attrs.details.can_flag && !attrs.message.action_code) {
      buttons.push(
        this.attach("flat-button", {
          action: "flag",
          icon: "flag",
          title: "chat.flag",
        })
      );
    }
    const canDelete =
      !attrs.message.action_code &&
      (this.currentUser && this.currentUser.id === attrs.message.user.id
        ? attrs.details.can_delete_self
        : attrs.details.can_delete_others);

    if (canDelete) {
      if (attrs.message.deleted_at) {
        buttons.push(
          this.attach("flat-button", {
            action: "restoreMessage",
            icon: "undo",
            title: "chat.restore",
          })
        );
      } else {
        buttons.push(
          this.attach("flat-button", {
            action: "deleteMessage",
            icon: "trash-alt",
            title: "chat.delete",
          })
        );
      }
    }
    if (buttons.length > 0) {
      return h("div.tc-msgactions", buttons);
    } else {
      return [];
    }
  },
});

createWidget("tc-reply-display", {
  tagName: "div",

  buildAttributes(attrs) {
    if (attrs.message.in_reply_to) {
      return { class: "tc-reply-display" };
    } else {
      return { class: "hidden" };
    }
  },

  html(attrs) {
    if (attrs.message.in_reply_to) {
      const { name, username } = attrs.message.in_reply_to.user;
      const nameFirst =
        this.siteSettings.display_name_on_posts && prioritizeNameInUx(name);
      const nameNode = nameFirst
        ? h("span.tc-reply-username", [name])
        : h("span.tc-reply-username", ["@", username]);
      // TODO: better with or without name?
      const _ = nameNode; // eslint-disable-line no-unused-vars
      // TODO excerpting, formatting

      return [
        // "share" is like reply in the other direction
        iconNode("share", { title: I18n.t("chat.in_reply_to") }),
        " ",
        h("span.tc-reply-av", [
          avatarFor("tiny", attrs.message.in_reply_to.user),
        ]),
        " ",
        //nameNode,
        //" ",
        h("span.tc-reply-msg", attrs.message.in_reply_to.message),
      ];
    }
  },
});

createWidget("tc-message", {
  tagName: "div",

  buildAttributes(attrs) {
    let classNames = ["tc-message"];
    if (attrs.message.action_code) {
      classNames.push("tc-action");
      classNames.push(`tc-action-${attrs.message.action_code}`);
    }
    if (attrs.message.deleted_at) {
      classNames.push("deleted");
    }
    if (attrs.message.in_reply_to) {
      classNames.push("is-reply");
    }
    return { class: classNames.join(" ") };
  },

  html(attrs) {
    const msg = attrs.message;
    let content = [
      new RawHtml({
        html: `<p class="tc-text">${emojiUnescape(
          escapeExpression(msg.message)
        )}</p>`,
      }),
    ];
    if (msg.action_code) {
      // DANGER: we're trusting .message as html in this case
      // .message in this case may have HTML entities from the server, decode them
      const when = autoUpdatingRelativeAge(new Date(msg.created_at), {
        format: "medium-with-ago",
      });

      const text = I18n.t(`action_codes.${msg.action_code}`, {
        excerpt: msg.message,
        when,
        who: "[INVALID]",
      });
      content = [
        new RawHtml({ html: `<span class="tc-action-text">${text}</span>` }),
      ];
    }
    return [
      this.attach("tc-message-actions", attrs),
      this.attach("tc-reply-display", attrs),
      h("div.tc-meta-data", [
        avatarFor("tiny", msg.user),
        this.attach("tc-poster-name", msg.user),
        dateNode(msg.created_at),
      ]),
      h("div.tc-msgbody", content),
    ];
  },

  reply() {
    this.attrs.setReplyTo(this.attrs.message.id);
  },

  flag() {
    // TODO showModal
    bootbox.alert("unimplemented");
  },

  deleteMessage() {
    return ajax(
      `/chat/t/${this.attrs.details.topicId}/${this.attrs.message.id}`,
      {
        type: "DELETE",
      }
    )
      .then(() => {
        this.attrs.message.deleted_at = new Date().toISOString();
      })
      .catch(popupAjaxError);
  },
});

const historyContainer = createWidget("tc-history-container", {
  tagName: "section.tc-history",

  html(attrs) {
    let lookup = {};
    attrs.chat_history.forEach(msg => {
      lookup[msg.id] = msg;
    });
    let contents = attrs.chat_history.map((msg) => {
      msg.user.template = msg.user.avatar_template; // HACK
      if (msg.in_reply_to_id) {
        msg.in_reply_to = lookup[msg.in_reply_to_id];
      }
      return this.attach("tc-message", { message: msg, details: {} });
    });

    return h("div.tc-messages-container", [contents]);
  },
});

export { historyContainer };
