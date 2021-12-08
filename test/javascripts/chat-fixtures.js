import { cloneJSON } from "discourse-common/lib/object";
export const messageContents = ["Hello world", "What up", "heyo!"];
export const siteChannel = {
  chat_channel: {
    chatable: null,
    chatable_id: -1,
    chatable_type: "Site",
    chatable_url: "http://localhost:3000",
    id: 9,
    title: "Site",
    unread_count: 0,
    muted: false,
  },
};
export const directMessageChannel = {
  chat_channel: {
    chatable: {
      users: [
        { id: 1, username: "markvanlan" },
        { id: 2, username: "hawk" },
      ],
    },
    chatable_id: 58,
    chatable_type: "DirectMessageChannel",
    chatable_url: null,
    id: 75,
    title: "@hawk",
    unread_count: 0,
    muted: false,
  },
};

export const chatChannels = {
  public_channels: [
    siteChannel.chat_channel,
    {
      id: 7,
      chatable_id: 1,
      chatable_type: "Category",
      chatable_url: "/c/uncategorized/1",
      title: "Uncategorized",
      unread_count: 0,
      muted: false,
      chatable: {
        id: 1,
        name: "Uncategorized",
        color: "0088CC",
        text_color: "FFFFFF",
        slug: "uncategorized",
      },
    },

    {
      id: 4,
      chatable_id: 12,
      chatable_type: "Topic",
      chatable_url: "http://localhost:3000/t/small-action-testing-topic/12",
      title: "Small action - testing topic",
      unread_count: 0,
      muted: false,
      chatable: {
        id: 12,
        title: "Small action - testing topic",
        fancy_title: "Small action - testing topic",
        slug: "small-action-testing-topic",
        posts_count: 1,
      },
    },
    {
      id: 11,
      chatable_id: 80,
      chatable_type: "Topic",
      chatable_url:
        "http://localhost:3000/t/coolest-thing-you-have-seen-today/80",
      title: "Coolest thing you have seen today",
      unread_count: 0,
      muted: false,
      chatable: {
        id: 80,
        title: "Coolest thing you have seen today",
        fancy_title: "Coolest thing you have seen today",
        slug: "coolest-thing-you-have-seen-today",
        posts_count: 100,
      },
    },
  ],
  direct_message_channels: [directMessageChannel.chat_channel],
};

function addSettingsAttrs(channel) {
  channel.following = true;
  channel.desktop_notification_level = "mention";
  channel.mobile_notification_level = "mention";
}

export function allChannels() {
  let channels = cloneJSON(chatChannels);

  channels.public_channels.forEach((c) => {
    addSettingsAttrs(c);
  });
  return channels.public_channels;
}

const messages = [
  {
    id: 174,
    message: messageContents[0],
    cooked: messageContents[0],
    excerpt: messageContents[0],
    action_code: null,
    created_at: "2021-07-20T08:14:16.950Z",
    flag_count: 0,
    user: {
      id: 1,
      username: "markvanlan",
      name: null,
      avatar_template: "/letter_avatar_proxy/v4/letter/m/48db29/{size}.png",
    },
  },
  {
    id: 175,
    message: messageContents[1],
    cooked: messageContents[1],
    excerpt: messageContents[1],
    action_code: null,
    created_at: "2021-07-20T08:14:22.043Z",
    flag_count: 0,
    user: {
      id: 2,
      username: "hawk",
      name: null,
      avatar_template: "/letter_avatar_proxy/v4/letter/m/48db29/{size}.png",
    },
    uploads: [
      {
        extension: "pdf",
        filesize: 861550,
        height: null,
        human_filesize: "841 KB",
        id: 38,
        original_filename: "Chat message PDF!",
        retain_hours: null,
        short_path: "/uploads/short-url/vYozObYao54I6G3x8wvOf73epfX.pdf",
        short_url: "upload://vYozObYao54I6G3x8wvOf73epfX.pdf",
        thumbnail_height: null,
        thumbnail_width: null,
        url:
          "//localhost:3000/uploads/default/original/1X/e0172973d7eff927b875995eb86b162da961b9e1.pdf",
        width: null,
      },
    ],
  },
];

export const chatView = {
  chat_messages: messages.concat([
    {
      id: 176,
      message: messageContents[2],
      cooked: messageContents[2],
      excerpt: messageContents[2],
      action_code: null,
      created_at: "2021-07-20T08:14:25.043Z",
      flag_count: 0,
      user: {
        id: 2,
        username: "hawk",
        name: null,
        avatar_template: "/letter_avatar_proxy/v4/letter/m/48db29/{size}.png",
      },
      in_reply_to: messages[1],
      uploads: [
        {
          extension: "png",
          filesize: 50419,
          height: 393,
          human_filesize: "49.2 KB",
          id: 37,
          original_filename: "image.png",
          retain_hours: null,
          short_path: "/uploads/short-url/2LbadI7uOM7JsXyVoc12dHUjJYo.png",
          short_url: "upload://2LbadI7uOM7JsXyVoc12dHUjJYo.png",
          thumbnail_height: 224,
          thumbnail_width: 689,
          url:
            "//localhost:3000/uploads/default/original/1X/1359a8a1c9489ad31ef9385df8c46b02740d981c.png",
          width: 1209,
        },
      ],
      reactions: {
        heart: {
          count: 1,
          reacted: false,
          users: [{ id: 99, username: "im-penar" }],
        },
        kiwi_fruit: {
          count: 2,
          reacted: true,
          users: [{ id: 99, username: "im-penar" }],
        },
        tada: {
          count: 1,
          reacted: true,
          users: [],
        },
      },
    },
  ]),
};
