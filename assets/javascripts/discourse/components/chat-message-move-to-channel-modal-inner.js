import Component from "@ember/component";
import { isTesting } from "discourse-common/config/environment";
import { later } from "@ember/runloop";
import { isEmpty } from "@ember/utils";
import I18n from "I18n";
import discourseComputed from "discourse-common/utils/decorators";
import { action, computed } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import { inject as service } from "@ember/service";
import { popupAjaxError } from "discourse/lib/ajax-error";

export default class MoveToChannelModalInner extends Component {
  @service chat;
  @service router;
  tagName = "";
  sourceChannel = null;
  destinationChannelId = null;
  selectedMessageIds = null;
  channels = null;

  didInsertElement() {
    this._super(...arguments);
    this._getInitialChannels();
  }

  _getInitialChannels() {
    return this.chat.getChannels().then((channels) => {
      this.set("channels", channels);
    });
  }

  @computed("channels.publicChannels")
  get publicChannels() {
    if (!this.channels) {
      return [];
    }
    return this.channels.publicChannels
      .concat(this.channels.directMessageChannels)
      .reject((chan) => chan.id === this.sourceChannel.id);
  }

  get selectedMessageCount() {
    return this.selectedMessageIds.length;
  }

  @action
  moveMessages() {
    return ajax(
      `/chat/${this.sourceChannel.id}/move_messages_to_channel.json`,
      {
        method: "PUT",
        data: {
          message_ids: this.selectedMessageIds,
          destination_channel_id: this.destinationChannelId,
        },
      }
    )
      .then((response) => {
        return this.router.transitionTo(
          "chat.channel",
          response.destination_channel_id,
          response.destination_channel_title,
          {
            queryParams: { messageId: response.first_moved_message_id },
          }
        );
      })
      .catch(popupAjaxError);
  }
}
