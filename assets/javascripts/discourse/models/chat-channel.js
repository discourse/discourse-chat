import I18n from "I18n";

export const CHATABLE_TYPES = {
  directMessageChannel: "DirectMessageChannel",
  topicChannel: "Topic",
  tagChannel: "Tag",
  categoryChannel: "Category",
};
export const CHANNEL_STATUSES = {
  open: "open",
  readOnly: "read_only",
  closed: "closed",
  archived: "archived",
};

export function channelStatusName(channelStatus) {
  switch (channelStatus) {
    case CHANNEL_STATUSES.open:
      return I18n.t("chat.channel_status.open");
    case CHANNEL_STATUSES.readOnly:
      return I18n.t("chat.channel_status.read_only");
    case CHANNEL_STATUSES.closed:
      return I18n.t("chat.channel_status.closed");
    case CHANNEL_STATUSES.archived:
      return I18n.t("chat.channel_status.archived");
  }
}

const STAFF_READONLY_STATUSES = [
  CHANNEL_STATUSES.readOnly,
  CHANNEL_STATUSES.archived,
];

const READONLY_STATUSES = [
  CHANNEL_STATUSES.closed,
  CHANNEL_STATUSES.readOnly,
  CHANNEL_STATUSES.archived,
];

import RestModel from "discourse/models/rest";
export default RestModel.extend({
  canModifyMessages(user) {
    if (user.staff) {
      return !STAFF_READONLY_STATUSES.includes(this.status);
    }

    return !READONLY_STATUSES.includes(this.status);
  },

  isDirectMessageChannel() {
    return this.chatable_type === CHATABLE_TYPES.directMessageChannel;
  },

  isTopicChannel() {
    return this.chatable_type === CHATABLE_TYPES.topicChannel;
  },

  isCategoryChannel() {
    return this.chatable_type === CHATABLE_TYPES.categoryChannel;
  },

  isTagChannel() {
    return this.chatable_type === CHATABLE_TYPES.tagChannel;
  },
});
