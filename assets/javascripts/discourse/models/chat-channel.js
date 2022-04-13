import RestModel from "discourse/models/rest";
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

export function channelStatusIcon(channelStatus) {
  if (channelStatus === CHANNEL_STATUSES.open) {
    return null;
  }

  switch (channelStatus) {
    case CHANNEL_STATUSES.closed:
      return "lock";
      break;
    case CHANNEL_STATUSES.readOnly:
      return "comment-slash";
      break;
    case CHANNEL_STATUSES.archived:
      return "archive";
      break;
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

const ChatChannel = RestModel.extend({
  canModifyMessages(user) {
    if (user.staff) {
      return !STAFF_READONLY_STATUSES.includes(this.status);
    }

    return !READONLY_STATUSES.includes(this.status);
  },

  isDraft: false,

  get isDirectMessageChannel() {
    return this.chatable_type === CHATABLE_TYPES.directMessageChannel;
  },

  get isTopicChannel() {
    return this.chatable_type === CHATABLE_TYPES.topicChannel;
  },

  get isCategoryChannel() {
    return this.chatable_type === CHATABLE_TYPES.categoryChannel;
  },

  get isTagChannel() {
    return this.chatable_type === CHATABLE_TYPES.tagChannel;
  },

  get isOpen() {
    return this.status === CHANNEL_STATUSES.open;
  },

  get isReadOnly() {
    return this.status === CHANNEL_STATUSES.readOnly;
  },

  get isClosed() {
    return this.status === CHANNEL_STATUSES.closed;
  },

  get isArchived() {
    return this.status === CHANNEL_STATUSES.archived;
  },
});

export function createDirectMessageChannelDraft() {
  return ChatChannel.create({
    id: "draft",
    isDraft: true,
    title: I18n.t("chat.direct_message_creator.title"),
    chatable_type: CHATABLE_TYPES.directMessageChannel,
    chatable: {
      users: [],
    },
  });
}

export default ChatChannel;
