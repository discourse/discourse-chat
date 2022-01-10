import Component from "@ember/component";
import EmberObject, { action } from "@ember/object";
import { inject as service } from "@ember/service";
import { next } from "@ember/runloop";

const MAX_RECENT_MSGS = 100;
const STICKY_SCROLL_LENIENCE = 4;
const READ_INTERVAL = 1000;
const PAGE_SIZE = 50;

let extraChatPanes = [];
export function addChatPane(pane) {
  extraChatPanes.push(pane);
}

export default Component.extend({
  DEFAULT_PANE: { name: "default", icon: "comment", title: "chat.messages" },
  classNameBindings: [":chat-panes-container", "fullPage:full-page"],
  chat: service(),
  router: service(),

  init() {
    this._super(...arguments);
    this.set("extraPanes", extraChatPanes);
    this.set("currentPane", this.DEFAULT_PANE.name);
  },

  @action
  changePane(paneName) {
    if (this.currentPane === paneName) {
      // Make sure we don't switch to the same pane again, so appEvents aren't
      // retriggered
      return;
    }
    this.appEvents.trigger(`chat-pane:${paneName}-inactive`);
    this.set("currentPane", paneName);
    this.appEvents.trigger(`chat-pane:${paneName}-active`);
    return false;
  },

  @action
  onChannelTitleClick() {
    if (this.chatChannel.chatable_url) {
      return this.router.transitionTo(this.chatChannel.chatable_url);
    }
  },

  @action
  exitChat() {
    return this.router.transitionTo(this.chat.lastNonChatRoute);
  },
});
