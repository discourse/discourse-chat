import { INPUT_DELAY } from "discourse-common/config/environment";
import Component from "@ember/component";
import { action } from "@ember/object";
import { schedule } from "@ember/runloop";
import ChatApi from "discourse/plugins/discourse-chat/discourse/lib/chat-api";
import discourseDebounce from "discourse-common/lib/debounce";

const LIMIT = 50;

export default class ChatChannelMembersView extends Component {
  tagName = "";
  channel = null;
  members = null;
  isSearchFocused = false;
  isFetchingMembers = false;
  onlineUsers = null;
  offset = 0;
  filter = null;
  inputSelector = "channel-members-view__search-input";

  didInsertElement() {
    this._super(...arguments);

    if (!this.channel || this.channel.isDraft) {
      return;
    }

    this._focusSearch();
    this.set("members", []);
    this.fetchMembers();
  }

  @action
  onFilterMembers(username) {
    this.set("filter", username);
    this.set("offset", 0);

    discourseDebounce(
      this,
      this.fetchMembers,
      this.filter,
      this.offset,
      INPUT_DELAY
    );
  }

  @action
  loadMore() {
    discourseDebounce(
      this,
      this.fetchMembers,
      this.filter,
      this.offset,
      INPUT_DELAY
    );
  }

  fetchMembersHandler(id, params = {}) {
    return ChatApi.chatChannelMemberships(id, params);
  }

  fetchMembers(filter = null, offset = 0) {
    this.set("isFetchingMembers", true);

    return this.fetchMembersHandler(this.channel.id, {
      username: filter,
      offset,
    })
      .then((response) => {
        if (this.offset === 0) {
          this.set("members", []);
        }
        this.set("offset", this.offset + LIMIT);
        this.members.pushObjects(response);
      })
      .finally(() => {
        this.set("isFetchingMembers", false);
      });
  }

  _focusSearch() {
    schedule("afterRender", () => {
      document.getElementsByClassName(this.inputSelector)[0]?.focus();
    });
  }
}
