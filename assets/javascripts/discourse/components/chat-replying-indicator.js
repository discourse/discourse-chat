import Component from "@ember/component";
import { inject as service } from "@ember/service";
import discourseComputed from "discourse-common/utils/decorators";
import I18n from "I18n";

export default Component.extend({
  classNames: ["tc-replying-indicator"],
  presence: service(),

  @discourseComputed("presenceChannel.users.[]")
  usernames(users) {
    return users
      ?.filter((u) => u.id !== this.currentUser.id)
      ?.map((u) => u.username);
  },

  @discourseComputed("usernames")
  text(usernames) {
    if (!usernames || usernames.length === 0) {
      return;
    } else if (usernames.length === 1) {
      return I18n.t("chat.replying_indicator.single_user", {
        username: usernames[0],
      });
    } else if (usernames.length < 4) {
      const lastUsername = usernames.pop();
      const commaSeparatedUsernames = usernames.join(", ");
      return I18n.t("chat.replying_indicator.multiple_users", {
        commaSeparatedUsernames,
        lastUsername,
      });
    } else {
      const commaSeparatedUsernames = usernames.slice(0, 2).join(", ");
      return I18n.t("chat.replying_indicator.many_users", {
        commaSeparatedUsernames,
        count: usernames.length - 2,
      });
    }
  },

  @discourseComputed("usernames")
  shouldDisplay(usernames) {
    return !!usernames?.length;
  },

  @discourseComputed("chatChannelId")
  channelName(id) {
    return `/chat-reply/${id}`;
  },

  didReceiveAttrs() {
    this._super(...arguments);

    if (this.presenceChannel?.name !== this.channelName) {
      this.presenceChannel?.unsubscribe();
      this.set("presenceChannel", this.presence.getChannel(this.channelName));
      this.presenceChannel.subscribe();
    }
  },

  willDestroyElement() {
    this.presenceChannel?.unsubscribe();
  },
});
