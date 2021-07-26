import { A } from "@ember/array";
import EmberObject, { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import Component from "@ember/component";
import { observes } from "discourse-common/utils/decorators";
import cookChatMessage from "discourse/plugins/discourse-topic-chat/discourse/lib/cook-chat-message";
import discourseDebounce from "discourse-common/lib/debounce";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { cancel, later, schedule } from "@ember/runloop";
import { inject as service } from "@ember/service";

const MAX_RECENT_MSGS = 100;
const STICKY_SCROLL_LENIENCE = 4;

export default Component.extend({
  classNameBindings: [":tc-live-pane", "sendingloading", "loading"],
  topicId: null, // ?Number
  chatChannel: null,
  registeredChatChannelId: null, // ?Number
  loading: false,
  sendingloading: false,
  stickyScroll: true,
  stickyScrollTimer: null,

  editingMessage: null, // ?Message
  replyToMsg: null, // ?Message
  details: null, // Object { chat_channel_id, can_chat, ... }
  messages: null, // Array
  messageLookup: null, // Object<Number, Message>
  targetMessageId: null,

  chatService: service(),

  getCachedChannelDetails: null,
  clearCachedChannelDetails: null,

  didInsertElement() {
    this._super(...arguments);

    this.appEvents.on("chat:open-message", this, "highlightOrFetchMessage");

    const scroller = this.element.querySelector(".tc-messages-scroll");
    scroller.addEventListener(
      "scroll",
      () => {
        this.stickyScrollTimer = discourseDebounce(
          this,
          this.checkScrollStick,
          50
        );
      },
      { passive: true }
    );
  },

  willDestroyElement() {
    this.appEvents.off("chat:open-message", this, "highlightOrFetchMessage");

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
      : `/chat/${this.chatChannel.id}/recent`;

    ajax(url)
      .then((data) => {
        if (!this.element || this.isDestroying || this.isDestroyed) {
          return;
        }
        this.setMessageProps(data.topic_chat_view);
      })
      .catch((err) => {
        throw err;
      })
      .finally(() => {
        if (this.targetMessageId) {
          this.chatService.clearMessageId();
        }

        if (!this.element || this.isDestroying || this.isDestroyed) {
          return;
        }
        this.set("loading", false);
      });
  },

  setMessageProps(chatView) {
    this.setProperties({
      messages: A(chatView.messages.map((m) => this.prepareMessage(m))),
      details: {
        chat_channel_id: this.chatChannel.id,
        can_chat: chatView.can_chat,
        can_flag: chatView.can_flag,
        can_delete_self: chatView.can_delete_self,
        can_delete_others: chatView.can_delete_others,
      },
      registeredChatChannelId: this.chatChannel.id,
    });

    schedule("afterRender", this, () => {
      this.doScrollStick();
      if (this.targetMessageId) {
        this.scrollToHighlightedMessage(this.targetMessageId);
      }
    });
    this.messageBus.subscribe(
      `/chat/${this.chatChannel.id}`,
      (busData) => {
        this.handleMessage(busData);
      },
      chatView.last_id
    );
  },

  highlightOrFetchMessage(_, messageId) {
    if (this.selfDeleted()) {
      return;
    }

    if (this.messageLookup[messageId]) {
      // We have the message rendered. highlight and scrollTo
      this.scrollToHighlightedMessage(messageId);
    } else {
      this.set("targetMessageId", messageId);
      this.fetchMessages();
    }
  },

  scrollToHighlightedMessage(messageId) {
    if (this.selfDeleted()) {
      return;
    }

    const messageEl = this.element.querySelector(
      `.tc-messages-scroll .tc-message-${messageId}`
    );
    if (messageEl) {
      messageEl.classList.add("highlighted");
      messageEl.scrollIntoView({ behavior: "smooth" });

      // Remove highlighted class, but keep `transition-slow` on for another 2 seconds
      // to ensure the background color fades smoothly out
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
  },

  doScrollStick() {
    if (this.selfDeleted()) {
      return;
    }
    if (this.stickyScroll) {
      const scroller = this.element.querySelector(".tc-messages-scroll");
      scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
    }
  },

  checkScrollStick() {
    if (this.selfDeleted()) {
      return;
    }
    if (!this.expanded) {
      // Force to bottom when collapsed
      this.set("stickyScroll", true);
      return;
    }

    const scroller = this.element.querySelector(".tc-messages-scroll");
    const current =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <=
      STICKY_SCROLL_LENIENCE;
    if (current !== this.stickyScroll) {
      this.set("stickyScroll", current);
      if (current) {
        scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
      }
    }
  },

  @observes("expanded")
  restickOnExpand() {
    this.doScrollStick();
  },

  prepareMessage(msgData) {
    if (msgData.in_reply_to_id) {
      msgData.in_reply_to = this.messageLookup[msgData.in_reply_to_id];
    }
    msgData.expanded = !msgData.deleted_at;
    msgData.cookedMessage = cookChatMessage(
      msgData.message,
      this.siteSettings,
      this.site.categories
    );
    this.messageLookup[msgData.id] = msgData;
    return EmberObject.create(msgData);
  },

  removeMessage(msgData) {
    delete this.messageLookup[msgData.id];
  },

  handleMessage(data) {
    switch (data.typ) {
      case "sent":
        this.handleSentMessage(data);
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
    const newMessage = this.prepareMessage(data.topic_chat_message);
    this.messages.pushObject(newMessage);

    if (this.messages.length >= MAX_RECENT_MSGS) {
      this.removeMessage(this.messages.shiftObject());
    }
    schedule("afterRender", this, this.doScrollStick);
    if (this.newMessageCb) {
      this.newMessageCb();
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
      message = this.prepareMessage(data.topic_chat_message);
      let newMessageIndex = this.binarySearchForMessagePosition(
        this.messages,
        message
      );
      if (newMessageIndex === 0) {
        return;
      } // Restored post is too old to show

      this.messages.splice(newMessageIndex, 0, message);
      this.notifyPropertyChange("messages");
      if (this.newMessageCb) {
        this.newMessageCb();
      }
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
      let k = (n + m) >> 1;
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
      .then(() => {
        if (!this.element || this.isDestroying || this.isDestroyed) {
          return;
        }
        this.set("replyToMsg", null);
      })
      .catch(popupAjaxError)
      .finally(() => {
        if (!this.element || this.isDestroying || this.isDestroyed) {
          return;
        }
        this.set("sendingloading", false);
      });
  },

  @action
  editMessage(message) {
    console.log(message)
  },

  @action
  setReplyTo(messageId) {
    if (messageId) {
      this.set("replyToMsg", this.messageLookup[messageId]);
      const textarea = this.element.querySelector(".tc-composer textarea");
      if (textarea) {
        textarea.focus();
      }
    } else {
      this.set("replyToMsg", null);
    }
    schedule("afterRender", this, this.doScrollStick);
  },

  @action
  editButtonClicked(messageId) {
    const message = this.messageLookup[messageId];
    this.set("editingMessage", message);
    schedule("afterRender", this, this.doScrollStick);
  },

  @action
  cancelEditing() {
    this.set("editingMessage", null);
  },

  @action
  composerHeightChange() {
    this.doScrollStick();
  },

  @action
  restickScrolling(evt) {
    this.set("stickyScroll", true);
    this.doScrollStick();
    evt.preventDefault();
  },
});
