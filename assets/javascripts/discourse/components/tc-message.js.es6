import Component from "@ember/component";
import discourseComputed from "discourse-common/utils/decorators";
import { prioritizeNameInUx } from "discourse/lib/settings";
import { formatUsername } from "discourse/lib/utilities";
import { action } from "@ember/object";

export default Component.extend({
  classNames: "tc-message",

  @discourseComputed("message.user")
  name(user) {
    return this.prioritizeName ? user.name : user.username;
  },

  @discourseComputed("message.user.name")
  prioritizeName(name) {
    return this.siteSettings.display_name_on_posts && prioritizeNameInUx(name);
  },

  @discourseComputed("message.user")
  usernameClasses(user) {
    const classes = this.prioritizeName ? ["full-name names first"] : ["username names first"];
    if (user.staff) {
      classes.push("staff");
    }
    if (user.admin) {
      classes.push("admin");
    }
    if (user.moderator) {
      classes.push("moderator");
    }
    if (user.groupModerator) {
      classes.push("category-moderator");
    }
    return classes;
  },

  @discourseComputed("message")
  showReplyButton(message) {
    return true;
  },

  @discourseComputed("message")
  showFlagButton(message) {
    return true;
  },

  @discourseComputed("message")
  showDeleteButton(message) {
    return true;
  },

  @action
  reply() {
    console.log('something')
  },

  @action
  flag() {
    console.log('flag')
  },

  @action
  deleteMessage() {
    console.log('delete')
  }
})
