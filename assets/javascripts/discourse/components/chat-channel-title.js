import Component from "@ember/component";
import { computed } from "@ember/object";
import { gt, reads } from "@ember/object/computed";

export default class ChatChannelTitle extends Component {
  tagName = "";
  channel = null;
  unreadIndicator = false;

  @reads("channel.chatable.users.[]") users;
  @gt("users.length", 1) multiDm;

  @computed("users")
  get usernames() {
    return this.users.mapBy("username").join(", ");
  }
}
