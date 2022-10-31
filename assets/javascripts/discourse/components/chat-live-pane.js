import isElementInViewport from "discourse/lib/is-element-in-viewport";
import ChatApi from "discourse/plugins/discourse-chat/discourse/lib/chat-api";
import { cloneJSON } from "discourse-common/lib/object";
import ChatChannel from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import ChatMessage from "discourse/plugins/discourse-chat/discourse/models/chat-message";
import Component from "@ember/component";
import discourseComputed, {
  afterRender,
  bind,
  observes,
} from "discourse-common/utils/decorators";
import discourseDebounce from "discourse-common/lib/debounce";
import EmberObject, { action } from "@ember/object";
import I18n from "I18n";
import { A } from "@ember/array";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { cancel, next, schedule, throttle } from "@ember/runloop";
import discourseLater from "discourse-common/lib/later";
import { inject as service } from "@ember/service";
import { Promise } from "rsvp";
import { resetIdle } from "discourse/lib/desktop-notifications";
import { defaultHomepage } from "discourse/lib/utilities";
import { capitalize } from "@ember/string";
import {
  onPresenceChange,
  removeOnPresenceChange,
} from "discourse/lib/user-presence";
import isZoomed from "discourse/plugins/discourse-chat/discourse/lib/zoom-check";
import { isTesting } from "discourse-common/config/environment";

const MAX_RECENT_MSGS = 100;
const STICKY_SCROLL_LENIENCE = 50;
const PAGE_SIZE = 50;

const SCROLL_HANDLER_THROTTLE_MS = isTesting() ? 0 : 100;
const FETCH_MORE_MESSAGES_THROTTLE_MS = isTesting() ? 0 : 500;

const PAST = "past";
const FUTURE = "future";

export default Component.extend({
  classNameBindings: [":chat-live-pane", "sendingLoading", "loading"],
  chatChannel: null,
  fullPage: false,
  registeredChatChannelId: null, // ?Number
  loading: false,
  loadingMorePast: false,
  loadingMoreFuture: false,
  hoveredMessageId: null,
  onSwitchChannel: null,

  allPastMessagesLoaded: false,
  sendingLoading: false,
  selectingMessages: false,
  stickyScroll: true,
  stickyScrollTimer: null,
  showChatQuoteSuccess: false,
  showCloseFullScreenBtn: false,
  includeHeader: true,

  editingMessage: null, // ?Message
  replyToMsg: null, // ?Message
  details: null, // Object { chat_channel_id,  ... }
  messages: null, // Array
  messageLookup: null, // Object<Number, Message>
  _unloadedReplyIds: null, // Array
  _nextStagedMessageId: 0, // Iterate on every new message
  _lastSelectedMessage: null,
  targetMessageId: null,
  hasNewMessages: null,

  chat: service(),
  router: service(),
  chatEmojiPickerManager: service(),
  chatComposerPresenceManager: service(),
  fullPageChat: service(),

  getCachedChannelDetails: null,
  clearCachedChannelDetails: null,
  _scrollerEl: null,

  init() {
    this._super(...arguments);

    this.set("messages", []);
  },

  didInsertElement() {
    this._super(...arguments);

    this._unloadedReplyIds = [];
    this.appEvents.on(
      "chat-live-pane:highlight-message",
      this,
      "highlightOrFetchMessage"
    );

    this._scrollerEl = this.element.querySelector(".chat-messages-scroll");
    this._scrollerEl.addEventListener("scroll", this.onScrollHandler, {
      passive: true,
    });
    window.addEventListener("resize", this.onResizeHandler);
    window.addEventListener("mousewheel", this.onScrollHandler, {
      passive: true,
    });

    this.appEvents.on("chat:cancel-message-selection", this, "cancelSelecting");

    this.set("showCloseFullScreenBtn", !this.site.mobileView);

    document.addEventListener("scroll", this._forceBodyScroll, {
      passive: true,
    });

    onPresenceChange({
      callback: this.onPresenceChangeCallback,
    });
  },

  willDestroyElement() {
    this._super(...arguments);

    this.element
      .querySelector(".chat-messages-scroll")
      ?.removeEventListener("scroll", this.onScrollHandler);

    window.removeEventListener("resize", this.onResizeHandler);
    window.removeEventListener("mousewheel", this.onScrollHandler);

    this.appEvents.off(
      "chat-live-pane:highlight-message",
      this,
      "highlightOrFetchMessage"
    );

    // don't need to removeEventListener from scroller as the DOM element goes away
    cancel(this.stickyScrollTimer);

    cancel(this.resizeHandler);

    this._resetChannelState();
    this._unloadedReplyIds = null;
    this.appEvents.off(
      "chat:cancel-message-selection",
      this,
      "cancelSelecting"
    );

    document.removeEventListener("scroll", this._forceBodyScroll);

    removeOnPresenceChange(this.onPresenceChangeCallback);
  },

  didReceiveAttrs() {
    this._super(...arguments);

    this.currentUserTimezone = this.currentUser?.resolvedTimezone(
      this.currentUser
    );

    this.set("targetMessageId", this.chat.messageId);

    if (
      this.chatChannel?.id &&
      this.registeredChatChannelId !== this.chatChannel.id
    ) {
      this._resetChannelState();
      this.cancelEditing();

      if (!this.chatChannel.isDraft) {
        this.loadDraftForChannel(this.chatChannel.id);
      }
    }

    if (this.chatChannel?.id) {
      this.fetchMessages(this.chatChannel);
    }
  },

  @discourseComputed("chatChannel.isDirectMessageChannel")
  displayMembers(isDirectMessageChannel) {
    return !isDirectMessageChannel;
  },

  @discourseComputed("displayMembers")
  infoTabRoute(displayMembers) {
    if (displayMembers) {
      return "chat.channel.info.members";
    }

    return "chat.channel.info.settings";
  },

  @bind
  onScrollHandler(event) {
    throttle(this, this.onScroll, event, SCROLL_HANDLER_THROTTLE_MS, true);
  },

  @bind
  onResizeHandler() {
    cancel(this.resizeHandler);
    this.resizeHandler = discourseDebounce(
      this,
      this.fillPaneAttempt,
      this.details,
      250
    );
  },

  @bind
  onPresenceChangeCallback(present) {
    if (present) {
      this.chat.updateLastReadMessage();
    }
  },

  fetchMessages(channel, options = {}) {
    this.set("loading", true);

    return this.chat.loadCookFunction(this.site.categories).then((cook) => {
      if (this._selfDeleted) {
        return;
      }

      this.set("cook", cook);

      const findArgs = {
        channelId: channel.id,
        pageSize: PAGE_SIZE,
      };
      const fetchingFromLastRead = !options.fetchFromLastMessage;

      if (fetchingFromLastRead) {
        findArgs["targetMessageId"] =
          this.targetMessageId || this._getLastReadId();
      }

      return this.store
        .findAll("chat-message", findArgs)
        .then((messages) => {
          if (this._selfDeleted || this.chatChannel.id !== channel.id) {
            return;
          }
          this.setMessageProps(messages, fetchingFromLastRead);
        })
        .catch(this._handleErrors)
        .finally(() => {
          if (this._selfDeleted || this.chatChannel.id !== channel.id) {
            return;
          }

          this.chat.set("messageId", null);
          this.set("loading", false);

          if (this.targetMessageId) {
            this.highlightOrFetchMessage(this.targetMessageId);
          }

          this.focusComposer();
        });
    });
  },

  loadDraftForChannel(channelId) {
    this.set("draft", this.chat.getDraftForChannel(channelId));
  },

  @bind
  _fetchMoreMessages(direction) {
    const loadingPast = direction === PAST;
    const canLoadMore = loadingPast
      ? this.details?.can_load_more_past
      : this.details?.can_load_more_future;
    const loadingMoreKey = `loadingMore${capitalize(direction)}`;
    const loadingMore = this.get(loadingMoreKey);

    if (
      (this.details && !canLoadMore) ||
      loadingMore ||
      this.loading ||
      !this.messages.length
    ) {
      return Promise.resolve();
    }

    this.set(loadingMoreKey, true);
    this.ignoreStickyScrolling = true;

    const messageIndex = loadingPast ? 0 : this.messages.length - 1;
    const messageId = this.messages[messageIndex].id;
    const findArgs = {
      channelId: this.chatChannel.id,
      pageSize: PAGE_SIZE,
      direction,
      messageId,
    };
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
        }
        this.setCanLoadMoreDetails(messages.resultSetMeta);

        if (!loadingPast && newMessages.length) {
          // Adding newer messages also causes a scroll-down,
          // firing another event, fetching messages again, and so on.
          // Scroll to the first new one to prevent this.
          this.scrollToMessage(newMessages.firstObject.messageLookupId);
        }

        return messages;
      })
      .catch(this._handleErrors)
      .finally(() => {
        if (this._selfDeleted) {
          return;
        }
        this.set(loadingMoreKey, false);
        this.ignoreStickyScrolling = false;
      });
  },

  fillPaneAttempt(meta) {
    if (this._selfDeleted) {
      return;
    }

    // safeguard
    if (this.messages.length > 200) {
      return;
    }

    if (!meta?.can_load_more_past) {
      return;
    }

    schedule("afterRender", () => {
      const firstMessageId = this.messages.firstObject?.id;
      if (!firstMessageId) {
        return;
      }

      const scroller = document.querySelector(".chat-messages-container");
      const messageContainer = document.querySelector(
        `.chat-message-container[data-id="${firstMessageId}"]`
      );
      if (
        !scroller ||
        !messageContainer ||
        !isElementInViewport(messageContainer)
      ) {
        return;
      }

      this._fetchMoreMessagesThrottled(PAST);
    });
  },

  _fetchMoreMessagesThrottled(direction) {
    throttle(
      this,
      "_fetchMoreMessages",
      direction,
      FETCH_MORE_MESSAGES_THROTTLE_MS
    );
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

  setMessageProps(messages, fetchingFromLastRead) {
    this._unloadedReplyIds = [];
    this.setProperties({
      messages: this._prepareMessages(messages),
      details: {
        chat_channel_id: this.chatChannel.id,
        chatable_type: this.chatChannel.chatable_type,
        can_delete_self: messages.resultSetMeta.can_delete_self,
        can_delete_others: messages.resultSetMeta.can_delete_others,
        can_flag: messages.resultSetMeta.can_flag,
        user_silenced: messages.resultSetMeta.user_silenced,
        can_moderate: messages.resultSetMeta.can_moderate,
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
      } else if (fetchingFromLastRead) {
        this._markLastReadMessage();
      }

      this.fillPaneAttempt(messages.resultSetMeta);
    });

    this.setCanLoadMoreDetails(messages.resultSetMeta);
    this._subscribeToUpdates(this.chatChannel.id);
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
          sameDay: `[${I18n.t("chat.chat_message_separator.today")}]`,
          lastDay: `[${I18n.t("chat.chat_message_separator.yesterday")}]`,
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
    this._handleMessageHidingAndExpansion(messageData);
    messageData.messageLookupId = this._generateMessageLookupId(messageData);
    const prepared = ChatMessage.create(messageData);
    this.messageLookup[messageData.messageLookupId] = prepared;
    return prepared;
  },

  _handleMessageHidingAndExpansion(messageData) {
    if (this.currentUser.ignored_users) {
      messageData.hidden = this.currentUser.ignored_users.includes(
        messageData.user.username
      );
    }

    // If a message has been hidden it is because the current user is ignoring
    // the user who sent it, so we want to unconditionally hide it, even if
    // we are going directly to the target
    if (this.targetMessageId && this.targetMessageId === messageData.id) {
      messageData.expanded = !messageData.hidden;
    } else {
      messageData.expanded = !(messageData.hidden || messageData.deleted_at);
    }
  },

  _generateMessageLookupId(message) {
    return message.id || `staged-${message.stagedId}`;
  },

  _getLastReadId() {
    return this.currentUser?.chat_channel_tracking_state?.[this.chatChannel.id]
      ?.chat_message_id;
  },

  _markLastReadMessage(opts = { reRender: false }) {
    if (opts.reRender) {
      this.messages.forEach((m) => {
        if (m.newestMessage) {
          m.set("newestMessage", false);
        }
      });
    }
    const lastReadId = this._getLastReadId();
    if (!lastReadId) {
      return;
    }

    this.set("lastSendReadMessageId", lastReadId);
    const indexOfLastReadMessage =
      this.messages.findIndex((m) => m.id === lastReadId) || 0;
    let newestUnreadMessage = this.messages[indexOfLastReadMessage + 1];

    if (newestUnreadMessage) {
      newestUnreadMessage.set("newestMessage", true);

      next(() => this.scrollToMessage(newestUnreadMessage.id));

      return;
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
      this.fetchMessages(this.chatChannel);
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

    schedule("afterRender", () => {
      const messageEl = this._scrollerEl.querySelector(
        `.chat-message-container[data-id='${messageId}']`
      );

      if (!messageEl || this._selfDeleted) {
        return;
      }

      this._wrapIOSFix(() => {
        messageEl.scrollIntoView({
          block: opts.position === "top" ? "start" : "end",
        });
      });

      if (opts.highlight) {
        messageEl.classList.add("highlighted");

        // Remove highlighted class, but keep `transition-slow` on for another 2 seconds
        // to ensure the background color fades smoothly out
        if (opts.highlight) {
          discourseLater(() => {
            messageEl.classList.add("transition-slow");
          }, 2000);

          discourseLater(() => {
            messageEl.classList.remove("highlighted");

            discourseLater(() => {
              messageEl.classList.remove("transition-slow");
            }, 2000);
          }, 3000);
        }
      }
    });
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

      this._wrapIOSFix(() => {
        this._scrollerEl.scrollTop = 0;
        this.set("showScrollToBottomBtn", false);
      });
    }
  },

  onScroll(event) {
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
      this._fetchMoreMessagesThrottled(PAST);
    } else if (Math.abs(this._scrollerEl.scrollTop) <= STICKY_SCROLL_LENIENCE) {
      this._fetchMoreMessagesThrottled(FUTURE);
    }

    this._calculateStickScroll(event.forceShowScrollToBottom);
  },

  _calculateStickScroll(forceShowScrollToBottom) {
    const absoluteScrollTop = Math.abs(this._scrollerEl.scrollTop);
    const shouldStick = absoluteScrollTop < STICKY_SCROLL_LENIENCE;

    if (forceShowScrollToBottom) {
      this.set("showScrollToBottomBtn", forceShowScrollToBottom);
    } else {
      this.set(
        "showScrollToBottomBtn",
        shouldStick
          ? false
          : absoluteScrollTop / this._scrollerEl.offsetHeight > 0.67
      );
    }

    if (!this.showScrollToBottomBtn) {
      this.set("hasNewMessages", false);
    }

    if (shouldStick !== this.stickyScroll) {
      if (shouldStick) {
        this._stickScrollToBottom();
      } else {
        this.set("stickyScroll", false);
      }
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
    switch (data.type) {
      case "sent":
        this.handleSentMessage(data);
        break;
      case "processed":
        this.handleProcessedMessage(data);
        break;
      case "edit":
        this.handleEditMessage(data);
        break;
      case "refresh":
        this.handleRefreshMessage(data);
        break;
      case "delete":
        this.handleDeleteMessage(data);
        break;
      case "bulk_delete":
        this.handleBulkDeleteMessage(data);
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
  },

  handleSentMessage(data) {
    if (this.chatChannel.isFollowing) {
      this.chatChannel.set("last_message_sent_at", new Date());
    }

    if (data.chat_message.user.id === this.currentUser.id) {
      // User sent this message. Check staged messages to see if this client sent the message.
      // If so, need to update the staged message with and id.
      const stagedMessage = this.messageLookup[`staged-${data.stagedId}`];
      if (stagedMessage) {
        stagedMessage.setProperties({
          error: null,
          staged: false,
          id: data.chat_message.id,
          staged_id: null,
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

    const preparedMessage = this._prepareSingleMessage(
      data.chat_message,
      this.messages[this.messages.length - 1]
    );

    this.messages.pushObject(preparedMessage);

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

  handleRefreshMessage(data) {
    const message = this.messageLookup[data.chat_message.id];
    if (message) {
      this.appEvents.trigger("chat:refresh-message", message);
    }
  },

  handleEditMessage(data) {
    const message = this.messageLookup[data.chat_message.id];
    if (message) {
      message.setProperties({
        message: data.chat_message.message,
        cooked: data.chat_message.cooked,
        excerpt: data.chat_message.excerpt,
        uploads: cloneJSON(data.chat_message.uploads || []),
        edited: true,
      });
    }
  },

  handleBulkDeleteMessage(data) {
    data.deleted_ids.forEach((deletedId) => {
      this.handleDeleteMessage({
        deleted_id: deletedId,
        deleted_at: data.deleted_at,
      });
    });
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

  @action
  sendMessage(message, uploads = []) {
    resetIdle();

    if (this.sendingLoading) {
      return;
    }

    this.set("sendingLoading", true);
    this._setDraftForChannel(null);

    // TODO: all send message logic is due for massive refactoring
    // This is all the possible case Im currently aware of
    // - messaging to a public channel where you are not a member yet (preview = true)
    // - messaging to an existing direct channel you were not tracking yet through dm creator (channel draft)
    // - messaging to a new direct channel through DM creator (channel draft)
    // - message to a direct channel you were tracking (preview = false, not draft)
    // - message to a public channel you were tracking (preview = false, not draft)
    // - message to a channel when we haven't loaded all future messages yet.
    if (!this.chatChannel.isFollowing || this.chatChannel.isDraft) {
      this.set("loading", true);

      return this._upsertChannelWithMessage(
        this.chatChannel,
        message,
        uploads
      ).finally(() => {
        if (this._selfDeleted) {
          return;
        }
        this.set("loading", false);
        this.set("sendingLoading", false);
        this._resetAfterSend();
        this._stickScrollToBottom();
      });
    }

    this.set("_nextStagedMessageId", this._nextStagedMessageId + 1);
    const cooked = this.cook(message);
    const stagedId = this._nextStagedMessageId;
    let data = {
      message,
      cooked,
      staged_id: stagedId,
      upload_ids: uploads.map((upload) => upload.id),
    };
    if (this.replyToMsg) {
      data.in_reply_to_id = this.replyToMsg.id;
    }

    // Start ajax request but don't return here, we want to stage the message instantly when all messages are loaded.
    // Otherwise, we'll fetch latest and scroll to the one we just created.
    // Return a resolved promise below.
    const msgCreationPromise = ChatApi.sendMessage(this.chatChannel.id, data)
      .catch((error) => {
        this._onSendError(data.staged_id, error);
      })
      .finally(() => {
        if (this._selfDeleted) {
          return;
        }
        this.set("sendingLoading", false);
      });

    if (this.details.can_load_more_future) {
      msgCreationPromise.then(() => this._fetchAndScrollToLatest());
    } else {
      const stagedMessage = this._prepareSingleMessage(
        // We need to add the user and created at for presentation of staged message
        {
          message,
          cooked,
          stagedId,
          uploads: cloneJSON(uploads),
          staged: true,
          user: this.currentUser,
          in_reply_to: this.replyToMsg,
          created_at: new Date(),
        },
        this.messages[this.messages.length - 1]
      );
      this.messages.pushObject(stagedMessage);
      this._stickScrollToBottom();
    }

    this._resetAfterSend();
    this.appEvents.trigger("chat-composer:reply-to-set", null);
    return Promise.resolve();
  },

  async _upsertChannelWithMessage(channel, message, uploads) {
    let promise;

    if (channel.isDirectMessageChannel || channel.isDraft) {
      promise = this.chat.upsertDmChannelForUsernames(
        channel.chatable.users.mapBy("username")
      );
    } else {
      promise = ChatApi.loading(channel.id).then(() => channel);
    }

    return promise
      .then((c) => {
        c.current_user_membership.set("following", true);
        return this.chat.startTrackingChannel(c);
      })
      .then((c) =>
        ajax(`/chat/${c.id}.json`, {
          type: "POST",
          data: {
            message,
            upload_ids: (uploads || []).mapBy("id"),
          },
        }).then(() => {
          this.chat.forceRefreshChannels();
          this.onSwitchChannel(ChatChannel.create(c));
        })
      );
  },

  _onSendError(stagedId, error) {
    const stagedMessage = this.messageLookup[`staged-${stagedId}`];
    if (stagedMessage) {
      if (error.jqXHR?.responseJSON?.errors?.length) {
        stagedMessage.set("error", error.jqXHR.responseJSON.errors[0]);
      } else {
        this.chat.markNetworkAsUnreliable();
        stagedMessage.set("error", "network_error");
      }
    }

    this._resetAfterSend();
  },

  @action
  resendStagedMessage(stagedMessage) {
    this.set("sendingLoading", true);

    stagedMessage.set("error", null);

    const data = {
      cooked: stagedMessage.cooked,
      message: stagedMessage.message,
      upload_ids: stagedMessage.upload_ids,
      staged_id: stagedMessage.stagedId,
    };

    ChatApi.sendMessage(this.chatChannel.id, data)
      .catch((error) => {
        this._onSendError(data.staged_id, error);
      })
      .then(() => {
        this.chat.markNetworkAsReliable();
      })
      .finally(() => {
        if (this._selfDeleted) {
          return;
        }
        this.set("sendingLoading", false);
      });
  },

  @action
  editMessage(chatMessage, newContent, uploads) {
    this.set("sendingLoading", true);
    let data = {
      new_message: newContent,
      upload_ids: (uploads || []).map((upload) => upload.id),
    };
    return ajax(`/chat/${this.chatChannel.id}/edit/${chatMessage.id}`, {
      type: "PUT",
      data,
    })
      .then(() => {
        this._resetAfterSend();
      })
      .catch(popupAjaxError)
      .finally(() => {
        if (this._selfDeleted) {
          return;
        }
        this.set("sendingLoading", false);
      });
  },

  _resetChannelState() {
    this._unsubscribeToUpdates(this.registeredChatChannelId);
    this.messages.clear();
    this.messageLookup = {};
    this.set("allPastMessagesLoaded", false);
    this.set("registeredChatChannelId", null);
    this.set("selectingMessages", false);
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
      if (
        !message.staged &&
        message.user.id === this.currentUser.id &&
        !message.error
      ) {
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
      this.cancelEditing();
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
      this.fetchMessages(this.chatChannel);
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
    this._focusComposer();
  },

  @discourseComputed("details.user_silenced")
  canInteractWithChat(userSilenced) {
    return !userSilenced;
  },

  @discourseComputed
  chatProgressBarContainer() {
    return document.querySelector("#chat-progress-bar-container");
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
  navigateToIndex() {
    this.router.transitionTo("chat.index");
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

  @action
  onCloseFullScreen(channel) {
    this.fullPageChat.isPreferred = false;
    this.appEvents.trigger("chat:open-channel", channel);

    const previousRouteInfo = this.fullPageChat.exit();
    if (previousRouteInfo) {
      this._transitionToRoute(previousRouteInfo);
    } else {
      this.router.transitionTo(`discovery.${defaultHomepage()}`);
    }
  },

  @action
  cancelEditing() {
    this.set("editingMessage", null);
  },

  @action
  _setDraftForChannel(draft) {
    if (this.chatChannel.isDraft) {
      return;
    }

    if (draft?.replyToMsg) {
      draft.replyToMsg = {
        id: draft.replyToMsg.id,
        excerpt: draft.replyToMsg.excerpt,
        user: draft.replyToMsg.user,
      };
    }
    this.chat.setDraftForChannel(this.chatChannel, draft);
    this.set("draft", draft);
  },

  @action
  setInReplyToMsg(inReplyMsg) {
    this.set("replyToMsg", inReplyMsg);
  },

  @action
  composerValueChanged(value, uploads, replyToMsg) {
    if (!this.editingMessage && !this.chatChannel.directMessageChannelDraft) {
      this._setDraftForChannel({ value, uploads, replyToMsg });
    }

    if (!this.chatChannel.directMessageChannelDraft) {
      this._reportReplyingPresence(value);
    }
  },

  @action
  reStickScrollIfNeeded() {
    if (this.stickyScroll) {
      this._stickScrollToBottom();
    }
  },

  @action
  onHoverMessage(message, options = {}, event) {
    cancel(this._onHoverMessageDebouncedHandler);

    if (this.site.mobileView && options.desktopOnly) {
      return;
    }

    if (message?.staged) {
      return;
    }

    if (
      this.hoveredMessageId &&
      message?.id &&
      this.hoveredMessageId === message?.id
    ) {
      return;
    }

    if (event) {
      if (
        event.type === "mouseleave" &&
        (event.toElement || event.relatedTarget)?.closest(
          ".chat-message-actions-desktop-anchor"
        )
      ) {
        return;
      }

      if (
        event.type === "mouseenter" &&
        (event.fromElement || event.relatedTarget)?.closest(
          ".chat-message-actions-desktop-anchor"
        )
      ) {
        this.set("hoveredMessageId", message?.id);
        return;
      }
    }

    this._onHoverMessageDebouncedHandler = discourseDebounce(
      this,
      this.debouncedOnHoverMessage,
      message,
      250
    );
  },

  @bind
  debouncedOnHoverMessage(message) {
    if (this._selfDeleted) {
      return;
    }

    this.set(
      "hoveredMessageId",
      message?.id && message.id !== this.hoveredMessageId ? message.id : null
    );
  },

  _reportReplyingPresence(composerValue) {
    if (this.chatChannel.isDraft) {
      return;
    }

    const replying = !this.editingMessage && !!composerValue;
    this.chatComposerPresenceManager.notifyState(this.chatChannel.id, replying);
  },

  @action
  restickScrolling(event) {
    event.preventDefault();

    return this._fetchAndScrollToLatest();
  },

  focusComposer() {
    if (
      this._selfDeleted ||
      this.site.mobileView ||
      this.chatChannel?.isDraft
    ) {
      return;
    }

    schedule("afterRender", () => {
      document.querySelector(".chat-composer-input")?.focus();
    });
  },

  @afterRender
  _focusComposer() {
    this.appEvents.trigger("chat:focus-composer");
  },

  _unsubscribeToUpdates(channelId) {
    this.messageBus.unsubscribe(`/chat/${channelId}`);
  },

  _subscribeToUpdates(channelId) {
    this._unsubscribeToUpdates(channelId);
    this.messageBus.subscribe(`/chat/${channelId}`, (busData) => {
      if (!this.details.can_load_more_future || busData.type !== "sent") {
        this.handleMessage(busData);
      } else {
        this.set("hasNewMessages", true);
      }
    });
  },

  _transitionToRoute(routeInfo) {
    const routeName = routeInfo.name;
    let params = [];

    do {
      params = Object.values(routeInfo.params).concat(params);
      routeInfo = routeInfo.parent;
    } while (routeInfo);

    this.router.transitionTo(routeName, ...params);
  },

  @bind
  _forceBodyScroll() {
    // when keyboard is visible this will ensure body
    // doesn’t scroll out of viewport
    if (
      this.capabilities.isIOS &&
      document.documentElement.classList.contains("keyboard-visible") &&
      !isZoomed()
    ) {
      document.documentElement.scrollTo(0, 0);
    }
  },

  _fetchAndScrollToLatest() {
    return this.fetchMessages(this.chatChannel, {
      fetchFromLastMessage: true,
    }).then(() => {
      if (this._selfDeleted) {
        return;
      }

      this.set("stickyScroll", true);
      this._stickScrollToBottom();
    });
  },

  _handleErrors(error) {
    switch (error?.jqXHR?.status) {
      case 429:
      case 404:
        popupAjaxError(error);
        break;
      default:
        throw error;
    }
  },

  // since -webkit-overflow-scrolling: touch can't be used anymore to disable momentum scrolling
  // we now use this hack to disable it
  @bind
  _wrapIOSFix(callback) {
    if (!this._scrollerEl) {
      return;
    }

    if (this.capabilities.isIOS) {
      this._scrollerEl.style.overflow = "hidden";
    }

    callback();

    if (this.capabilities.isIOS) {
      discourseLater(() => {
        if (!this._scrollerEl) {
          return;
        }

        this._scrollerEl.style.overflow = "auto";
      }, 25);
    }
  },
});
