import { A } from "@ember/array";
import { isTesting } from "discourse-common/config/environment";
import EmberObject, { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import Component from "@ember/component";
import { observes } from "discourse-common/utils/decorators";
import discourseDebounce from "discourse-common/lib/debounce";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { cancel, later, next, schedule } from "@ember/runloop";
import { inject as service } from "@ember/service";

const MAX_RECENT_MSGS = 100;
const STICKY_SCROLL_LENIENCE = 4;
const READ_INTERVAL = 2000;
const PAGE_SIZE = 30; // Same constant in chat_controller.rb. Update both together!

export default Component.extend({
  classNameBindings: [":tc-live-pane", "sendingloading", "loading"],
  topicId: null, // ?Number
  chatChannel: null,
  registeredChatChannelId: null, // ?Number
  loading: false,
  loadingMore: false,
  allPastMessagesLoaded: false,
  sendingloading: false,
  stickyScroll: true,
  stickyScrollTimer: null,

  editingMessage: null, // ?Message
  replyToMsg: null, // ?Message
  details: null, // Object { chat_channel_id, can_chat, ... }
  messages: null, // Array
  messageLookup: null, // Object<Number, Message>
  targetMessageId: null,

  chatService: service("chat"),

  getCachedChannelDetails: null,
  clearCachedChannelDetails: null,

  _updateReadTimer: null,
  lastSendReadMessageId: null,
  _scrollerEl: null,

  didInsertElement() {
    this._super(...arguments);

    this.appEvents.on("chat:open-message", this, "highlightOrFetchMessage");
    if (!isTesting()) {
      next(this, () => {
        this._updateReadTimer = this._updateLastReadMessage();
      });
    }

    this._scrollerEl = this.element.querySelector(".tc-messages-scroll");
    this._scrollerEl.addEventListener(
      "scroll",
      () => {
        this.stickyScrollTimer = discourseDebounce(this, this.onScroll, 50);
      },
      { passive: true }
    );
  },

  willDestroyElement() {
    this.appEvents.off("chat:open-message", this, "highlightOrFetchMessage");
    this._stopLastReadRunner();

    // don't need to removeEventListener from scroller as the DOM element goes away
    if (this.stickyScrollTimer) {
      cancel(this.stickyScrollTimer);
      this.stickyScrollTimer = null;
    }
    if (this.registeredChatChannelId) {
      this.messageBus.unsubscribe(`/chat/${this.registeredChatChannelId}`);
      this.registeredChatChannelId = null;
    }
  },

  didReceiveAttrs() {
    this._super(...arguments);

    this.set("targetMessageId", this.chatService.getMessageId());
    if (this.registeredChatChannelId !== this.chatChannel.id) {
      if (this.registeredChatChannelId) {
        this.messageBus.unsubscribe(`/chat/${this.registeredChatChannelId}`);
        this.messages.clear();
      }
      this.messageLookup = {};
      this.registeredChatChannelId = null;

      if (this.chatChannel.id != null) {
        this.fetchMessages();
      }
    }
  },

  fetchMessages() {
    this.set("loading", true);
    const url = this.targetMessageId
      ? `/chat/lookup/${this.targetMessageId}.json`
      : `/chat/${this.chatChannel.id}/messages.json`;

    ajax(url, { data: { page_size: PAGE_SIZE } })
      .then((data) => {
        if (this.selfDeleted()) {
          return;
        }
        this.setMessageProps(data.topic_chat_view);
      })
      .catch((err) => {
        throw err;
      })
      .finally(() => {
        if (this.selfDeleted()) {
          return;
        }
        if (this.targetMessageId) {
          this.chatService.clearMessageId();
        }
        this.set("loading", false);
      });
  },

  _fetchMorePastMessages() {
    if (this.loadingMore || this.allPastMessagesLoaded) {
      return;
    }

    this.set("loadingMore", true);
    const firstMessageId = this.messages[0].id;

    ajax(`/chat/${this.chatChannel.id}/messages`, {
      data: { before_message_id: firstMessageId, page_size: PAGE_SIZE },
    })
      .then((data) => {
        if (this.selfDeleted()) {
          return;
        }
        const newMessages = (data.topic_chat_view.messages || []).map((m) =>
          this._prepareMessage(m)
        );
        if (newMessages.length) {
          this.set("messages", newMessages.concat(this.messages));
          this.scrollToMessage(firstMessageId);
        } else {
          this.set("allPastMessagesLoaded", true);
        }
      })
      .catch((err) => {
        throw err;
      })
      .finally(() => {
        if (this.selfDeleted()) {
          return;
        }
        this.set("loadingMore", false);
      });
  },

  setMessageProps(chatView) {
    this.setProperties({
      messages: A(chatView.messages.map((m) => this._prepareMessage(m))),
      details: {
        chat_channel_id: this.chatChannel.id,
        can_chat: chatView.can_chat,
        can_flag: chatView.can_flag,
        can_delete_self: chatView.can_delete_self,
        can_delete_others: chatView.can_delete_others,
      },
      registeredChatChannelId: this.chatChannel.id,
    });

    if (!this.targetMessageId && this.messages.length < PAGE_SIZE) {
      this.set("allPastMessagesLoaded", true);
    }

    schedule("afterRender", this, () => {
      if (this.targetMessageId) {
        this.scrollToMessage(this.targetMessageId, { highlight: true });
      } else {
        this._markLastReadMessage();
      }
    });
    this.messageBus.subscribe(`/chat/${this.chatChannel.id}`, (busData) => {
      this.handleMessage(busData);
    });
  },

  _markLastReadMessage(opts = { reRender: false }) {
    if (opts.reRender) {
      this.messages.forEach((m) => {
        if (m.lastRead) {
          m.set("lastRead", false);
        }
      });
    }
    const lastReadId = this.currentUser.chat_channel_tracking_state[
      this.chatChannel.id
    ]?.chat_message_id;
    if (lastReadId) {
      this.set("lastSendReadMessageId", lastReadId);
      let message = this.messageLookup[lastReadId] || this.messages[0];

      // If user has read the last message, don't add anything.
      if (message !== this.messages[this.messages.length - 1]) {
        message.set("lastRead", true);
      }
      this.scrollToMessage(message.id);
    }
  },

  highlightOrFetchMessage(_, messageId) {
    if (this.selfDeleted()) {
      return;
    }

    if (this.messageLookup[messageId]) {
      // We have the message rendered. highlight and scrollTo
      this.scrollToMessage(messageId, { highlight: true });
    } else {
      this.set("targetMessageId", messageId);
      this.fetchMessages();
    }
  },

  scrollToMessage(messageId, opts = { highlight: false }) {
    if (this.selfDeleted()) {
      return;
    }

    const messageEl = this._scrollerEl.querySelector(
      `.tc-message-${messageId}`
    );
    if (messageEl) {
      next(() => {
        messageEl.scrollIntoView();
      });
      if (opts.highlight) {
        messageEl.classList.add("highlighted");
        // Remove highlighted class, but keep `transition-slow` on for another 2 seconds
        // to ensure the background color fades smoothly out
        if (opts.highlight) {
          later(() => {
            messageEl.classList.add("transition-slow");
          }, 2000);
          later(() => {
            messageEl.classList.remove("highlighted");
            later(() => {
              messageEl.classList.remove("transition-slow");
            }, 2000);
          }, 3000);
        }
      }
    }
  },

  stickScrollToBottom() {
    if (this.selfDeleted()) {
      return;
    }
    if (this.stickyScroll) {
      this._scrollerEl.scrollTop =
        this._scrollerEl.scrollHeight - this._scrollerEl.clientHeight;
    }
  },

  onScroll() {
    if (this.selfDeleted()) {
      return;
    }
    if (!this.expanded) {
      // Force to bottom when collapsed
      this.set("stickyScroll", true);
      return;
    }

    if (this._scrollerEl.scrollTop === 0) {
      this._fetchMorePastMessages();
      return;
    }

    // Stick to bottom if scroll is at the bottom
    const current =
      this._scrollerEl.scrollHeight -
        this._scrollerEl.scrollTop -
        this._scrollerEl.clientHeight <=
      STICKY_SCROLL_LENIENCE;
    if (current !== this.stickyScroll) {
      this.set("stickyScroll", current);
      if (current) {
        this._scrollerEl.scrollTop =
          this._scrollerEl.scrollHeight - this._scrollerEl.clientHeight;
      }
    }
  },

  @observes("expanded")
  restickOnExpand() {
    if (this.expanded) {
      schedule("afterRender", this, this.stickScrollToBottom);
    }
  },

  @observes("floatHidden")
  onFloatHiddenChange() {
    if (!this.floatHidden) {
      this.set("expanded", true);
      schedule("afterRender", this, () => {
        this._markLastReadMessage({ reRender: true });
        this.stickScrollToBottom();
      });
    }
  },

  _prepareMessage(msgData) {
    if (msgData.in_reply_to_id) {
      msgData.in_reply_to = this.messageLookup[msgData.in_reply_to_id];
    }
    msgData.expanded = !msgData.deleted_at;
    msgData.cookedMessage = this.cook(msgData.message);
    const prepared = EmberObject.create(msgData);
    this.messageLookup[msgData.id] = prepared;
    return prepared;
  },

  removeMessage(msgData) {
    delete this.messageLookup[msgData.id];
  },

  handleMessage(data) {
    switch (data.typ) {
      case "sent":
        this.handleSentMessage(data);
        break;
      case "edit":
        this.handleEditMessage(data);
        break;
      case "delete":
        this.handleDeleteMessage(data);
        break;
      case "restore":
        this.handleRestoreMessage(data);
        break;
    }
  },

  handleSentMessage(data) {
    const newMessage = this._prepareMessage(data.topic_chat_message);
    this.messages.pushObject(newMessage);

    if (this.messages.length >= MAX_RECENT_MSGS) {
      this.removeMessage(this.messages.shiftObject());
    }
    schedule("afterRender", this, this.stickScrollToBottom);
  },

  handleEditMessage(data) {
    const message = this.messageLookup[data.topic_chat_message.id];
    if (message) {
      message.setProperties({
        message: data.topic_chat_message.message,
        cookedMessage: this.cook(data.topic_chat_message.message),
        edited: true,
      });
    }
  },

  handleDeleteMessage(data) {
    const deletedId = data.deleted_id;
    const targetMsg = this.messageLookup[deletedId];
    if (this.currentUser.staff || this.currentUser.id === targetMsg.user.id) {
      targetMsg.setProperties({
        deleted_at: data.deleted_at,
        expanded: false,
      });
    } else {
      this.messages.removeObject(targetMsg);
      this.messageLookup[deletedId] = null;
    }
  },

  handleRestoreMessage(data) {
    let message = this.messageLookup[data.topic_chat_message.id];
    if (message) {
      message.set("deleted_at", null);
    } else {
      // The message isn't present in the list for this user. Find the index
      // where we should push the message to. Binary search is O(log(n))
      message = this._prepareMessage(data.topic_chat_message);
      let newMessageIndex = this.binarySearchForMessagePosition(
        this.messages,
        message
      );
      if (newMessageIndex === 0) {
        return;
      } // Restored post is too old to show

      this.messages.splice(newMessageIndex, 0, message);
      this.notifyPropertyChange("messages");
    }
  },

  binarySearchForMessagePosition(messages, newMessage) {
    const newMessageCreatedAt = Date.parse(newMessage.created_at);
    if (newMessageCreatedAt < Date.parse(messages[0].created_at)) {
      return 0;
    }
    if (
      newMessageCreatedAt > Date.parse(messages[messages.length - 1].created_at)
    ) {
      return messages.length;
    }
    let m = 0;
    let n = messages.length - 1;
    while (m <= n) {
      let k = Math.floor((n + m) / 2);
      let comparison = this.compareCreatedAt(newMessageCreatedAt, messages[k]);
      if (comparison > 0) {
        m = k + 1;
      } else if (comparison < 0) {
        n = k - 1;
      } else {
        return k;
      }
    }
    return m;
  },

  compareCreatedAt(newMessageCreatedAt, comparatorMessage) {
    const compareDate = Date.parse(comparatorMessage.created_at);
    if (newMessageCreatedAt > compareDate) {
      return 1;
    } else if (newMessageCreatedAt < compareDate) {
      return -1;
    }
    return 0;
  },

  selfDeleted() {
    return !this.element || this.isDestroying || this.isDestroyed;
  },

  _updateLastReadMessage() {
    if (this.selfDeleted()) {
      return;
    }

    return later(
      this,
      () => {
        const messageId = this.messages[this.messages.length - 1].id;
        // Make sure new messages have come in. Do not keep pinging server with read updates
        // if no new messages came in since last read update was sent.
        if (
          this.expanded &&
          !this.floatHidden &&
          messageId !== this.lastSendReadMessageId
        ) {
          this.set("lastSendReadMessageId", messageId);
          ajax(`/chat/${this.chatChannel.id}/read/${messageId}.json`, {
            method: "PUT",
          }).catch(() => {
            this._stopLastReadRunner();
          });
        }

        this._updateReadTimer = this._updateLastReadMessage();
      },
      READ_INTERVAL
    );
  },

  _stopLastReadRunner() {
    cancel(this._updateReadTimer);
  },

  @action
  sendMessage(message) {
    this.set("sendingloading", true);
    let data = { message };
    if (this.replyToMsg) {
      data.in_reply_to_id = this.replyToMsg.id;
    }
    return ajax(`/chat/${this.chatChannel.id}/`, {
      type: "POST",
      data,
    })
      .then(() => this._resetAfterSend())
      .catch(popupAjaxError)
      .finally(() => {
        if (!this.element || this.isDestroying || this.isDestroyed) {
          return;
        }
        this.set("sendingloading", false);
      });
  },

  @action
  editMessage(chatMessage, newContent) {
    this.set("sendingloading", true);
    let data = { new_message: newContent };
    return ajax(`/chat/${this.chatChannel.id}/edit/${chatMessage.id}`, {
      type: "PUT",
      data,
    })
      .then(() => this._resetAfterSend())
      .catch(popupAjaxError)
      .finally(() => {
        if (!this.element || this.isDestroying || this.isDestroyed) {
          return;
        }
        this.set("sendingloading", false);
      });
  },

  _resetAfterSend() {
    if (!this.element || this.isDestroying || this.isDestroyed) {
      return;
    }
    this.setProperties({
      replyToMsg: null,
      editingMessage: null,
    });
  },

  @action
  editLastMessageRequested() {
    let lastUserMessage = null;
    for (
      let messageIndex = this.messages.length - 1;
      messageIndex >= 0;
      messageIndex--
    ) {
      if (this.messages[messageIndex].user.id === this.currentUser.id) {
        lastUserMessage = this.messages[messageIndex];
        break;
      }
    }
    if (lastUserMessage) {
      this.set("editingMessage", lastUserMessage);
    }
  },

  @action
  setReplyTo(messageId) {
    if (messageId) {
      this.set("editingMessage", null);
      this.setProperties({
        replyToMsg: this.messageLookup[messageId],
      });
    } else {
      this.set("replyToMsg", null);
    }
    schedule("afterRender", this, this.stickScrollToBottom);
  },

  @action
  editButtonClicked(messageId) {
    const message = this.messageLookup[messageId];
    this.set("editingMessage", message);
    schedule("afterRender", this, this.stickScrollToBottom);
  },

  @action
  cancelEditing() {
    this.set("editingMessage", null);
  },

  @action
  restickScrolling(evt) {
    this.set("stickyScroll", true);
    this.stickScrollToBottom();
    evt.preventDefault();
  },
});
