import ChatChannel, {
  CHATABLE_TYPES,
} from "discourse/plugins/discourse-chat/discourse/models/chat-channel";

function defaultChatChannelForType(chatableType) {
  const base = {
    id: 1,
    chatable_type: chatableType,
    chatable: {
      users: [
        {
          id: 1,
          username: "hawk",
          name: null,
          avatar_template:
            "https://avatars.discourse.org/v3/letter/t/41988e/{size}.png",
        },
      ],
    },
  };

  if (chatableType === CHATABLE_TYPES.topicChannel) {
    base.title = "My topic title";
  }

  if (chatableType === CHATABLE_TYPES.categoryChannel) {
    base.title = "My category title";
    base.chatable = { color: "D56353", read_restricted: false };
  }

  return base;
}

export default function fabricate(model, options = {}) {
  let base;

  if (model === "chat-channel") {
    base = defaultChatChannelForType(
      options.chatable_type || CHATABLE_TYPES.topicChannel
    );
  } else {
    throw `Unkown fabricator ${model}`;
  }

  const final = Object.assign(base, options);
  switch (model) {
    case "chat-channel":
      return ChatChannel.create(final);
  }
}
