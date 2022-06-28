import Component from "@ember/component";
import { computed } from "@ember/object";
import { next } from "@ember/runloop";
import { inject as service } from "@ember/service";
import { bind } from "discourse-common/utils/decorators";
import { isTesting } from "discourse-common/config/environment";

export default class ChatChannelPresence extends Component {
  tagName = "";
  channel = null;
  @service presence;
  presenceChannel = null;
  onChange = null;

  @computed("channel.id")
  get channelName() {
    return `/chat-channel-presence/${this.channel.id}`;
  }

  didReceiveAttrs() {
    this._super(...arguments);

    if (isTesting() || !this.channel || this.channel.isDraft) {
      return;
    }

    if (this.presenceChannel?.name !== this.channelName) {
      this.presenceChannel?.unsubscribe();

      next(() => {
        this.set("presenceChannel", this.presence.getChannel(this.channelName));
        this.presenceChannel.subscribe();
        this.presenceChannel.enter();
        this.presenceChannel.on("change", this._handlePresenceChange);
      });
    }
  }

  willDestroyElement() {
    this._super(...arguments);

    this.presenceChannel?.leave();
    this.presenceChannel?.unsubscribe();
    this.presenceChannel?.off("change", this._handlePresenceChange);
  }

  @bind
  _handlePresenceChange(channel) {
    this.onChange?.(channel);
  }
}
