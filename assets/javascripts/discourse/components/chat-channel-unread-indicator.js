import discourseComputed from "discourse-common/utils/decorators";
import Component from "@ember/component";
import { equal, gt } from "@ember/object/computed";
import { CHATABLE_TYPES } from "discourse/plugins/discourse-chat/discourse/models/chat-channel";

export default Component.extend({
  tagName: "",
  channel: null,

  isDirectMessage: equal(
    "channel.chatable_type",
    CHATABLE_TYPES.directMessageChannel
  ),

  hasUnread: gt("unreadCount", 0),

  @discourseComputed(
    "currentUser.chat_channel_tracking_state.@each.{unread_count,unread_mentions}"
  )
  channelTrackingState(state) {
    return state[this.channel.id];
  },

  @discourseComputed(
    "channelTrackingState.unread_mentions",
    "channel",
    "isDirectMessage"
  )
  isUrgent(unreadMentions, channel, isDirectMessage) {
    if (!channel) {
      return;
    }

    return isDirectMessage || unreadMentions > 0;
  },

  @discourseComputed("channelTrackingState.unread_count", "channel")
  unreadCount(unreadCount, channel) {
    if (!channel) {
      return;
    }

    return unreadCount || 0;
  },
});
