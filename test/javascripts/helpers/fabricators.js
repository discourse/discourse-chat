import { Fabricator } from "./fabricator";
import ChatChannel, {
  CHATABLE_TYPES,
} from "discourse/plugins/discourse-chat/discourse/models/chat-channel";
import EmberObject from "@ember/object";
import { Fabricator } from "./fabricator";

const userFabricator = Fabricator(EmberObject, {
  id: 1,
  username: "hawk",
  name: null,
  avatar_template: "/letter_avatar_proxy/v3/letter/t/41988e/{size}.png",
});

const categoryChatableFabricator = Fabricator(EmberObject, {
  id: 1,
  color: "D56353",
  read_restricted: false,
  name: "My category",
});

const directChannelChatableFabricator = Fabricator(EmberObject, {
  users: [userFabricator({ id: 1, username: "bob" })],
});

export default {
  chatChannel: Fabricator(ChatChannel, {
    id: 1,
    chatable_type: CHATABLE_TYPES.categoryChannel,
    status: "open",
    title: "My category title",
    name: "My category name",
    chatable: categoryChatableFabricator(),
  }),

  chatChannelMessage: Fabricator(EmberObject, {
    id: 1,
    chat_channel_id: 1,
    user_id: 1,
    cooked: "This is a test message",
  }),

  directMessageChatChannel: Fabricator(ChatChannel, {
    id: 1,
    chatable_type: CHATABLE_TYPES.directMessageChannel,
    status: "open",
    chatable: directChannelChatableFabricator(),
  }),
};
