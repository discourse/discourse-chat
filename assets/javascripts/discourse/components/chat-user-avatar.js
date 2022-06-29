import Component from "@ember/component";
import { computed } from "@ember/object";
import { inject as service } from "@ember/service";

export default class ChatUserAvatar extends Component {
  tagName = "";

  chat = service();

  user = null;

  avatarSize = "tiny";

  onlineUsers = null;

  @computed("onlineUsers.[]", "user.{id,username}")
  get isOnline() {
    return (
      !!this.onlineUsers?.findBy("id", this.user?.id) ||
      !!this.onlineUsers?.findBy("username", this.user?.username)
    );
  }
}
