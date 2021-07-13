import { A } from "@ember/array";
import EmberObject, { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import Component from "@ember/component";
import { observes } from "discourse-common/utils/decorators";
import discourseDebounce from "discourse-common/lib/debounce";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { cancel, schedule } from "@ember/runloop";

const MAX_RECENT_MSGS = 100;
const STICKY_SCROLL_LENIENCE = 4;

export default Component.extend({
  classNameBindings: [":tc-live-pane", "sendingloading", "loading"],
  topicId: null, // ?Number
  registeredTopicId: null, // ?Number
  loading: false,
  sendingloading: false,
  stickyScroll: true,
  stickyScrollTimer: null,

  replyToMsg: null, // ?Message
  details: null, // Object { topicId, can_chat, ... }
  messages: null, // Array
  messageLookup: null, // Object<Number, Message>

  didInsertElement() {
    this._super(...arguments);

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

    this.messages = A();
    this.messageLookup = {};
  },

  willDestroyElement() {
    // don't need to removeEventListener from scroller as the DOM element goes away
    if (this.stickyScrollTimer) {
      cancel(this.stickyScrollTimer);
      this.stickyScrollTimer = null;
    }
    if (this.registeredTopicId) {
      this.messageBus.unsubscribe(`/chat/${this.registeredTopicId}`);
      this.registeredTopicId = null;
    }
  },

  didReceiveAttrs() {
    this._super(...arguments);

    if (this.registeredTopicId !== this.topicId) {
      if (this.registeredTopicId) {
        this.messageBus.unsubscribe(`/chat/${this.registeredTopicId}`);
        this.messages.clear();
        this.messageLookup = {};
        this.registeredTopicId = null;
      }

      if (this.topicId != null) {
        const topicId = this.topicId;
        this.set("loading", true);
        ajax(`/chat/t/${this.topicId}/recent`)
          .then((data) => {
            if (!this.element || this.isDestroying || this.isDestroyed) {
              return;
            }
            const tc = data.topic_chat_view;
            this.set(
              "messages",
              A(tc.messages.reverse().map((m) => this.prepareMessage(m)))
            );
            this.set("details", {
              topicId,
              can_chat: tc.can_chat,
              can_flag: tc.can_flag,
              can_delete_self: tc.can_delete_self,
              can_delete_others: tc.can_delete_others,
            });
            this.registeredTopicId = topicId;
            schedule("afterRender", this, this.doScrollStick);

            this.messageBus.subscribe(
              `/chat/${topicId}`,
              (busData) => {
                this.handleMessage(busData);
              },
              tc.last_id
            );
          })
          .catch((err) => {
            throw err;
          })
          .finally(() => {
            if (!this.element || this.isDestroying || this.isDestroyed) {
              return;
            }
            this.set("loading", false);
          });
      }
    }
  },

  doScrollStick() {
    if (!this.element || this.isDestroying || this.isDestroyed) {
      return;
    }
    if (this.stickyScroll) {
      const scroller = this.element.querySelector(".tc-messages-scroll");
      scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
    }
  },

  checkScrollStick() {
    if (!this.element || this.isDestroying || this.isDestroyed) {
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
    const msg = this.prepareMessage(data.topic_chat_message);

    this.messages.pushObject(msg);
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
    const targetMsg = this.messages.findBy("id", deletedId);
    if (this.currentUser.staff || this.currentUser.id === targetMsg.user.id) {
      targetMsg.setProperties({
        deleted_at: data.deleted_at,
        expanded: false,
      });
    } else {
      this.messages.removeObject(targetMsg);
    }
  },

  handleRestoreMessage(data) {
    let message = this.messages.findBy("id", data.topic_chat_message.id);
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
      if (newMessageIndex === 0) return; // Restored post is too old to show

      this.messages.splice(newMessageIndex, 0, message);
      this.notifyPropertyChange("messages");
      if (this.newMessageCb) {
        this.newMessageCb();
      }
    }
  },

  binarySearchForMessagePosition(messages, newMessage) {
    const newMessageCreatedAt = Date.parse(newMessage.created_at);
    if (newMessageCreatedAt < Date.parse(messages[0].created_at)) return 0;
    if (
      newMessageCreatedAt > Date.parse(messages[messages.length - 1].created_at)
    )
      return messages.length;
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

  @action
  sendChat(message) {
    this.set("sendingloading", true);
    let data = { message };
    if (this.replyToMsg) {
      data.in_reply_to_id = this.replyToMsg.id;
    }
    return ajax(`/chat/t/${this.topicId}/`, {
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
  setReplyTo(msgId) {
    if (msgId) {
      this.set("replyToMsg", this.messages.findBy("id", msgId));
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
