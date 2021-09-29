import Component from "@ember/component";
import discourseDebounce from "discourse-common/lib/debounce";
import EmberObject, { action } from "@ember/object";
import { A } from "@ember/array";
import { applyLocalDates } from "discourse/plugins/discourse-local-dates/initializers/discourse-local-dates";
import { ajax } from "discourse/lib/ajax";
import { isTesting } from "discourse-common/config/environment";
import { observes } from "discourse-common/utils/decorators";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { cancel, later, next, schedule } from "@ember/runloop";
import { inject as service } from "@ember/service";
import { loadOneboxes } from "discourse/lib/load-oneboxes";
import { Promise } from "rsvp";
import { resetIdle } from "discourse/lib/desktop-notifications";
import { resolveAllShortUrls } from "pretty-text/upload-short-url";

const MAX_RECENT_MSGS = 100;
const STICKY_SCROLL_LENIENCE = 4;
const READ_INTERVAL = 2000;
const PAGE_SIZE = 50;

export default Component.extend({
  classNameBindings: [":tc-live-pane", "sendingloading", "loading"],
  topicId: null, // ?Number
  chatChannel: null,
  fullPage: false,
  registeredChatChannelId: null, // ?Number
  loading: false,
  loadingMore: false,
  allPastMessagesLoaded: false,
  previewing: false,
  sendingloading: false,
  stickyScroll: true,
  stickyScrollTimer: null,

  editingMessage: null, // ?Message
  replyToMsg: null, // ?Message
  details: null, // Object { chat_channel_id, can_chat, ... }
  messages: null, // Array
  messageLookup: null, // Object<Number, Message>
  _unloadedReplyIds: null, // Array
  _nextStagedMessageId: 0, // Iterate on every new message
  targetMessageId: null,

  chat: service(),
  router: service(),

  getCachedChannelDetails: null,
  clearCachedChannelDetails: null,

  _updateReadTimer: null,
  lastSendReadMessageId: null,
  _scrollerEl: null,

  didInsertElement() {
    this._super(...arguments);

    this._unloadedReplyIds = [];
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
    this._unloadedReplyIds = null;
  },

  didReceiveAttrs() {
    this._super(...arguments);

    this.set("targetMessageId", this.chat.getMessageId());
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
    if (this.loading) {
      return;
    }

    this.set("loading", true);
    const url = this.targetMessageId
      ? `/chat/lookup/${this.targetMessageId}.json`
      : `/chat/${this.chatChannel.id}/messages.json`;

    this.chat.loadCookFunction(this.site.categories).then((cook) => {
      this.set("cook", cook);
      return ajax(url, { data: { page_size: PAGE_SIZE } })
        .then((data) => {
          if (this._selfDeleted()) {
            return;
          }
          this.setMessageProps(data.topic_chat_view);
          this.decorateMessages();
          this.onScroll();
        })
        .catch((err) => {
          throw err;
        })
        .finally(() => {
          if (this._selfDeleted()) {
            return;
          }
          if (this.targetMessageId) {
            this.chat.clearMessageId();
          }
          this.set("loading", false);
        });
    });
  },

  _fetchMorePastMessages() {
    if (this.loading || this.loadingMore || this.allPastMessagesLoaded) {
      return;
    }

    this.set("loadingMore", true);
    const firstMessageId = this.messages[0].id;

    ajax(`/chat/${this.chatChannel.id}/messages`, {
      data: { before_message_id: firstMessageId, page_size: PAGE_SIZE },
    })
      .then((data) => {
        if (this._selfDeleted()) {
          return;
        }
        const newMessages = this._prepareMessages(
          data.topic_chat_view.messages || []
        );
        if (newMessages.length) {
          this.set("messages", newMessages.concat(this.messages));
          this.scrollToMessage(firstMessageId);
          this.decorateMessages();
        } else {
          this.set("allPastMessagesLoaded", true);
        }
      })
      .catch((err) => {
        throw err;
      })
      .finally(() => {
        if (this._selfDeleted()) {
          return;
        }
        this.set("loadingMore", false);
      });
  },

  setMessageProps(chatView) {
    this._unloadedReplyIds = [];
    this.setProperties({
      messages: this._prepareMessages(chatView.messages),
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

  _prepareMessages(messages) {
    const preparedMessages = A();
    let lastMessage;
    messages.forEach((currentMessage) => {
      let prepared = this._prepareSingleMessage(currentMessage, lastMessage);
      preparedMessages.push(prepared);
      lastMessage = prepared;
    });
    return preparedMessages;
  },

  _prepareSingleMessage(messageData, previousMessageData) {
    if (messageData.in_reply_to) {
      let inReplyToMessage = this.messageLookup[messageData.in_reply_to.id];
      if (inReplyToMessage) {
        // Reply to message has already been added
        messageData.in_reply_to = inReplyToMessage;
      } else {
        messageData.in_reply_to.cookedMessage = this.cook(
          messageData.in_reply_to.message
        );
        inReplyToMessage = EmberObject.create(messageData.in_reply_to);
        this._unloadedReplyIds.push(inReplyToMessage.id);
        this.messageLookup[inReplyToMessage.id] = inReplyToMessage;
      }
    } else {
      // In reply-to is false. Check if previous message was created by same
      // user and if so, no need to repeat avatar and username

      if (
        previousMessageData &&
        !previousMessageData.deleted_at &&
        Math.abs(
          new Date(messageData.created_at) -
            new Date(previousMessageData.created_at)
        ) < 300000 && // If the time between messages is over 5 minutes, break.
        messageData.user.id === previousMessageData.user.id
      ) {
        messageData.hideUserInfo = true;
      }
    }
    messageData.expanded = !messageData.deleted_at;
    messageData.cookedMessage = this.cook(messageData.message);
    messageData.messageLookupId = this._generateMessageLookupId(messageData);
    const prepared = EmberObject.create(messageData);
    this.messageLookup[messageData.messageLookupId] = prepared;
    return prepared;
  },

  _generateMessageLookupId(message) {
    return message.id || `staged-${message.stagedId}`;
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
      if (!message) {
        return this._stickScrollToBottom();
      }

      // If user has not read last message, scroll to the last message they have read,
      // and mark it as the last read so indicator will show up below.
      // If user _has_ read last message stick scroll to bottom
      if (message === this.messages[this.messages.length - 1]) {
        this._stickScrollToBottom();
      } else {
        message.set("lastRead", true);
        this.scrollToMessage(message.id);
      }
    } else {
      // This is the user's first visit to the channel. Scroll them to the bottom
      this._stickScrollToBottom();
    }
  },

  highlightOrFetchMessage(_, messageId) {
    if (this._selfDeleted()) {
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
    if (this._selfDeleted()) {
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

  _stickScrollToBottom() {
    schedule("afterRender", () => {
      if (this._selfDeleted()) {
        return;
      }
      this.set("stickyScroll", true);

      if (this._scrollerEl) {
        this._scrollerEl.scrollTop = 0;
      }
    });
  },

  onScroll() {
    if (this._selfDeleted()) {
      return;
    }
    resetIdle();

    const atTop =
      Math.abs(
        this._scrollerEl.scrollHeight -
          this._scrollerEl.clientHeight +
          this._scrollerEl.scrollTop
      ) <= STICKY_SCROLL_LENIENCE;
    if (atTop) {
      this._fetchMorePastMessages();
      return;
    }

    this._calculateStickScroll();
  },

  _calculateStickScroll() {
    const shouldStick =
      Math.abs(this._scrollerEl.scrollTop) < STICKY_SCROLL_LENIENCE;
    if (shouldStick !== this.stickyScroll) {
      if (shouldStick) {
        this._stickScrollToBottom();
      } else {
        this.set("stickyScroll", false);
      }
    }
  },

  @action
  decorateMessages() {
    schedule("afterRender", this, () => {
      loadOneboxes(
        this.element,
        ajax,
        null,
        null,
        this.siteSettings.max_oneboxes_per_post,
        false
      );
      resolveAllShortUrls(ajax, this.siteSettings, this.element);
      applyLocalDates(
        this.element.querySelectorAll(".discourse-local-date"),
        this.siteSettings
      );
    });
  },

  @observes("expanded")
  restickOnExpand() {
    if (this.expanded) {
      this._stickScrollToBottom();
    }
  },

  @observes("floatHidden")
  onFloatHiddenChange() {
    if (!this.floatHidden) {
      this.set("expanded", true);
      this._markLastReadMessage({ reRender: true });
      this._stickScrollToBottom();
    }
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
    this.decorateMessages();
  },

  handleSentMessage(data) {
    if (data.topic_chat_message.user.id === this.currentUser.id) {
      // User sent this message. Check staged messages to see if this client sent the message.
      // If so, need to update the staged message with and id.
      const stagedMessage = this.messageLookup[`staged-${data.stagedId}`];
      if (stagedMessage) {
        stagedMessage.setProperties({
          staged: false,
          id: data.topic_chat_message.id,
        });
        this.messageLookup[data.topic_chat_message.id] = stagedMessage;
        delete this.messageLookup[`staged-${data.stagedId}`];
        return;
      }
    }
    this.messages.pushObject(
      this._prepareSingleMessage(
        data.topic_chat_message,
        this.messages[this.messages.length - 1]
      )
    );

    if (this.messages.length >= MAX_RECENT_MSGS) {
      this.removeMessage(this.messages.shiftObject());
    }
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
      let newMessageIndex = this.binarySearchForMessagePosition(
        this.messages,
        message
      );
      const previousMessage =
        newMessageIndex > 0 ? this.messages[newMessageIndex - 1] : null;
      message = this._prepareSingleMessage(
        data.topic_chat_message,
        previousMessage
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

  _selfDeleted() {
    return !this.element || this.isDestroying || this.isDestroyed;
  },

  _updateLastReadMessage() {
    if (this._selfDeleted()) {
      return;
    }

    return later(
      this,
      () => {
        const messageId = this.messages[this.messages.length - 1]?.id;
        // Make sure new messages have come in. Do not keep pinging server with read updates
        // if no new messages came in since last read update was sent.
        if (
          this.expanded &&
          !this.floatHidden &&
          messageId &&
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
    resetIdle();

    if (this.sendingloading) {
      return;
    }
    this.set("sendingloading", true);
    this.set("_nextStagedMessageId", this._nextStagedMessageId + 1);
    let data = { message, stagedId: this._nextStagedMessageId };
    if (this.replyToMsg) {
      data.in_reply_to_id = this.replyToMsg.id;
    }

    // Start ajax request but don't return here, we want to stage the message instantly.
    // Return a resolved promise below.
    ajax(`/chat/${this.chatChannel.id}.json`, {
      type: "POST",
      data,
    })
      .catch(() => {
        this._onSendError(data.stagedId);
      })
      .finally(() => {
        if (this._selfDeleted()) {
          return;
        }
        this.set("sendingloading", false);
      });

    const stagedMessage = this._prepareSingleMessage(
      // We need to add the user and created at for presentation of staged message
      Object.assign({}, data, {
        staged: true,
        user: this.currentUser,
        in_reply_to: this.replyToMsg,
        created_at: new Date(),
      }),
      this.messages[this.messages.length - 1]
    );
    this.messages.pushObject(stagedMessage);
    this._resetAfterSend();
    this._stickScrollToBottom();
    return Promise.resolve();
  },

  _onSendError(stagedId) {
    const stagedMessage = this.messageLookup[`staged-${stagedId}`];
    if (stagedMessage) {
      stagedMessage.set("error", true);
      this._resetAfterSend();
      this._stickScrollToBottom();
    }
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
        if (this._selfDeleted()) {
          return;
        }
        this.set("sendingloading", false);
      });
  },

  _resetAfterSend() {
    if (this._selfDeleted()) {
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
    this._stickScrollToBottom();
  },

  @action
  replyMessageClicked(message) {
    const replyMessageFromLookup = this.messageLookup[message.id];
    if (this._unloadedReplyIds.includes(message.id)) {
      // Message is not present in the loaded messages. Fetch it!
      this.set("targetMessageId", message.id);
      this.fetchMessages();
    } else {
      this.scrollToMessage(replyMessageFromLookup.id, { highlight: true });
    }
  },

  @action
  editButtonClicked(messageId) {
    const message = this.messageLookup[messageId];
    this.set("editingMessage", message);
    next(this.reStickScrollIfNeeded.bind(this));
  },

  @action
  cancelEditing() {
    this.setProperties({
      editingMessage: null,
      value: "",
    });
  },

  @action
  reStickScrollIfNeeded() {
    if (this.stickyScroll) {
      this._stickScrollToBottom();
    }
  },

  @action
  restickScrolling(evt) {
    this.set("stickyScroll", true);
    this._stickScrollToBottom();
    evt.preventDefault();
  },

  @action
  exitChat() {
    return this.router.transitionTo(this.chat.getLastNonChatRoute());
  },
});
