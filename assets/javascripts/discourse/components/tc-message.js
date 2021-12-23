import { inject as service } from "@ember/service";
import getURL from "discourse-common/lib/get-url";
import Component from "@ember/component";
import discourseComputed, { bind } from "discourse-common/utils/decorators";
import I18n from "I18n";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { prioritizeNameInUx } from "discourse/lib/settings";
import EmberObject, { action, computed } from "@ember/object";
import { autoUpdatingRelativeAge } from "discourse/lib/formatter";
import { cancel, later, schedule } from "@ember/runloop";

const HERE = "here";
const ALL = "all";

export default Component.extend({
  ADD_REACTION: "add",
  REMOVE_REACTION: "remove",
  SHOW_LEFT: "showLeft",
  SHOW_RIGHT: "showRight",
  isHovered: false,
  emojiPickerIsActive: false,
  mentionWarning: null,
  emojiStore: service("emoji-store"),

  init() {
    this._super(...arguments);
    this.set("_loadingReactions", []);
    this.message.set("reactions", EmberObject.create(this.message.reactions));
    this.appEvents.on(
      "chat-message:reaction-picker-opened",
      this,
      "_reactionPickerOpened"
    );
    this.appEvents.on(
      `chat-message-${this.message.id}:reaction`,
      this,
      "_handleReactionMessage"
    );
  },

  didInsertElement() {
    this._super(...arguments);
    if (!this.currentUser) {
      return;
    }
    this.element
      .querySelector(".tc-text")
      ?.querySelectorAll(".mention")
      .forEach((node) => {
        const mention = node.textContent.trim().substr(1);
        const highlightable = [this.currentUser.username, HERE, ALL];
        if (highlightable.includes(mention)) {
          node.classList.add("highlighted");
          node.classList.add("valid-mention");
        }
      });
  },

  willDestroyElement() {
    this._super(...arguments);
    this.appEvents.off(
      "chat-message:reaction-picker-opened",
      this,
      "_reactionPickerOpened"
    );
    this.appEvents.off(
      `chat-message-${this.message.id}:reaction`,
      this,
      "_handleReactionMessage"
    );

    cancel(this._invitationSentTimer);
  },

  _reactionPickerOpened(messageId) {
    if (this.message.id === messageId || !this.emojiPickerIsActive) {
      return;
    }

    this.set("emojiPickerIsActive", false);
  },

  @discourseComputed("message.deleted_at", "message.expanded")
  deletedAndCollapsed(deletedAt, expanded) {
    return deletedAt && !expanded;
  },
  @computed(
    "selectingMessages",
    "showFlagButton",
    "showDeleteButton",
    "showRestoreButton",
    "showEditButton"
  )
  get moreButtons() {
    const buttons = [];

    buttons.push({
      id: "copyLinkToMessage",
      name: I18n.t("chat.copy_link"),
      icon: "link",
    });

    if (this.showEditButton) {
      buttons.push({
        id: "edit",
        name: I18n.t("chat.edit"),
        icon: "pencil-alt",
      });
    }

    if (this.currentUser.staff && !this.selectingMessages) {
      buttons.push({
        id: "selectMessage",
        name: I18n.t("chat.select"),
        icon: "tasks",
      });
    }

    if (this.showFlagButton) {
      buttons.push({
        id: "flag",
        name: I18n.t("chat.flag"),
        icon: "flag",
      });
    }

    if (this.showDeleteButton) {
      buttons.push({
        id: "deleteMessage",
        name: I18n.t("chat.delete"),
        icon: "trash-alt",
      });
    }

    if (this.showRestoreButton) {
      buttons.push({
        id: "restore",
        name: I18n.t("chat.restore"),
        icon: "undo",
      });
    }

    return buttons;
  },

  @action
  handleMoreButtons(value) {
    this[value].call();
  },

  @discourseComputed("message")
  show(message) {
    return (
      !message.deleted_at ||
      this.currentUser === this.message.user.id ||
      this.currentUser.staff
    );
  },

  click() {
    if (this.site.mobileView) {
      this.toggleProperty("isHovered");
    }
  },

  @discourseComputed("message.hideUserInfo", "message.chat_webhook_event")
  hideUserInfo(hide, webhookEvent) {
    return hide && !webhookEvent;
  },

  @discourseComputed("selectingMessages", "message.id")
  messageContainerClasses(selecting, id) {
    return `chat-message chat-message-${id} ${
      selecting ? "selecting-messages" : ""
    }`.trim();
  },

  @discourseComputed(
    "message.staged",
    "message.deleted_at",
    "message.in_reply_to",
    "message.action_code",
    "isHovered"
  )
  innerMessageClasses(staged, deletedAt, inReplyTo, actionCode, isHovered) {
    let classNames = ["tc-message"];

    if (staged) {
      classNames.push("tc-message-staged");
    }
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
    if (isHovered) {
      classNames.push("tc-message-selected");
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
  showEditButton(message, deletedAt) {
    return (
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

  @discourseComputed("message.reactions.@each")
  hasReactions(reactions) {
    return Object.values(reactions).some((r) => r.count > 0);
  },

  @discourseComputed("message.mentionWarning.cannot_see")
  mentionedCannotSeeText(users) {
    return I18n.t("chat.mention_warning.cannot_see", {
      usernames: users.mapBy("username").join(", "),
      count: users.length,
    });
  },

  @discourseComputed("message.mentionWarning.without_membership")
  mentionedWithoutMembershipText(users) {
    return I18n.t("chat.mention_warning.without_membership", {
      usernames: users.mapBy("username").join(", "),
      count: users.length,
    });
  },

  @action
  inviteMentioned() {
    const user_ids = this.message.mentionWarning.without_membership.mapBy("id");
    ajax(`/chat/${this.details.chat_channel_id}/invite`, {
      method: "PUT",
      data: { user_ids, chat_message_id: this.message.id },
    }).then(() => {
      this.message.set("mentionWarning.invitationSent", true);
      this._invitationSentTimer = later(() => {
        this.message.set("mentionWarning", null);
      }, 3000);
    });
    return false;
  },

  @action
  dismissMentionWarning() {
    this.message.set("mentionWarning", null);
  },

  @action
  showUsersList(reaction) {
    let list;
    let usernames = reaction.users.map((u) => u.username).join(", ");
    if (reaction.reacted) {
      if (reaction.count === 1) {
        list = I18n.t("chat.reactions.only_you", { emoji: reaction.emoji });
      } else if (reaction.count > 1 && reaction.count < 6) {
        list = I18n.t("chat.reactions.and_others", {
          usernames,
          emoji: reaction.emoji,
        });
      } else if (reaction.count >= 6) {
        list = I18n.t("chat.reactions.you_others_and_more", {
          usernames,
          emoji: reaction.emoji,
          more: reaction.count - 5,
        });
      }
    } else {
      if (reaction.count > 0 && reaction.count < 6) {
        list = I18n.t("chat.reactions.only_others", {
          usernames,
          emoji: reaction.emoji,
        });
      } else if (reaction.count >= 6) {
        list = I18n.t("chat.reactions.others_and_more", {
          usernames,
          emoji: reaction.emoji,
          more: reaction.count - 5,
        });
      }
    }
    this.set("reactionLabel", list);
  },

  @action
  hideUsersList() {
    this.set("reactionLabel", null);
  },

  @action
  startReactionForMsgActions() {
    const btn = this.element.querySelector(".tc-msgactions-hover .react-btn");
    this._startReaction(btn, this.SHOW_LEFT);
  },

  @action
  startReactionForReactionList() {
    const btn = this.element.querySelector(
      ".chat-message-reaction-list .chat-message-react-btn"
    );
    this._startReaction(btn, this.SHOW_RIGHT);
  },

  _startReaction(btn, position) {
    if (this.emojiPickerIsActive) {
      this.set("emojiPickerIsActive", false);
      document.activeElement?.blur();
    } else {
      this.set("emojiPickerIsActive", true);
      this.appEvents.trigger(
        "chat-message:reaction-picker-opened",
        this.message.id
      );

      schedule("afterRender", () => {
        this._repositionEmojiPicker(btn, position);
      });
    }
  },

  _repositionEmojiPicker(btn, position) {
    if (!this.element) {
      return;
    }

    const emojiPicker = this.element.querySelector(".emoji-picker");
    if (!emojiPicker || !btn) {
      return;
    }
    const reactBtnBounds = btn.getBoundingClientRect();
    const reactBtnPositions = {
      bottom: window.innerHeight - reactBtnBounds.bottom,
      left: reactBtnBounds.left + window.pageXOffset,
    };

    // Calculate left pixel value
    let leftValue = 0;

    if (!this.site.mobileView) {
      const xAdjustment =
        position === this.SHOW_RIGHT && this.fullPage
          ? btn.offsetWidth + 10
          : (emojiPicker.offsetWidth + 10) * -1;
      leftValue = reactBtnPositions.left + xAdjustment;
      if (
        leftValue < 0 ||
        leftValue + emojiPicker.getBoundingClientRect().width >
          window.innerWidth
      ) {
        leftValue = 0;
      }
    }

    // Calculate bottom pixel value
    let bottomValue = reactBtnPositions.bottom - emojiPicker.offsetHeight + 50;
    const messageContainer = document.querySelector(".tc-messages-scroll");
    const bottomOfMessageContainer =
      window.innerHeight - messageContainer.getBoundingClientRect().bottom;
    if (bottomValue < bottomOfMessageContainer) {
      bottomValue = bottomOfMessageContainer;
    }

    emojiPicker.style.bottom = `${bottomValue}px`;
    emojiPicker.style.left = `${leftValue}px`;
  },

  @action
  deselectReaction(emoji) {
    this.set("emojiPickerIsActive", false);
    this.react(emoji, this.REMOVE_REACTION);
    this.notifyPropertyChange("favoritesEmojis");
  },

  @action
  selectReaction(emoji) {
    this.set("emojiPickerIsActive", false);
    this.react(emoji, this.ADD_REACTION);
    this.notifyPropertyChange("favoritesEmojis");
  },

  @bind
  _handleReactionMessage(busData) {
    const loadingReactionIndex = this._loadingReactions.indexOf(busData.emoji);
    if (loadingReactionIndex > -1) {
      return this._loadingReactions.splice(loadingReactionIndex, 1);
    }

    this._updateReactionsList(busData.emoji, busData.action, busData.user);
    this.afterReactionAdded();
  },

  @action
  react(emoji, reactAction) {
    if (this._loadingReactions.includes(emoji)) {
      return;
    }

    this._loadingReactions.push(emoji);
    this._updateReactionsList(emoji, reactAction, this.currentUser);
    this._publishReaction(emoji, reactAction);
    this.notifyPropertyChange("favoritesEmojis");
  },

  _updateReactionsList(emoji, reactAction, user) {
    const selfReacted = this.currentUser.id === user.id;
    if (this.message.reactions[emoji]) {
      if (
        selfReacted &&
        reactAction === this.ADD_REACTION &&
        this.message.reactions[emoji].reacted
      ) {
        // User is already has reaction added; do nothing
        return false;
      }

      let newCount =
        reactAction === this.ADD_REACTION
          ? this.message.reactions[emoji].count + 1
          : this.message.reactions[emoji].count - 1;

      this.message.reactions.set(`${emoji}.count`, newCount);
      if (selfReacted) {
        this.message.reactions.set(
          `${emoji}.reacted`,
          reactAction === this.ADD_REACTION
        );
      } else {
        this.message.reactions[emoji].users.pushObject(user);
      }
    } else {
      if (reactAction === this.ADD_REACTION) {
        this.message.reactions.set(emoji, {
          count: 1,
          reacted: selfReacted,
          users: selfReacted ? [] : [user],
        });
      }
    }
    this.message.notifyPropertyChange("reactions");
  },

  _publishReaction(emoji, reactAction) {
    return ajax(
      `/chat/${this.details.chat_channel_id}/react/${this.message.id}`,
      {
        type: "PUT",
        data: {
          react_action: reactAction,
          emoji,
        },
      }
    ).catch(popupAjaxError);
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
    this.afterExpand();
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

  @action
  selectMessage() {
    this.message.set("selected", true);
    this.onStartSelectingMessages(this.message);
  },

  @action
  toggleChecked(e) {
    schedule("afterRender", this, () => {
      if (e.shiftKey) {
        this.bulkSelectMessages(this.message, e.target.checked);
      }

      this.onSelectMessage(this.message);
    });
  },

  @action
  copyLinkToMessage() {
    this.element
      .querySelector(".link-to-message-btn")
      ?.classList?.add("copied");

    const { protocol, host } = window.location;
    let url = getURL(
      `/chat/channel/${this.details.chat_channel_id}/chat?messageId=${this.message.id}`
    );
    url = url.indexOf("/") === 0 ? protocol + "//" + host + url : url;

    const textArea = document.createElement("textarea");
    textArea.style.position = "absolute";
    textArea.style.left = "-99999px";
    textArea.value = url;
    this.element.append(textArea);
    textArea.focus();
    textArea.setSelectionRange(0, url.length);
    document.execCommand("copy");
    this.element.removeChild(textArea);

    later(() => {
      this.element
        ?.querySelector(".link-to-message-btn")
        ?.classList?.remove("copied");
    }, 250);
  },

  @discourseComputed("emojiStore.favorites.[]")
  favoritesEmojis(favorites) {
    const userReactions = Object.keys(this.message.reactions).filter((key) => {
      return this.message.reactions[key].reacted;
    });

    return favorites.slice(0, 3).map((emoji) => {
      if (userReactions.includes(emoji)) {
        return { emoji, reacted: true };
      } else {
        return { emoji, reacted: false };
      }
    });
  },
});
