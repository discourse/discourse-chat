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

  @discourseComputed("currentUserTrackingState")
  isUrgent(trackingState) {
    if (!this.channel) {
      return;
    }

    return (
      this.isDirectMessage ||
      trackingState?.[this.channel.id]?.unread_mentions > 0
    );
  },

  @discourseComputed("currentUserTrackingState")
  unreadCount(trackingState) {
    if (!this.channel) {
      return;
    }

    return trackingState?.[this.channel.id]?.unread_count || 0;
  },
});
