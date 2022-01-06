import discourseComputed from "discourse-common/utils/decorators";
import Component from "@ember/component";
import { equal, gt, reads } from "@ember/object/computed";
import { CHATABLE_TYPES } from "discourse/plugins/discourse-chat/discourse/models/chat-channel";

export default Component.extend({
  tagName: "",
  channel: null,

  isDirectMessage: equal(
    "channel.chatable_type",
    CHATABLE_TYPES.directMessageChannel
  ),

  hasUnread: gt("unreadCount", 0),

  currentUserTrackingState: reads("currentUser.chat_channel_tracking_state"),

  @discourseComputed("currentUserTrackingState", "channel", "isDirectMessage")
  isUrgent(trackingState, channel, isDirectMessage) {
    if (!channel) {
      return;
    }

    return isDirectMessage || trackingState?.[channel.id]?.unread_mentions > 0;
  },

  @discourseComputed("currentUserTrackingState", "channel")
  unreadCount(trackingState, channel) {
    if (!channel) {
      return;
    }

    return trackingState?.[channel.id]?.unread_count || 0;
  },
});
