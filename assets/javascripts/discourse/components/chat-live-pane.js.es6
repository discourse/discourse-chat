import { A } from "@ember/array";
import { ajax } from "discourse/lib/ajax";
import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import discourseDebounce from "discourse-common/lib/debounce";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { cancel, schedule } from "@ember/runloop";

const MAX_RECENT_MSGS = 100;
const STICKY_SCROLL_LENIENCE = 4;

function makeLookupMap(usersData) {
  const ret = {};
  if (!usersData) {
    // empty set returned
    return ret;
  }
  usersData.forEach((v) => {
    ret[v.id] = v;
    v.template = v.avatar_template; // HACK
  });
  return ret;
}

export default Component.extend({
  classNameBindings: [":tc-live-pane", "sendingloading", "loading"],
  topicId: null,
  registeredTopicId: null,
  loading: false,
  sendingloading: false,
  stickyScroll: true,
  stickyScrollTimer: null,

  messages: A(),

  didInsertElement() {
    this._super(...arguments);

    const scroller = this.element.querySelector(".tc-messages-scroll");
    scroller.addEventListener(
      "scroll",
      (evt) => {
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

    if (this.registeredTopicId != this.topicId) {
      if (this.registeredTopicId) {
        this.messageBus.unsubscribe(`/chat/${this.registeredTopicId}`);
        this.messages.clear();
        this.registeredTopicId = null;
      }

      if (this.topicId != null) {
        const topicId = this.topicId;
        this.set("loading", true);
        ajax(`/chat/t/${this.topicId}/recent`)
          .then((data) => {
            const tc = data.topic_chat_view;
            const usersLookup = makeLookupMap(data.users);
            this.set(
              "messages",
              A(
                tc.messages
                  .map((m) => this.prepareMessage(m, usersLookup))
                  .reverse()
              )
            );
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
            this.set("loading", false);
          });
      }
    }
  },

  doScrollStick() {
    if (this.stickyScroll) {
      const scroller = this.element.querySelector(".tc-messages-scroll");
      scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
    }
  },

  checkScrollStick() {
    const scroller = this.element.querySelector(".tc-messages-scroll");
    const current =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <=
      STICKY_SCROLL_LENIENCE;
    if (current != this.stickyScroll) {
      this.set("stickyScroll", current);
      if (current) {
        scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
      }
    }
  },

  prepareMessage(msgData, userLookup) {
    msgData.user = userLookup[msgData.user_id];
    return msgData;
  },

  handleMessage(data) {
    if (data.typ === "sent") {
      const userLookup = makeLookupMap(data.users);
      const msg = this.prepareMessage(data.topic_chat_message, userLookup);

      this.messages.pushObject(msg);
      if (this.messages.length >= MAX_RECENT_MSGS) {
        this.messages.shiftObject();
      }
      schedule("afterRender", this, this.doScrollStick);
      if (this.newMessageCb) {
        this.newMessageCb();
      }
    } else if (data.type == "delete") {
      const deletedId = data.deletedId;
      const targetMsg = this.messages.findBy("id", deletedId);
      // TODO: only softdelete if canModerateChat
      targetMsg.set("deleted", true);
    }
  },

  actions: {
    sendChat(message) {
      this.set("sendingloading", true);
      return ajax(`/chat/t/${this.topicId}/`, {
        type: "POST",
        data: {
          message,
          /* in_reply_to_id, */
        },
      })
        .then((resp) => {
          // TODO
        })
        .catch(popupAjaxError)
        .finally(() => {
          this.set("sendingloading", false);
        });
    },

    restickScrolling() {
      this.set("stickyScroll", true);
      this.doScrollStick();
    },
  },
});
