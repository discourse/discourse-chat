import { A } from "@ember/array";
import { action, set } from "@ember/object";
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
  userLookup: null, // Object<Number, User>
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
    this.userLookup = {};
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
        this.userLookup = {};
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
            this.updateUserLookup(data.users);
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

  updateUserLookup(usersData) {
    if (!usersData) {
      return;
    }
    usersData.forEach((v) => {
      this.userLookup[v.id] = v;
      v.template = v.avatar_template; // HACK
    });
  },

  prepareMessage(msgData) {
    msgData.user = this.userLookup[msgData.user_id];
    if (msgData.in_reply_to_id) {
      msgData.in_reply_to = this.messageLookup[msgData.in_reply_to_id];
    }
    this.messageLookup[msgData.id] = msgData;
    return msgData;
  },

  removeMessage(msgData) {
    delete this.messageLookup[msgData.id];
  },

  handleMessage(data) {
    console.log(data)
    if (data.typ === "sent") {
      this.updateUserLookup(data.users);
      const msg = this.prepareMessage(data.topic_chat_message);

      this.messages.pushObject(msg);
      if (this.messages.length >= MAX_RECENT_MSGS) {
        this.removeMessage(this.messages.shiftObject());
      }
      schedule("afterRender", this, this.doScrollStick);
      if (this.newMessageCb) {
        this.newMessageCb();
      }
    } else if (data.typ === "delete") {
      const deletedId = data.deleted_id;
      const targetMsg = this.messages.findBy("id", deletedId);
      if (this.currentUser.staff || this.currentUser.id === targetMsg.user_id) {
        targetMsg.deleted_at = data.deleted_at
      } else {
        this.messages.removeObject(targetMsg);
      }
    }
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
