import { popupAjaxError } from "discourse/lib/ajax-error";
import { caretPosition } from "discourse/lib/utilities";
import { isEmpty } from "@ember/utils";
import Component from "@ember/component";
import { action, computed } from "@ember/object";
import discourseDebounce from "discourse-common/lib/debounce";
import { bind } from "discourse-common/utils/decorators";
import { INPUT_DELAY } from "discourse-common/config/environment";
import { inject as service } from "@ember/service";
import { schedule } from "@ember/runloop";
import { not } from "@ember/object/computed";

export default Component.extend({
  tagName: "",
  users: null,
  term: null,
  isFiltering: false,
  isFilterFocused: false,
  highlightedSelectedUser: null,
  focusedUser: null,
  chat: service(),
  router: service(),
  isLoading: false,
  onSwitchChannel: null,

  init() {
    this._super(...arguments);

    this.set("users", []);
  },

  didInsertElement() {
    this._super(...arguments);

    this.filterUsernames();
    this.focusFilter();
  },

  @bind
  filterUsernames(term = null) {
    this.set("isFiltering", true);

    this.chat
      .searchPossibleDirectMessageUsers({
        term,
        limit: 6,
        exclude: [this.currentUser?.username].concat(
          this.channel.chatable?.users?.mapBy("username") || []
        ),
        lastSeenUsers: isEmpty(term) ? true : false,
      })
      .then((r) => {
        if (this.isDestroying || this.isDestroyed) {
          return;
        }

        if (r !== "__CANCELLED") {
          this.set("users", r.users || []);
          this.set("focusedUser", this.users.firstObject);
        }
      })
      .finally(() => {
        if (this.isDestroying || this.isDestroyed) {
          return;
        }

        this.set("isFiltering", false);
      });
  },

  shouldRenderResults: not("isFiltering", "channel.isFetchingChannelPreview"),

  @action
  selectUser(user) {
    this.channel.chatable.users.pushObject(user);
    this.users.removeObject(user);
    this.channel.set("previewedChannel", null);
    this.channel.set("isFetchingChannelPreview", false);
    this._fetchPreviewedChannel();
    this.set("users", []);
    this.set("focusedUser", null);
    this.set("highlightedSelectedUser", null);
    this.set("term", null);
    this.focusFilter();
  },

  @action
  deselectUser(user) {
    this.channel.chatable.users.removeObject(user);
    this.channel.set("previewedChannel", null);
    this.channel.set("isFetchingChannelPreview", false);
    this._fetchPreviewedChannel();
    this.set("focusedUser", this.users.firstObject);
    this.set("highlightedSelectedUser", null);
    this.set("term", null);

    if (isEmpty(this.channel.chatable.users)) {
      this.filterUsernames();
    }

    this.focusFilter();
  },

  @action
  focusFilter() {
    this.set("isFilterFocused", true);

    schedule("afterRender", () => {
      document.querySelector(".filter-usernames")?.focus();
    });
  },

  @action
  onFilterInput(term) {
    this.set("term", term);
    this.set("users", []);

    if (!term?.length) {
      return;
    }

    this.set("isFiltering", false);

    discourseDebounce(this, this.filterUsernames, term, INPUT_DELAY);
  },

  @action
  handleUserKeyUp(user, event) {
    if (event.key === "Enter") {
      event.stopPropagation();
      event.preventDefault();
      this.selectUser(user);
    }
  },

  @action
  onFilterInputFocusOut() {
    this.set("isFilterFocused", false);
    this.set("highlightedSelectedUser", null);
  },

  @action
  leaveChannel() {
    this.router.transitionTo("chat.index");
  },

  @action
  handleFilterKeyDown(value, event) {
    if (event.key === "Tab") {
      const enabledComposer = document.querySelector(".chat-composer-input");
      if (enabledComposer && !enabledComposer.disabled) {
        event.preventDefault();
        event.stopPropagation();
        enabledComposer.focus();
      }
    }

    if (
      (event.key === "Enter" || event.key === "Backspace") &&
      this.highlightedSelectedUser
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.deselectUser(this.highlightedSelectedUser);
      return;
    }

    if (
      event.key === "Backspace" &&
      isEmpty(value) &&
      this.channel.chatable.users?.length
    ) {
      event.preventDefault();
      event.stopPropagation();

      this.deselectUser(this.channel.chatable.users.lastObject);
    }

    if (event.key === "Enter" && this.focusedUser) {
      event.preventDefault();
      event.stopPropagation();
      this.selectUser(this.focusedUser);
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      this._handleVerticalArrowKeys(event);
    }

    if (event.key === "Escape" && this.highlightedSelectedUser) {
      this.set("highlightedSelectedUser", null);
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      this._handleHorizontalArrowKeys(event);
    }
  },

  _firstSelectWithArrows(event) {
    if (event.key === "ArrowRight") {
      return;
    }

    if (event.key === "ArrowLeft") {
      const position = caretPosition(
        document.querySelector(".filter-usernames")
      );
      if (position > 0) {
        return;
      } else {
        event.preventDefault();
        event.stopPropagation();
        this.set(
          "highlightedSelectedUser",
          this.channel.chatable.users.lastObject
        );
      }
    }
  },

  _changeSelectionWithArrows(event) {
    if (event.key === "ArrowRight") {
      if (
        this.highlightedSelectedUser === this.channel.chatable.users.lastObject
      ) {
        this.set("highlightedSelectedUser", null);
        return;
      }

      if (this.channel.chatable.users.length === 1) {
        return;
      }

      this._highlightNextSelectedUser(event.key === "ArrowLeft" ? -1 : 1);
    }

    if (event.key === "ArrowLeft") {
      if (this.channel.chatable.users.length === 1) {
        return;
      }

      this._highlightNextSelectedUser(event.key === "ArrowLeft" ? -1 : 1);
    }
  },

  _highlightNextSelectedUser(modifier) {
    const newIndex =
      this.channel.chatable.users.indexOf(this.highlightedSelectedUser) +
      modifier;

    if (this.channel.chatable.users.objectAt(newIndex)) {
      this.set(
        "highlightedSelectedUser",
        this.channel.chatable.users.objectAt(newIndex)
      );
    } else {
      this.set(
        "highlightedSelectedUser",
        event.key === "ArrowLeft"
          ? this.channel.chatable.users.lastObject
          : this.channel.chatable.users.firstObject
      );
    }
  },

  _handleHorizontalArrowKeys(event) {
    const position = caretPosition(document.querySelector(".filter-usernames"));
    if (position > 0) {
      return;
    }

    if (!this.highlightedSelectedUser) {
      this._firstSelectWithArrows(event);
    } else {
      this._changeSelectionWithArrows(event);
    }
  },

  _handleVerticalArrowKeys(event) {
    if (isEmpty(this.users)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!this.focusedUser) {
      this.set("focusedUser", this.users.firstObject);
      return;
    }

    const modifier = event.key === "ArrowUp" ? -1 : 1;
    const newIndex = this.users.indexOf(this.focusedUser) + modifier;

    if (this.users.objectAt(newIndex)) {
      this.set("focusedUser", this.users.objectAt(newIndex));
    } else {
      this.set(
        "focusedUser",
        event.key === "ArrowUp" ? this.users.lastObject : this.users.firstObject
      );
    }
  },

  @computed("channel.chatable.users.[]")
  get formatedUsernames() {
    return (this.channel.chatable.users || [])
      .mapBy("username")
      .uniq()
      .join(",");
  },

  _fetchPreviewedChannel() {
    if (isEmpty(this.channel.chatable.users)) {
      this.channel.set("id", "draft");
      this.onSwitchChannel?.(this.channel, {
        replace: true,
        transition: false,
      });
      return;
    }

    this.channel.set("isFetchingChannelPreview", true);

    return this.chat
      .getDmChannelForUsernames(this.formatedUsernames)
      .catch((error) => {
        if (error?.jqXHR?.status === 404) {
          this.channel.set("id", "draft");
          this.onSwitchChannel?.(this.channel, {
            replace: true,
            transition: false,
          });
        } else {
          popupAjaxError(error);
        }
      })
      .then((response) => {
        if (!response || this.isDestroying || this.isDestroyed) {
          this.set("previewedChannel", null);
          return;
        }

        this.channel.set("id", response.chat_channel.id);
        this.onSwitchChannel?.(this.channel, {
          replace: true,
          transition: false,
        });
      })
      .catch(popupAjaxError)
      .finally(() => {
        this.channel.set("isFetchingChannelPreview", false);
      });
  },
});
