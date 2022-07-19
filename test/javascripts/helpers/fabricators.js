import ChatChannel, {
  CHATABLE_TYPES,
} from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import { Fabricator } from "./fabricator";
import EmberObject from "@ember/object";

const userFabricator = Fabricator({
  id: 1,
  username: "hawk",
  name: null,
  avatar_template:
    "https://avatars.discourse.org/v3/letter/t/41988e/{size}.png",
});

const categoryChatableFabricator = Fabricator({
  id: 1,
  color: "D56353",
  read_restricted: false,
  name: "My category",
});

const directChannelChatableFabricator = Fabricator({
  users: [userFabricator({ id: 1, username: "bob" })],
});

const chatChannelMessageFabricator = Fabricator({
  id: 1,
  chat_channel_id: 1,
  user_id: 1,
  cooked: "This is a test message",
});

const directMessageChannelFabricator = Fabricator({
  id: 1,
  chatable_type: CHATABLE_TYPES.directMessageChannel,
  status: "open",
  chatable: directChannelChatableFabricator(),
  __model: "ChatChannel",
});

const chatChannelFabricator = Fabricator({
  id: 1,
  chatable_type: CHATABLE_TYPES.categoryChannel,
  status: "open",
  title: "My category title",
  name: "My category name",
  chatable: categoryChatableFabricator(),
  __model: "ChatChannel",
});

export default {
  chatChannel: (options) => chatChannelFabricator(options),
  directMessageChatChannel: (options) =>
    directMessageChannelFabricator(options),
  chatChannelMessage: (options) =>
    EmberObject.create(chatChannelMessageFabricator(options)),
};
