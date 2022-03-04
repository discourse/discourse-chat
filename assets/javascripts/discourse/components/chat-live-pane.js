import Component from "@ember/component";
import { clipboardCopy } from "discourse/lib/utilities";
import { getOwner } from "discourse-common/lib/get-owner";
import discourseComputed, {
  afterRender,
  bind,
  observes,
} from "discourse-common/utils/decorators";
import discourseDebounce from "discourse-common/lib/debounce";
import DiscourseURL from "discourse/lib/url";
import EmberObject, { action } from "@ember/object";
import I18n from "I18n";
import loadScript from "discourse/lib/load-script";
import showModal from "discourse/lib/show-modal";
import userPresent from "discourse/lib/user-presence";
import { A } from "@ember/array";
import { ajax } from "discourse/lib/ajax";
import { isTesting } from "discourse-common/config/environment";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { cancel, later, next, schedule } from "@ember/runloop";
import { inject as service } from "@ember/service";
import { Promise } from "rsvp";
import { resetIdle } from "discourse/lib/desktop-notifications";
import { resolveAllShortUrls } from "pretty-text/upload-short-url";
import getURL, { samePrefix } from "discourse-common/lib/get-url";
import { spinnerHTML } from "discourse/helpers/loading-spinner";
import { decorateGithubOneboxBody } from "discourse/initializers/onebox-decorators";
import highlightSyntax from "discourse/lib/highlight-syntax";

const MAX_RECENT_MSGS = 100;
const STICKY_SCROLL_LENIENCE = 4;
const READ_INTERVAL = 1000;
const PAGE_SIZE = 50;

const PAST = "Past";
const FUTURE = "Future";

let _chatMessageDecorators = [];

export function addChatMessageDecorator(decorator) {
  _chatMessageDecorators.push(decorator);
}

export function resetChatMessageDecorators() {
  _chatMessageDecorators = [];
}

export default Component.extend({
  classNameBindings: [":chat-live-pane", "sendingloading", "loading"],
  topicId: null, // ?Number
  chatChannel: null,
  fullPage: false,
  registeredChatChannelId: null, // ?Number
  loading: false,
  loadingMorePast: false,
  loadingMoreFuture: false,

  allPastMessagesLoaded: false,
  previewing: false,
  sendingloading: false,
  selectingMessages: false,
  stickyScroll: true,
  stickyScrollTimer: null,
  showChatQuoteSuccess: false,

  editingMessage: null, // ?Message
  replyToMsg: null, // ?Message
  details: null, // Object { chat_channel_id,  ... }
  messages: null, // Array
  messageLookup: null, // Object<Number, Message>
  _unloadedReplyIds: null, // Array
  _nextStagedMessageId: 0, // Iterate on every new message
  _lastSelectedMessage: null,
  targetMessageId: null,

  chat: service(),
  router: service(),
  chatComposerPresenceManager: service(),

  getCachedChannelDetails: null,
  clearCachedChannelDetails: null,

  _updateReadTimer: null,
  lastSendReadMessageId: null,
  _scrollerEl: null,

  didInsertElement() {
    this._super(...arguments);

    this._unloadedReplyIds = [];
    this.appEvents.on(
      "chat-live-pane:highlight-message",
      this,
      "highlightOrFetchMessage"
    );

    this._scrollerEl = this.element.querySelector(".chat-messages-scroll");
    this._scrollerEl.addEventListener(
      "scroll",
      () => {
        this.stickyScrollTimer = discourseDebounce(this, this.onScroll, 50);
      },
      { passive: true }
    );

    this.appEvents.on("chat:cancel-message-selection", this, "cancelSelecting");
  },

  willDestroyElement() {
    this.appEvents.off(
      "chat-live-pane:highlight-message",
      this,
      "highlightOrFetchMessage"
    );
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
    this.appEvents.off(
      "chat:cancel-message-selection",
      this,
      "cancelSelecting"
    );
  },

  didReceiveAttrs() {
    this._super(...arguments);

    this.set("targetMessageId", this.chat.messageId);
    if (this.registeredChatChannelId !== this.chatChannel.id) {
      if (this.registeredChatChannelId) {
        this.messageBus.unsubscribe(`/chat/${this.registeredChatChannelId}`);
        this.messages.clear();
      }

      this.messageLookup = {};
      this.registeredChatChannelId = null;
      this.set("allPastMessagesLoaded", false);

      if (this.chatChannel?.id) {
        this.chat
          .getChannelBy("id", this.chatChannel.id)
          .then((trackedChannel) => {
            this.set("previewing", !Boolean(trackedChannel));
            this.fetchMessages(this.chatChannel.id);
            this.loadDraftForChannel(this.chatChannel.id);
            this._startLastReadRunner();
          });
      }
    }
    this.currentUserTimezone = this.currentUser?.resolvedTimezone(
      this.currentUser
    );
  },

  fetchMessages(channelId) {
    this.set("loading", true);

    return this.chat.loadCookFunction(this.site.categories).then((cook) => {
      this.set("cook", cook);
      const findArgs = {
        channelId,
        targetMessageId: this.targetMessageId,
        pageSize: PAGE_SIZE,
      };
      return this.store
        .findAll("chat-message", findArgs)
        .then((messages) => {
          if (this._selfDeleted || this.chatChannel.id !== channelId) {
            return;
          }
          this.setMessageProps(messages);
          this.decorateMessages();
        })
        .catch((err) => {
          throw err;
        })
        .finally(() => {
          if (this._selfDeleted || this.chatChannel.id !== channelId) {
            return;
          }

          this.chat.set("messageId", null);
          this.set("loading", false);

          this.focusComposer();
        });
    });
  },

  loadDraftForChannel(channelId) {
    this.set("draft", this.chat.getDraftForChannel(channelId));
  },

  _fetchMoreMessages(direction) {
    const loadingPast = direction === PAST;
    const canLoadMore = loadingPast
      ? this.details.can_load_more_past
      : this.details.can_load_more_future;
    const loadingMoreKey = `loadingMore${direction}`;
    const loadingMore = this.get(loadingMoreKey);

    if (!canLoadMore || loadingMore || this.loading || !this.messages.length) {
      return;
    }

    this.set(loadingMoreKey, true);
    this.ignoreStickyScrolling = true;

    const messageIndex = loadingPast ? 0 : this.messages.length - 1;
    const messageId = this.messages[messageIndex].id;
    const findArgs = {
      channelId: this.chatChannel.id,
      pageSize: PAGE_SIZE,
    };
    findArgs[`${loadingPast ? "before" : "after"}MessageId`] = messageId;
    const channelId = this.chatChannel.id;

    return this.store
      .findAll("chat-message", findArgs)
      .then((messages) => {
        if (this._selfDeleted || channelId !== this.chatChannel.id) {
          return;
        }

        const newMessages = this._prepareMessages(messages || []);
        if (newMessages.length) {
          this.set(
            "messages",
            loadingPast
              ? newMessages.concat(this.messages)
              : this.messages.concat(newMessages)
          );

          const scrollToMessageArgs = {
            highlight: false,
            position: loadingPast ? "top" : "bottom",
          };
          this.scrollToMessage(messageId, scrollToMessageArgs);
          this.decorateMessages();
        }
        this.setCanLoadMoreDetails(messages.resultSetMeta);
      })
      .catch((err) => {
        throw err;
      })
      .finally(() => {
        if (this._selfDeleted) {
          return;
        }
        this.set(loadingMoreKey, false);
        this.ignoreStickyScrolling = true;
      });
  },

  setCanLoadMoreDetails(meta) {
    const metaKeys = Object.keys(meta);
    if (metaKeys.includes("can_load_more_past")) {
      this.set("details.can_load_more_past", meta.can_load_more_past);
      this.set(
        "allPastMessagesLoaded",
        this.details.can_load_more_past === false
      );
    }
    if (metaKeys.includes("can_load_more_future")) {
      this.set("details.can_load_more_future", meta.can_load_more_future);
    }
  },

  setMessageProps(messages) {
    this._unloadedReplyIds = [];
    this.setProperties({
      messages: this._prepareMessages(messages),
      details: {
        chat_channel_id: this.chatChannel.id,
        chatable_type: this.chatChannel.chatable_type,
        can_delete_self: true,
        can_delete_others: this.currentUser.staff,
        can_flag: messages.resultSetMeta.can_flag,
        user_silenced: messages.resultSetMeta.user_silenced,
      },
      registeredChatChannelId: this.chatChannel.id,
    });

    schedule("afterRender", () => {
      if (this._selfDeleted) {
        return;
      }

      if (this.targetMessageId) {
        this.scrollToMessage(this.targetMessageId, {
          highlight: true,
          position: "top",
          autoExpand: true,
        });
        this.set("targetMessageId", null);
      } else {
        this._markLastReadMessage();
      }
    });

    this.setCanLoadMoreDetails(messages.resultSetMeta);
    this.messageBus.subscribe(`/chat/${this.chatChannel.id}`, (busData) => {
      this.handleMessage(busData);
    });
  },

  _prepareMessages(messages) {
    const preparedMessages = A();
    let previousMessage;
    messages.forEach((currentMessage) => {
      let prepared = this._prepareSingleMessage(
        currentMessage,
        previousMessage
      );
      preparedMessages.push(prepared);
      previousMessage = prepared;
    });
    return preparedMessages;
  },

  _areDatesOnSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  },

  _prepareSingleMessage(messageData, previousMessageData) {
    if (previousMessageData) {
      if (
        !this._areDatesOnSameDay(
          new Date(previousMessageData.created_at),
          new Date(messageData.created_at)
        )
      ) {
        messageData.firstMessageOfTheDayAt = moment(
          messageData.created_at
        ).calendar(moment(), {
          sameDay: "[Today]",
          lastDay: "[Yesterday]",
          lastWeek: "LL",
          sameElse: "LL",
        });
      }
    }
    if (messageData.in_reply_to?.id === previousMessageData?.id) {
      // Reply-to message is directly above. Remove `in_reply_to` from message.
      messageData.in_reply_to = null;
    }

    if (messageData.in_reply_to) {
      let inReplyToMessage = this.messageLookup[messageData.in_reply_to.id];
      if (inReplyToMessage) {
        // Reply to message has already been added
        messageData.in_reply_to = inReplyToMessage;
      } else {
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
    messageData.messageLookupId = this._generateMessageLookupId(messageData);
    if (this.targetMessageId && this.targetMessageId === messageData.id) {
      messageData.expanded = true;
    }
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
        if (m.newestMessage) {
          m.set("newestMessage", false);
        }
      });
    }
    const lastReadId = this.currentUser.chat_channel_tracking_state[
      this.chatChannel.id
    ]?.chat_message_id;
    if (!lastReadId) {
      return;
    }

    this.set("lastSendReadMessageId", lastReadId);
    const indexOfLastReadyMessage =
      this.messages.findIndex((m) => m.id === lastReadId) || 0;
    const newestUnreadMessage = this.messages[indexOfLastReadyMessage + 1];

    if (newestUnreadMessage) {
      newestUnreadMessage.set("newestMessage", true);
      // We have the last read message from lookup, but now we need the index of the message,
      // so that we can scroll to the message directly after it.
      return this.scrollToMessage(newestUnreadMessage.id);
    }
    this._stickScrollToBottom();
  },

  highlightOrFetchMessage(messageId) {
    if (this._selfDeleted) {
      return;
    }

    if (this.messageLookup[messageId]) {
      // We have the message rendered. highlight and scrollTo
      this.scrollToMessage(messageId, {
        highlight: true,
        position: "top",
        autoExpand: true,
      });
    } else {
      this.set("targetMessageId", messageId);
      this.fetchMessages(this.chatChannel.id);
    }
  },

  scrollToMessage(
    messageId,
    opts = { highlight: false, position: "top", autoExpand: false }
  ) {
    if (this._selfDeleted) {
      return;
    }
    const message = this.messageLookup[messageId];
    if (message?.deleted_at && opts.autoExpand) {
      message.set("expanded", true);
    }

    const messageEl = this._scrollerEl.querySelector(
      `.chat-message-container-${messageId}`
    );
    if (messageEl) {
      schedule("afterRender", () => {
        if (this._selfDeleted) {
          return;
        }

        this._scrollerEl.scrollTop =
          messageEl.offsetTop -
          (opts.position === "top"
            ? this._scrollerEl.offsetTop - 20
            : this._scrollerEl.offsetHeight);
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

  @afterRender
  _stickScrollToBottom() {
    if (this.ignoreStickyScrolling) {
      return;
    }

    this.set("stickyScroll", true);

    if (this._scrollerEl) {
      // Trigger a tiny scrollTop change so Safari scrollbar is placed at bottom.
      // Setting to just 0 doesn't work (it's at 0 by default, so there is no change)
      // Very hacky, but no way to get around this Safari bug
      this._scrollerEl.scrollTop = -1;

      window.requestAnimationFrame(() => {
        if (this._scrollerEl) {
          this._scrollerEl.scrollTop = 0;
        }
      });
    }
  },

  onScroll() {
    if (this._selfDeleted) {
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
      this._fetchMoreMessages(PAST);
      return;
    } else if (Math.abs(this._scrollerEl.scrollTop) <= STICKY_SCROLL_LENIENCE) {
      this._fetchMoreMessages(FUTURE);
    }

    this._calculateStickScroll();
  },

  _calculateStickScroll() {
    const absoluteScrollTop = Math.abs(this._scrollerEl.scrollTop);
    const shouldStick = absoluteScrollTop < STICKY_SCROLL_LENIENCE;

    this.set(
      "showScrollToBottomBtn",
      shouldStick
        ? false
        : absoluteScrollTop / this._scrollerEl.offsetHeight > 0.67
    );

    if (shouldStick !== this.stickyScroll) {
      if (shouldStick) {
        this._stickScrollToBottom();
      } else {
        this.set("stickyScroll", false);
      }
    }
  },

  @action
  @afterRender
  decorateMessages() {
    resolveAllShortUrls(ajax, this.siteSettings, this.element);
    this.forceLinksToOpenNewTab();
    lightbox(this.element.querySelectorAll("img:not(.emoji, .avatar)"));
    this._scrollGithubOneboxes();
    this._pluginsDecorators();
    this._highlightCode();
    this._renderChatTranscriptDates();

    document.querySelectorAll(".chat-message-text").forEach((chatMessageEl) => {
      _chatMessageDecorators.forEach((decorator) => {
        decorator.call(this, chatMessageEl, this.chatChannel);
      });
    });
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
      case "processed":
        this.handleProcessedMessage(data);
        break;
      case "edit":
        this.handleEditMessage(data);
        break;
      case "delete":
        this.handleDeleteMessage(data);
        break;
      case "reaction":
        this.handleReactionMessage(data);
        break;
      case "restore":
        this.handleRestoreMessage(data);
        break;
      case "mention_warning":
        this.handleMentionWarning(data);
        break;
      case "self_flagged":
        this.handleSelfFlaggedMessage(data);
        break;
      case "flag":
        this.handleFlaggedMessage(data);
        break;
    }
    this.decorateMessages();
  },

  handleSentMessage(data) {
    if (!this.previewing) {
      this.chatChannel.set("updated_at", new Date());
    }

    if (data.chat_message.user.id === this.currentUser.id) {
      // User sent this message. Check staged messages to see if this client sent the message.
      // If so, need to update the staged message with and id.
      const stagedMessage = this.messageLookup[`staged-${data.stagedId}`];
      if (stagedMessage) {
        stagedMessage.setProperties({
          staged: false,
          id: data.chat_message.id,
          excerpt: data.chat_message.excerpt,
        });

        // some markdown is cooked differently on the server-side, e.g.
        // quotes, avatar images etc.
        if (
          data.chat_message.cooked &&
          data.chat_message.cooked !== stagedMessage.cooked
        ) {
          stagedMessage.set("cooked", data.chat_message.cooked);
        }
        this.appEvents.trigger(
          `chat-message-staged-${data.stagedId}:id-populated`
        );

        this.messageLookup[data.chat_message.id] = stagedMessage;
        delete this.messageLookup[`staged-${data.stagedId}`];
        return;
      }
    }
    this.messages.pushObject(
      this._prepareSingleMessage(
        data.chat_message,
        this.messages[this.messages.length - 1]
      )
    );

    if (this.messages.length >= MAX_RECENT_MSGS) {
      this.removeMessage(this.messages.shiftObject());
    }
    this.reStickScrollIfNeeded();
  },

  handleProcessedMessage(data) {
    const message = this.messageLookup[data.chat_message.id];
    if (message) {
      message.set("cooked", data.chat_message.cooked);
      this.reStickScrollIfNeeded();
    }
  },

  handleEditMessage(data) {
    const message = this.messageLookup[data.chat_message.id];
    if (message) {
      message.setProperties({
        message: data.chat_message.message,
        cooked: data.chat_message.cooked,
        excerpt: data.chat_message.excerpt,
        uploads: data.chat_message.uploads,
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

  handleReactionMessage(data) {
    this.appEvents.trigger(
      `chat-message-${data.chat_message_id}:reaction`,
      data
    );
  },

  handleRestoreMessage(data) {
    let message = this.messageLookup[data.chat_message.id];
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
      message = this._prepareSingleMessage(data.chat_message, previousMessage);
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

  handleMentionWarning(data) {
    this.messageLookup[data.chat_message_id]?.set("mentionWarning", data);
  },

  handleSelfFlaggedMessage(data) {
    this.messageLookup[data.chat_message_id]?.set(
      "user_flag_status",
      data.user_flag_status
    );
  },

  handleFlaggedMessage(data) {
    this.messageLookup[data.chat_message_id]?.set(
      "reviewable_id",
      data.reviewable_id
    );
  },

  get _selfDeleted() {
    return !this.element || this.isDestroying || this.isDestroyed;
  },

  @bind
  _updateLastReadMessage() {
    if (this._selfDeleted) {
      return;
    }

    return later(
      this,
      () => {
        let messageId;
        if (this.messages?.length) {
          messageId = this.messages[this.messages.length - 1]?.id;
        }
        const hasUnreadMessage =
          messageId && messageId !== this.lastSendReadMessageId;

        if (
          !hasUnreadMessage &&
          this.currentUser.chat_channel_tracking_state[this.chatChannel.id]
            ?.unread_count > 0
        ) {
          // Weird state here where the chat_channel_tracking_state is wrong. Need to reset it.
          this.chat.resetTrackingStateForChannel(this.chatChannel.id);
        }

        // Make sure new messages have come in. Do not keep pinging server with read updates
        // if no new messages came in since last read update was sent.
        if (this._floatOpenAndFocused() && hasUnreadMessage) {
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

  _floatOpenAndFocused() {
    return userPresent() && this.expanded && !this.floatHidden;
  },

  _startLastReadRunner() {
    if (!isTesting()) {
      cancel(this._updateReadTimer);
      next(this, () => {
        this._updateLastReadMessage();
        this._updateReadTimer = later(
          this._updateLastReadMessage,
          READ_INTERVAL
        );
      });
    }
  },

  _stopLastReadRunner() {
    cancel(this._updateReadTimer);
  },

  @action
  sendMessage(message, uploads) {
    resetIdle();

    if (this.sendingloading) {
      return;
    }
    this.set("sendingloading", true);
    this._setDraftForChannel(null);

    this.set("_nextStagedMessageId", this._nextStagedMessageId + 1);
    const cooked = this.cook(message);
    const stagedId = this._nextStagedMessageId;
    let data = {
      message,
      cooked,
      staged_id: stagedId,
      upload_ids: (uploads || []).map((upload) => upload.id),
    };
    if (this.replyToMsg) {
      data.in_reply_to_id = this.replyToMsg.id;
    }

    // Start ajax request but don't return here, we want to stage the message instantly.
    // Return a resolved promise below.
    ajax(`/chat/${this.chatChannel.id}.json`, {
      type: "POST",
      data,
    })
      .catch((error) => {
        this._onSendError(data.staged_id, error);
      })
      .finally(() => {
        if (this._selfDeleted) {
          return;
        }
        this.set("sendingloading", false);
      });

    const stagedMessage = this._prepareSingleMessage(
      // We need to add the user and created at for presentation of staged message
      {
        message,
        cooked,
        stagedId,
        uploads,
        staged: true,
        user: this.currentUser,
        in_reply_to: this.replyToMsg,
        created_at: new Date(),
      },
      this.messages[this.messages.length - 1]
    );
    this.messages.pushObject(stagedMessage);
    this._resetAfterSend();
    this._stickScrollToBottom();
    this.appEvents.trigger("chat-composer:reply-to-set", null);
    return Promise.resolve();
  },

  @action
  joinChannel() {
    return ajax(`/chat/chat_channels/${this.chatChannel.id}/follow`, {
      method: "POST",
    }).then(() => {
      this.setProperties({
        id: null,
      });
      return this.chat.forceRefreshChannels().then(() => {
        if (this._selfDeleted) {
          return;
        }
        this.set("previewing", false);
        this.appEvents.trigger("chat:refresh-channels");
      });
    });
  },

  _onSendError(stagedId, error) {
    const stagedMessage = this.messageLookup[`staged-${stagedId}`];
    if (stagedMessage) {
      stagedMessage.set("error", error.jqXHR.responseJSON.errors[0]);
      this._resetAfterSend();
    }
  },

  @action
  editMessage(chatMessage, newContent, uploads) {
    this.set("sendingloading", true);
    let data = {
      new_message: newContent,
      upload_ids: (uploads || []).map((upload) => upload.id),
    };
    return ajax(`/chat/${this.chatChannel.id}/edit/${chatMessage.id}`, {
      type: "PUT",
      data,
    })
      .then(() => {
        this._resetHighlightForMessage(chatMessage.id);
        this._resetAfterSend();
      })
      .catch(popupAjaxError)
      .finally(() => {
        if (this._selfDeleted) {
          return;
        }
        this.set("sendingloading", false);
      });
  },

  _resetAfterSend() {
    if (this._selfDeleted) {
      return;
    }
    this.setProperties({
      replyToMsg: null,
      editingMessage: null,
    });
    this.chatComposerPresenceManager.notifyState(this.chatChannel.id, false);
  },

  @action
  editLastMessageRequested() {
    let lastUserMessage = null;
    for (
      let messageIndex = this.messages.length - 1;
      messageIndex >= 0;
      messageIndex--
    ) {
      let message = this.messages[messageIndex];
      if (message.user.id === this.currentUser.id && !message.error) {
        lastUserMessage = message;
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
      this.set("replyToMsg", this.messageLookup[messageId]);
      this.appEvents.trigger("chat-composer:reply-to-set", this.replyToMsg);
      this._focusComposer();
    } else {
      this.set("replyToMsg", null);
      this.appEvents.trigger("chat-composer:reply-to-set", null);
    }
  },

  @action
  replyMessageClicked(message) {
    const replyMessageFromLookup = this.messageLookup[message.id];
    if (this._unloadedReplyIds.includes(message.id)) {
      // Message is not present in the loaded messages. Fetch it!
      this.set("targetMessageId", message.id);
      this.fetchMessages(this.chatChannel.id);
    } else {
      this.scrollToMessage(replyMessageFromLookup.id, {
        highlight: true,
        position: "top",
        autoExpand: true,
      });
    }
  },

  @action
  editButtonClicked(messageId) {
    const message = this.messageLookup[messageId];
    this.set("editingMessage", message);
    next(this.reStickScrollIfNeeded.bind(this));
    next(this, () => {
      this._focusComposer();
    });
  },

  @discourseComputed()
  canQuote() {
    if (this.chatChannel.isDirectMessageChannel) {
      return false;
    }

    return true;
  },

  @discourseComputed()
  canMoveToTopic() {
    return this.currentUser.staff;
  },

  @discourseComputed("previewing", "details.user_silenced")
  canInteractWithChat(previewing, userSilenced) {
    return !previewing && !userSilenced;
  },

  @discourseComputed("messages.@each.selected")
  anyMessagesSelected() {
    return this.selectedMessageIds.length > 0;
  },

  @discourseComputed("messages.@each.selected")
  selectedMessageIds(messages) {
    return messages.filter((m) => m.selected).map((m) => m.id);
  },

  @action
  onStartSelectingMessages(message) {
    this._lastSelectedMessage = message;
    this.set("selectingMessages", true);
  },

  @action
  cancelSelecting() {
    this.set("selectingMessages", false);
    this.messages.setEach("selected", false);
  },

  @action
  onSelectMessage(message) {
    this._lastSelectedMessage = message;
  },

  @action
  bulkSelectMessages(message, checked) {
    const lastSelectedIndex = this._findIndexOfMessage(
      this._lastSelectedMessage
    );
    const newlySelectedIndex = this._findIndexOfMessage(message);
    const sortedIndices = [lastSelectedIndex, newlySelectedIndex].sort(
      (a, b) => a - b
    );

    for (let i = sortedIndices[0]; i <= sortedIndices[1]; i++) {
      this.messages[i].set("selected", checked);
    }
  },

  _findIndexOfMessage(message) {
    return this.messages.findIndex((m) => m.id === message.id);
  },

  _goToChatableUrl() {
    if (this.chatChannel.chatable_url) {
      return this.router.transitionTo(this.chatChannel.chatable_url);
    }
  },

  @action
  onChannelTitleClick() {
    return this._goToChatableUrl();
  },

  @action
  quoteMessages() {
    ajax(getURL(`/chat/${this.chatChannel.id}/quote.json`), {
      data: { message_ids: this.selectedMessageIds },
      type: "POST",
    })
      .then((response) => {
        const container = getOwner(this);
        const composer = container.lookup("controller:composer");
        const openOpts = {};

        if (this.chatChannel.isCategoryChannel) {
          openOpts.categoryId = this.chatChannel.chatable_id;
        }

        if (this.site.isMobileDevice) {
          // go to the relevant chatable (e.g. category) and open the
          // composer to insert text
          this._goToChatableUrl().then(() => {
            composer.focusComposer({
              fallbackToNewTopic: true,
              insertText: response.markdown,
              openOpts,
            });
          });
        } else {
          // copy to clipboard and show message
          if (this.currentUser.chat_isolated) {
            this._copyAndShowSuccess(response.markdown);
          } else {
            // open the composer and insert text, reply to the current
            // topic if there is one, use the active draft if there is one
            const topic = container.lookup("controller:topic");
            composer.focusComposer({
              fallbackToNewTopic: true,
              topic: topic?.model,
              insertText: response.markdown,
              openOpts,
            });
          }
        }
      })
      .catch(popupAjaxError);
  },

  _copyAndShowSuccess(markdown) {
    if (!isTesting()) {
      clipboardCopy(markdown);
    }

    this.set("showChatQuoteSuccess", true);

    schedule("afterRender", () => {
      if (this._selfDeleted) {
        return;
      }

      const element = document.querySelector(".chat-selection-message");
      element.addEventListener(
        "animationend",
        () => {
          this.set("showChatQuoteSuccess", false);
        },
        { once: true }
      );
    });
  },

  @action
  moveMessagesToTopic() {
    showModal("move-chat-to-topic").setProperties({
      chatMessageIds: this.selectedMessageIds,
      chatChannel: this.chatChannel,
    });
  },

  @action
  cancelEditing() {
    this.set("editingMessage", null);
  },

  @action
  _setDraftForChannel(draft) {
    if (draft?.replyToMsg) {
      draft.replyToMsg = {
        id: draft.replyToMsg.id,
        excerpt: draft.replyToMsg.excerpt,
        user: draft.replyToMsg.user,
      };
    }
    this.chat.setDraftForChannel(this.chatChannel.id, draft);
    this.set("draft", draft);
  },

  @action
  setInReplyToMsg(inReplyMsg) {
    this.set("replyToMsg", inReplyMsg);
  },

  @action
  composerValueChanged(value, uploads, replyToMsg) {
    if (!this.editingMessage) {
      this._setDraftForChannel({ value, uploads, replyToMsg });
    }
    this._reportReplyingPresence(value);
  },

  @action
  reStickScrollIfNeeded() {
    if (this.stickyScroll) {
      this._stickScrollToBottom();
    }
  },

  _reportReplyingPresence(composerValue) {
    const replying = !this.editingMessage && !!composerValue;
    this.chatComposerPresenceManager.notifyState(this.chatChannel.id, replying);
  },

  @action
  restickScrolling(evt) {
    this.set("stickyScroll", true);
    this._stickScrollToBottom();
    evt.preventDefault();
  },

  @bind
  forceLinksToOpenNewTab() {
    if (this._selfDeleted) {
      return;
    }

    const links = this.element.querySelectorAll(
      ".chat-message-text a:not([target='_blank'])"
    );
    for (let linkIndex = 0; linkIndex < links.length; linkIndex++) {
      const link = links[linkIndex];
      if (
        this.currentUser.chat_isolated ||
        !DiscourseURL.isInternal(link.href) ||
        !samePrefix(link.href)
      ) {
        link.setAttribute("target", "_blank");
      }
    }
  },

  focusComposer() {
    if (this._selfDeleted || this.site.mobileView) {
      return;
    }

    next(() => {
      document.querySelector(".chat-composer-input")?.focus();
    });
  },

  _pluginsDecorators() {
    if (this.siteSettings.discourse_local_dates_enabled) {
      const applyLocalDates = requirejs(
        "discourse/plugins/discourse-local-dates/initializers/discourse-local-dates"
      ).applyLocalDates;

      applyLocalDates(
        this.element.querySelectorAll(".discourse-local-date"),
        this.siteSettings
      );
    }

    if (this.siteSettings.spoiler_enabled) {
      const applySpoiler = requirejs(
        "discourse/plugins/discourse-spoiler-alert/lib/apply-spoiler"
      ).default;
      this.element.querySelectorAll(".spoiler").forEach((spoiler) => {
        spoiler.classList.remove("spoiler");
        spoiler.classList.add("spoiled");
        applySpoiler(spoiler);
      });
    }

    this.element.querySelectorAll(".lazyYT").forEach((iframe) => {
      $(iframe).lazyYT();
    });

    decorateGithubOneboxBody(this.element);
  },

  _getScrollParent(node, maxParentSelector) {
    if (node === null || node.classList.contains(maxParentSelector)) {
      return null;
    }

    if (node.scrollHeight > node.clientHeight) {
      return node;
    } else {
      return this._getScrollParent(node.parentNode, maxParentSelector);
    }
  },

  _scrollGithubOneboxes() {
    this.element
      .querySelectorAll(".onebox.githubblob li.selected")
      .forEach((line) => {
        const scrollingElement = this._getScrollParent(line, "onebox");

        // most likely a very small file which doesn’t need scrolling
        if (!scrollingElement) {
          return;
        }

        const scrollBarWidth =
          scrollingElement.offsetHeight - scrollingElement.clientHeight;

        scrollingElement.scroll({
          top:
            line.offsetTop +
            scrollBarWidth -
            scrollingElement.offsetHeight / 2 +
            line.offsetHeight / 2,
        });
      });
  },

  _resetHighlightForMessage(chatMessageId) {
    document
      .querySelector(
        `.chat-message-container-${chatMessageId} .chat-message-text`
      )
      ?.classList.remove("hljs-complete");
  },

  _highlightCode() {
    document.querySelectorAll(".chat-message-text").forEach((chatMessageEl) => {
      // no need to do this for every single message every time a message changes
      if (!chatMessageEl.classList.contains("hljs-complete")) {
        highlightSyntax(chatMessageEl, this.siteSettings, this.session);
        chatMessageEl.classList.add("hljs-complete");
      }
    });
  },

  _renderChatTranscriptDates() {
    document
      .querySelectorAll(".discourse-chat-transcript")
      .forEach((transcriptEl) => {
        const dateTimeRaw = transcriptEl.dataset["datetime"];
        const dateTimeLinkEl = transcriptEl.querySelector(
          ".chat-transcript-datetime a"
        );

        // same as highlight, no need to do this for every single message every time
        // any message changes
        if (dateTimeLinkEl.innerText !== "") {
          return;
        }

        if (this.currentUserTimezone) {
          dateTimeLinkEl.innerText = moment
            .tz(dateTimeRaw, this.currentUserTimezone)
            .format(I18n.t("dates.long_no_year"));
        } else {
          dateTimeLinkEl.innerText = moment(dateTimeRaw).format(
            I18n.t("dates.long_no_year")
          );
        }
      });
  },

  @afterRender
  _focusComposer() {
    this.appEvents.trigger("chat:focus-composer");
  },
});

function lightbox(images) {
  loadScript("/javascripts/jquery.magnific-popup.min.js").then(function () {
    $(images).magnificPopup({
      type: "image",
      closeOnContentClick: false,
      mainClass: "mfp-zoom-in",
      tClose: I18n.t("lightbox.close"),
      tLoading: spinnerHTML,
      image: {
        verticalFit: true,
      },
      callbacks: {
        elementParse: (item) => {
          item.src = item.el[0].src;
        },
      },
    });
  });
}
