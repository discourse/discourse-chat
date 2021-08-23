import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { prioritizeNameInUx } from "discourse/lib/settings";
import { action } from "@ember/object";
import { autoUpdatingRelativeAge } from "discourse/lib/formatter";
import I18n from "I18n";

export default Component.extend({
  tagName: "",
  lastRead: false,

  @discourseComputed("message.deleted_at", "message.expanded")
  deletedAndCollapsed(deletedAt, expanded) {
    return deletedAt && !expanded;
  },

  @discourseComputed("message")
  show(message) {
    return (
      !message.deleted_at ||
      this.currentUser === this.message.user.id ||
      this.currentUser.staff
    );
  },

  @discourseComputed("message.hideUserInfo", "message.chat_webhook_event")
  hideUserInfo(hide, webhookEvent) {
    return hide && !webhookEvent;
  },

  @discourseComputed(
    "message.id",
    "message.staged",
    "message.deleted_at",
    "message.in_reply_to",
    "message.action_code",
  )
  messageClasses(
    id,
    staged,
    deletedAt,
    inReplyTo,
    actionCode,
  ) {
    let classNames = ["tc-message"];
    classNames.push(
      staged ? "tc-message-staged" : `tc-message-${this.message.id}`
    );

    if (actionCode) {
      classNames.push("tc-action");
      classNames.push(`tc-action-${actionCode}`);
    }
    if (deletedAt) {
      classNames.push("deleted");
    }
    if (inReplyTo) {
      classNames.push("is-reply");
    }
    if (this.hideUserInfo) {
      classNames.push("user-info-hidden");
    }
    return classNames.join(" ");
  },

  @discourseComputed("message.user")
  name(user) {
    return this.prioritizeName ? user.name : user.username;
  },

  @discourseComputed("message.user.name")
  prioritizeName(name) {
    return this.siteSettings.display_name_on_posts && prioritizeNameInUx(name);
  },

  @discourseComputed("message.user")
  usernameClasses(user) {
    const classes = this.prioritizeName
      ? ["full-name names first"]
      : ["username names first"];
    if (user.staff) {
      classes.push("staff");
    }
    if (user.admin) {
      classes.push("admin");
    }
    if (user.moderator) {
      classes.push("moderator");
    }
    if (user.groupModerator) {
      classes.push("category-moderator");
    }
    return classes.join(" ");
  },

  @discourseComputed("message", "message.deleted_at")
  showReplyButton(message, deletedAt) {
    return (
      !message.chat_webhook_event &&
      this.details.can_chat &&
      !message.action_code &&
      !deletedAt
    );
  },

  @discourseComputed("message", "message.deleted_at")
  showEditButton(message, deletedAt) {
    return (
      this.details.can_chat &&
      !message.action_code &&
      !deletedAt &&
      this.currentUser.id === message.user.id
    );
  },

  @discourseComputed("message", "message.deleted_at")
  showFlagButton(message, deletedAt) {
    return (
      this.currentUser?.id !== message.user.id &&
      !message.chat_webhook_event &&
      !deletedAt
    );
    // TODO: Add flagging
    // return this.details.can_flag && !message.action_code && !deletedAt;
  },

  @discourseComputed("message")
  canManageDeletion(message) {
    return (
      !message.action_code &&
      (this.currentUser?.id === message.user.id
        ? this.details.can_delete_self
        : this.details.can_delete_others)
    );
  },

  @discourseComputed("message.deleted_at")
  showDeleteButton(deletedAt) {
    return this.canManageDeletion && !deletedAt;
  },

  @discourseComputed("message.deleted_at")
  showRestoreButton(deletedAt) {
    return this.canManageDeletion && deletedAt;
  },

  @discourseComputed("message", "message.action_code")
  actionCodeText(message, actionCode) {
    const when = autoUpdatingRelativeAge(new Date(message.created_at), {
      format: "medium-with-ago",
    });

    return I18n.t(`action_codes.${actionCode}`, {
      excerpt: message.message,
      when,
      who: "[INVALID]",
    });
  },

  @action
  reply() {
    this.setReplyTo(this.message.id);
  },

  @action
  viewReply() {
    this.replyMessageClicked(this.message.in_reply_to);
  },

  @action
  edit() {
    this.editButtonClicked(this.message.id);
  },

  @action
  flag() {
    // TODO showModal
    bootbox.alert("unimplemented");
  },

  @action
  expand() {
    this.message.set("expanded", true);
  },

  @action
  restore() {
    return ajax(
      `/chat/${this.details.chat_channel_id}/restore/${this.message.id}`,
      {
        type: "PUT",
      }
    ).catch(popupAjaxError);
  },

  @action
  deleteMessage() {
    return ajax(`/chat/${this.details.chat_channel_id}/${this.message.id}`, {
      type: "DELETE",
    }).catch(popupAjaxError);
  },
});
