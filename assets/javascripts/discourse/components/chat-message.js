import bootbox from "bootbox";
import Bookmark from "discourse/models/bookmark";
import { openBookmarkModal } from "discourse/controllers/bookmark";
import { isTesting } from "discourse-common/config/environment";
import Component from "@ember/component";
import I18n from "I18n";
import getURL from "discourse-common/lib/get-url";
import optionalService from "discourse/lib/optional-service";
import discourseComputed, {
  afterRender,
  bind,
} from "discourse-common/utils/decorators";
import EmberObject, { action, computed } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { cancel, later, schedule } from "@ember/runloop";
import { clipboardCopy } from "discourse/lib/utilities";
import { inject as service } from "@ember/service";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { Promise } from "rsvp";

let _chatMessageDecorators = [];

export function addChatMessageDecorator(decorator) {
  _chatMessageDecorators.push(decorator);
}

export function resetChatMessageDecorators() {
  _chatMessageDecorators = [];
}

export const MENTION_KEYWORDS = ["here", "all"];

export default Component.extend({
  ADD_REACTION: "add",
  REMOVE_REACTION: "remove",
  SHOW_LEFT: "showLeft",
  SHOW_RIGHT: "showRight",
  canInteractWithChat: false,
  isHovered: false,
  onHoverMessage: null,
  emojiPickerIsActive: false,
  mentionWarning: null,
  emojiReactionStore: service("chat-emoji-reaction-store"),
  adminTools: optionalService(),
  _hasSubscribedToAppEvents: false,
  tagName: "",
  previewing: false,
  chat: service(),

  init() {
    this._super(...arguments);

    this.set("_loadingReactions", []);
    this.message.set("reactions", EmberObject.create(this.message.reactions));
    this.message.id
      ? this._subscribeToAppEvents()
      : this._waitForIdToBePopulated();
    if (this.message.bookmark) {
      this.set("message.bookmark", Bookmark.create(this.message.bookmark));
    }
  },

  willDestroyElement() {
    this._super(...arguments);
    if (this.message.stagedId) {
      this.appEvents.off(
        `chat-message-staged-${this.message.stagedId}:id-populated`,
        this,
        "_subscribeToAppEvents"
      );
    }

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

  didReceiveAttrs() {
    this._super(...arguments);

    schedule("afterRender", () => {
      if (!this.messageContainer) {
        return;
      }

      _chatMessageDecorators.forEach((decorator) => {
        decorator.call(this, this.messageContainer, this.chatChannel);
      });
    });
  },

  @computed("message.{id,stagedId}")
  get messageContainer() {
    const id = this.message?.id || this.message?.stagedId;
    return (
      id && document.querySelector(`.chat-message-container[data-id='${id}']`)
    );
  },

  _subscribeToAppEvents() {
    if (!this.message.id || this._hasSubscribedToAppEvents) {
      return;
    }

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
    this._hasSubscribedToAppEvents = true;
  },

  _waitForIdToBePopulated() {
    this.appEvents.on(
      `chat-message-staged-${this.message.stagedId}:id-populated`,
      this,
      "_subscribeToAppEvents"
    );
  },

  _reactionPickerOpened(messageId) {
    if (this.message.id === messageId || !this.emojiPickerIsActive) {
      return;
    }

    this.set("emojiPickerIsActive", false);
  },

  @discourseComputed("canInteractWithChat", "message.staged", "isHovered")
  showActions(canInteractWithChat, messageStaged, isHovered) {
    return canInteractWithChat && !messageStaged && isHovered;
  },

  @discourseComputed("message.deleted_at", "message.expanded")
  deletedAndCollapsed(deletedAt, expanded) {
    return deletedAt && !expanded;
  },

  @discourseComputed(
    "selectingMessages",
    "canFlagMessage",
    "showDeleteButton",
    "showRestoreButton",
    "showEditButton",
    "showRebakeButton",
    "message.bookmark"
  )
  secondaryButtons() {
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

    if (!this.selectingMessages) {
      buttons.push({
        id: "selectMessage",
        name: I18n.t("chat.select"),
        icon: "tasks",
      });
    }

    if (this.canFlagMessage) {
      buttons.push({
        id: "flag",
        name: I18n.t("chat.flag"),
        icon: "flag",
      });
    }

    if (this.showSilenceButton) {
      buttons.push({
        id: "silence",
        name: I18n.t("chat.silence"),
        icon: "microphone-slash",
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

    if (this.showRebakeButton) {
      buttons.push({
        id: "rebakeMessage",
        name: I18n.t("chat.rebake_message"),
        icon: "sync-alt",
      });
    }

    if (this.showBookmarkButton) {
      buttons.push({
        id: "toggleBookmark",
        name: this.message.bookmark
          ? I18n.t("chat.bookmark_message_edit")
          : I18n.t("chat.bookmark_message"),
        icon: this.message.bookmark?.reminder_at
          ? "discourse-bookmark-clock"
          : "bookmark",
      });
    }

    return buttons;
  },

  get messageActions() {
    return {
      reply: this.reply,
      react: this.react,
      copyLinkToMessage: this.copyLinkToMessage,
      edit: this.edit,
      selectMessage: this.selectMessage,
      flag: this.flag,
      silence: this.silence,
      deleteMessage: this.deleteMessage,
      restore: this.restore,
      rebakeMessage: this.rebakeMessage,
      toggleBookmark: this.toggleBookmark,
      startReactionForMsgActions: this.startReactionForMsgActions,
    };
  },

  get messageCapabilities() {
    return {
      canReact: this.canReact,
      canReply: this.canReply,
    };
  },

  @discourseComputed("message", "details.can_moderate")
  show(message, canModerate) {
    return (
      !message.deleted_at ||
      this.currentUser.id === this.message.user.id ||
      this.currentUser.staff ||
      canModerate
    );
  },

  @action
  handleTouchStart() {
    if (!this.isHovered) {
      // when testing this must be triggered immediately because there
      // is no concept of "long press" there, the Ember `tap` test helper
      // does send the touchstart/touchend events but immediately, see
      // https://github.com/emberjs/ember-test-helpers/blob/master/API.md#tap
      if (isTesting()) {
        this._handleLongPress();
      }

      this._isPressingHandler = later(this._handleLongPress, 500);
    }
  },

  @action
  handleTouchMove() {
    if (!this.isHovered) {
      cancel(this._isPressingHandler);
    }
  },

  @action
  handleTouchEnd() {
    cancel(this._isPressingHandler);
  },

  @action
  _handleLongPress() {
    this.onHoverMessage(this.message);
  },

  @discourseComputed("message.hideUserInfo", "message.chat_webhook_event")
  hideUserInfo(hide, webhookEvent) {
    return hide && !webhookEvent;
  },

  @discourseComputed("selectingMessages")
  messageContainerClasses(selecting) {
    return `chat-message-container ${
      selecting ? "selecting-messages" : ""
    }`.trim();
  },

  @discourseComputed(
    "message.staged",
    "message.deleted_at",
    "message.in_reply_to",
    "message.error",
    "message.bookmark",
    "isHovered"
  )
  chatMessageClasses(staged, deletedAt, inReplyTo, error, bookmark, isHovered) {
    let classNames = ["chat-message"];

    if (staged) {
      classNames.push("chat-message-staged");
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
    if (error) {
      classNames.push("errored");
    }
    if (isHovered) {
      classNames.push("chat-message-selected");
    }
    if (bookmark) {
      classNames.push("chat-message-bookmarked");
    }
    return classNames.join(" ");
  },

  @discourseComputed("message", "message.deleted_at", "chatChannel.status")
  showEditButton(message, deletedAt) {
    return (
      !deletedAt &&
      this.currentUser.id === message.user?.id &&
      this.chatChannel.canModifyMessages(this.currentUser)
    );
  },

  @discourseComputed(
    "message",
    "message.user_flag_status",
    "details.can_flag",
    "message.deleted_at"
  )
  canFlagMessage(message, userFlagStatus, canFlag, deletedAt) {
    return (
      this.currentUser?.id !== message.user?.id &&
      userFlagStatus === undefined &&
      canFlag &&
      !message.chat_webhook_event &&
      !deletedAt
    );
  },

  @discourseComputed("message")
  showSilenceButton(message) {
    return (
      this.currentUser?.staff &&
      this.currentUser?.id !== message.user?.id &&
      !message.chat_webhook_event
    );
  },

  @discourseComputed("message")
  canManageDeletion(message) {
    return this.currentUser?.id === message.user?.id
      ? this.details.can_delete_self
      : this.details.can_delete_others;
  },

  @discourseComputed("message.deleted_at", "chatChannel.status")
  canReply(deletedAt) {
    return !deletedAt && this.chatChannel.canModifyMessages(this.currentUser);
  },

  @discourseComputed("message.deleted_at", "chatChannel.status")
  canReact(deletedAt) {
    return !deletedAt && this.chatChannel.canModifyMessages(this.currentUser);
  },

  @discourseComputed(
    "canManageDeletion",
    "message.deleted_at",
    "chatChannel.status"
  )
  showDeleteButton(canManageDeletion, deletedAt) {
    return (
      canManageDeletion &&
      !deletedAt &&
      this.chatChannel.canModifyMessages(this.currentUser)
    );
  },

  @discourseComputed(
    "canManageDeletion",
    "message.deleted_at",
    "chatChannel.status"
  )
  showRestoreButton(canManageDeletion, deletedAt) {
    return (
      canManageDeletion &&
      deletedAt &&
      this.chatChannel.canModifyMessages(this.currentUser)
    );
  },

  @discourseComputed("chatChannel.status")
  showBookmarkButton() {
    return this.chatChannel.canModifyMessages(this.currentUser);
  },

  @discourseComputed("chatChannel.status")
  showRebakeButton() {
    return (
      this.currentUser?.staff &&
      this.chatChannel.canModifyMessages(this.currentUser)
    );
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
  startReactionForMsgActions() {
    if (!this.messageContainer) {
      return;
    }

    const btn = this.messageContainer.querySelector(
      ".chat-msgactions-hover .react-btn"
    );
    this._startReaction(btn, this.SHOW_LEFT);
  },

  @action
  startReactionForReactionList() {
    if (!this.messageContainer) {
      return;
    }

    const btn = this.messageContainer.querySelector(
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
        if (this.isDestroying || this.isDestroyed) {
          return;
        }

        this._repositionEmojiPicker(btn, position);
      });
    }
  },

  _repositionEmojiPicker(btn, position) {
    if (!this.messageContainer) {
      return;
    }

    const emojiPicker = this.messageContainer.querySelector(".emoji-picker");
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
    const messageContainer = document.querySelector(".chat-messages-scroll");
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
    if (!this.canInteractWithChat) {
      return;
    }

    this.set("emojiPickerIsActive", false);
    this.react(emoji, this.REMOVE_REACTION);
    this.notifyPropertyChange("emojiReactions");
  },

  @action
  selectReaction(emoji) {
    if (!this.canInteractWithChat) {
      return;
    }

    this.set("emojiPickerIsActive", false);
    this.react(emoji, this.ADD_REACTION);
    this.notifyPropertyChange("emojiReactions");
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
    if (!this.canInteractWithChat || this._loadingReactions.includes(emoji)) {
      return;
    }

    if (this.capabilities.canVibrate) {
      navigator.vibrate(5);
    }

    if (this.site.mobileView) {
      this.set("isHovered", false);
    }

    // TODO: ideally all react logic wouldn't be on message but chat channel
    // or at least chat-live-pane, this would avoid extra complexity
    let promise;
    if (this.previewing) {
      promise = this.chat.upsertDmChannelForUser(
        this.chatChannel,
        this.currentUser
      );
    } else {
      promise = Promise.resolve();
    }

    promise.then(() => {
      this._loadingReactions.push(emoji);
      this._updateReactionsList(emoji, reactAction, this.currentUser);
      this._publishReaction(emoji, reactAction);
      this.notifyPropertyChange("emojiReactions");

      if (this.previewing) {
        this.onSwitchChannel(this.chatChannel, { replace: true });
      }
    });
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
    ).catch((errResult) => {
      popupAjaxError(errResult);
      this._updateReactionsList(emoji, this.REMOVE_REACTION, this.currentUser);
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
    bootbox.confirm(
      I18n.t("chat.confirm_flag", {
        username: this.message.user?.username,
      }),
      (confirmed) => {
        if (confirmed) {
          ajax("/chat/flag", {
            method: "PUT",
            data: {
              chat_message_id: this.message.id,
            },
          }).catch(popupAjaxError);
        }
      }
    );
  },

  @action
  silence() {
    this.adminTools.showSilenceModal(EmberObject.create(this.message.user));
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
  toggleBookmark() {
    return openBookmarkModal(
      this.message.bookmark ||
        Bookmark.create({
          bookmarkable_type: "ChatMessage",
          bookmarkable_id: this.message.id,
          user_id: this.currentUser.id,
        }),
      {
        onAfterSave: (savedData) => {
          const bookmark = Bookmark.create(savedData);
          this.set("message.bookmark", bookmark);
          this.appEvents.trigger(
            "bookmarks:changed",
            savedData,
            bookmark.attachedTo()
          );
        },
        onAfterDelete: () => {
          this.set("message.bookmark", null);
        },
      },
      { use_polymorphic_bookmarks: this.siteSettings.use_polymorphic_bookmarks }
    );
  },

  @action
  rebakeMessage() {
    return ajax(
      `/chat/${this.details.chat_channel_id}/${this.message.id}/rebake`,
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
  @afterRender
  toggleChecked(e) {
    if (e.shiftKey) {
      this.bulkSelectMessages(this.message, e.target.checked);
    }

    this.onSelectMessage(this.message);
  },

  @action
  copyLinkToMessage() {
    if (!this.messageContainer) {
      return;
    }

    this.messageContainer
      .querySelector(".link-to-message-btn")
      ?.classList?.add("copied");

    const { protocol, host } = window.location;
    let url = getURL(
      `/chat/channel/${this.details.chat_channel_id}/chat?messageId=${this.message.id}`
    );
    url = url.indexOf("/") === 0 ? protocol + "//" + host + url : url;
    clipboardCopy(url);

    later(() => {
      this.messageContainer
        ?.querySelector(".link-to-message-btn")
        ?.classList?.remove("copied");
    }, 250);
  },

  @discourseComputed("emojiReactionStore.favorites.[]")
  emojiReactions(favorites) {
    // may be a {} if no defaults defined in some production builds
    if (!favorites || !favorites.slice) {
      return [];
    }

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
