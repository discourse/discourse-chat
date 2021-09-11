import {
  acceptance,
  exists,
  publishToMessageBus,
  query,
  queryAll,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import { click, triggerKeyEvent, visit } from "@ember/test-helpers";
import { test } from "qunit";
import {
  allChannels,
  chatChannels,
  chatView,
  directMessageChannel,
  messageContents,
  siteChannel,
} from "discourse/plugins/discourse-topic-chat/chat-fixtures";
import { next } from "@ember/runloop";

const baseChatPretenders = (server, helper) => {
  server.get("/chat/:chatChannelId/messages.json", () =>
    helper.response(chatView)
  );
  server.post("/chat/:chatChannelId.json", () => {
    return helper.response({ success: "OK" });
  });

  // TODO(david): Should these be part of core?
  server.post("/presence/update", () => {
    return helper.response({ success: "OK" });
  });
  server.get("/presence/get", () => {
    return helper.response({ count: 0, users: [], next_message_id: 0 });
  });
};

function siteChannelPretender(
  server,
  helper,
  opts = { unread_count: 0, muted: false }
) {
  let copy = Object.assign({}, siteChannel);
  copy.chat_channel.unread_count = opts.unread_count;
  copy.chat_channel.muted = opts.muted;
  server.get("/chat/chat_channels/9.json", () => helper.response(copy));
}

function directMessageChannelPretender(
  server,
  helper,
  opts = { unread_count: 0, muted: false }
) {
  let copy = Object.assign({}, directMessageChannel);
  copy.chat_channel.unread_count = opts.unread_count;
  copy.chat_channel.muted = opts.muted;
  server.get("/chat/chat_channels/75.json", () => helper.response(copy));
}

function chatChannelPretender(server, helper, changes = []) {
  // changes is [{ id: X, unread_count: Y, muted: true}]
  let copy = Object.assign({}, chatChannels);
  changes.forEach((change) => {
    let found = false;
    found = copy.public_channels.find((c) => c.id === change.id);
    if (found) {
      found.unread_count = change.unread_count;
      found.muted = change.muted;
    }
    if (!found) {
      found = copy.direct_message_channels.find((c) => c.id === change.id);
      if (found) {
        found.unread_count = change.unread_count;
        found.muted = change.muted;
      }
    }
  });
  server.get("/chat/chat_channels.json", () => helper.response(copy));
}

acceptance("Discourse Chat - without unread", function (needs) {
  needs.user({
    admin: false,
    moderator: false,
    username: "eviltrout",
    id: 1,
    can_chat: true,
  });
  needs.settings({
    topic_chat_enabled: true,
  });
  needs.pretender((server, helper) => {
    baseChatPretenders(server, helper);
    siteChannelPretender(server, helper);
    directMessageChannelPretender(server, helper);
    chatChannelPretender(server, helper);
  });

  const enterFirstChatChannel = async function () {
    await visit("/t/internationalization-localization/280");
    await click(".header-dropdown-toggle.open-chat");
    await click(".public-channels .chat-channel-row");
  };

  test("Chat messages are populated when a channel is entered", async function (assert) {
    await enterFirstChatChannel();
    const messages = queryAll(".tc-message .tc-text");
    assert.equal(messages[0].textContent.trim(), messageContents[0]);
    assert.equal(messages[1].textContent.trim(), messageContents[1]);
  });

  test("Message controls are present and correct for permissions", async function (assert) {
    await enterFirstChatChannel();
    const messages = queryAll(".tc-message");

    // User created this message
    assert.ok(
      messages[0].querySelector(".reply-btn"),
      "it shows the reply button"
    );
    assert.ok(
      messages[0].querySelector(".edit-btn"),
      "it shows the edit button"
    );
    assert.notOk(
      messages[0].querySelector(".flag-btn"),
      "it hides the flag button"
    );
    assert.ok(
      messages[0].querySelector(".delete-btn"),
      "it shows the delete button"
    );

    // User _didn't_ create this message
    assert.ok(
      messages[1].querySelector(".reply-btn"),
      "it shows the reply button"
    );
    assert.notOk(
      messages[1].querySelector(".edit-btn"),
      "it hides the edit button"
    );
    assert.ok(
      messages[1].querySelector(".flag-btn"),
      "it shows the flag button"
    );
    assert.notOk(
      messages[1].querySelector(".delete-btn"),
      "it hides the delete button"
    );
  });

  test("pressing the reply button adds the indicator to the composer", async function (assert) {
    await enterFirstChatChannel();
    await click(".reply-btn");
    assert.ok(
      exists(".tc-composer-message-details .d-icon-reply"),
      "Reply icon is present"
    );
    assert.equal(
      query(".tc-composer-message-details .tc-reply-username").innerText.trim(),
      "markvanlan"
    );
  });

  test("pressing the edit button fills the composer and indicates edit", async function (assert) {
    await enterFirstChatChannel();
    await click(".edit-btn");
    assert.ok(
      exists(".tc-composer-message-details .d-icon-pencil-alt"),
      "Edit icon is present"
    );
    assert.equal(
      query(".tc-composer-message-details .tc-reply-username").innerText.trim(),
      "markvanlan"
    );

    assert.equal(query(".tc-composer-input").value.trim(), messageContents[0]);
  });

  test("Sending a message", async function (assert) {
    await enterFirstChatChannel();
    const messageContent = "Here's a message";
    const composerInput = query(".tc-composer-input");
    await fillIn(composerInput, messageContent);
    await focus(composerInput);
    await triggerKeyEvent(composerInput, "keydown", 13); // 13 is enter keycode

    // Composer input is cleared
    assert.equal(composerInput.innerText.trim(), "");

    let messages = queryAll(".tc-message");
    let lastMessage = messages[messages.length - 1];

    // Message is staged, without an ID
    assert.ok(lastMessage.classList.contains("tc-message-staged"));

    // Last message was from a different user; full meta data is shown
    assert.ok(lastMessage.querySelector(".tc-avatar"), "Avatar is present");
    assert.ok(lastMessage.querySelector(".full-name"), "Username is present");
    assert.equal(
      lastMessage.querySelector(".tc-text").innerText.trim(),
      messageContent
    );

    publishToMessageBus("/chat/9", {
      typ: "sent",
      stagedId: 1,
      topic_chat_message: {
        id: 202,
        user: {
          id: 1,
        },
      },
    });

    const done = assert.async();
    next(async () => {
      // Wait for DOM to rerender. Message should be un-staged
      assert.ok(lastMessage.classList.contains("tc-message-202"));
      assert.notOk(lastMessage.classList.contains("tc-message-staged"));

      const nextMessageContent = "What up what up!";
      await fillIn(composerInput, nextMessageContent);
      await focus(composerInput);
      await triggerKeyEvent(composerInput, "keydown", 13); // 13 is enter keycode

      messages = queryAll(".tc-message");
      lastMessage = messages[messages.length - 1];

      // We just sent a message so avatar/username will not be present for the last message
      assert.notOk(
        lastMessage.querySelector(".tc-avatar"),
        "Avatar is not shown"
      );
      assert.notOk(
        lastMessage.querySelector("full-name"),
        "Username is not shown"
      );
      assert.equal(
        lastMessage.querySelector(".tc-text").innerText.trim(),
        nextMessageContent
      );
      done();
    });
  });

  test("Unread indicator increments for public channels when messages come in", async function (assert) {
    await visit("/t/internationalization-localization/280");
    assert.notOk(
      exists(
        ".header-dropdown-toggle.open-chat .unread-chat-messages-indicator"
      )
    );

    publishToMessageBus("/chat/9/new-messages", {
      message_id: 200,
      user_id: 2,
    });
    const done = assert.async();
    next(() => {
      assert.ok(
        exists(
          ".header-dropdown-toggle.open-chat .unread-chat-messages-indicator"
        )
      );
      done();
    });
  });

  test("Unread count increments for direct message channels when messages come in", async function (assert) {
    await visit("/t/internationalization-localization/280");
    assert.notOk(
      exists(".header-dropdown-toggle.open-chat .unread-dm-indicator-number")
    );

    publishToMessageBus("/chat/75/new-messages", {
      message_id: 200,
      user_id: 2,
    });
    const done = assert.async();
    next(() => {
      assert.ok(
        exists(".header-dropdown-toggle.open-chat .unread-dm-indicator-number")
      );
      assert.equal(
        query(
          ".header-dropdown-toggle.open-chat .unread-dm-indicator-number"
        ).innerText.trim(),
        1
      );
      done();
    });
  });

  test("Unread DM count overrides the public unread indicator", async function (assert) {
    await visit("/t/internationalization-localization/280");
    publishToMessageBus("/chat/9/new-messages", {
      message_id: 200,
      user_id: 2,
    });
    publishToMessageBus("/chat/75/new-messages", {
      message_id: 200,
      user_id: 2,
    });
    const done = assert.async();
    next(() => {
      assert.notOk(
        exists(
          ".header-dropdown-toggle.open-chat .unread-chat-messages-indicator"
        )
      );
      assert.ok(
        exists(".header-dropdown-toggle.open-chat .unread-dm-indicator-number")
      );
      done();
    });
  });
});

acceptance(
  "Discourse Chat - Acceptance Test with unread public channel messages",
  function (needs) {
    needs.user({
      admin: false,
      moderator: false,
      username: "eviltrout",
      id: 1,
      can_chat: true,
    });
    needs.settings({
      topic_chat_enabled: true,
    });
    needs.pretender((server, helper) => {
      baseChatPretenders(server, helper);
      siteChannelPretender(server, helper);
      directMessageChannelPretender(server, helper);
      chatChannelPretender(server, helper, [
        { id: 7, unread_count: 2, muted: false },
      ]);
    });

    test("Chat opens to full-page channel with unread messages when sidebar is installed", async function (assert) {
      await visit("/t/internationalization-localization/280");
      this.container.lookup("service:chat").setSidebarActive(true);
      await click(".header-dropdown-toggle.open-chat");

      const channelWithUnread = chatChannels.public_channels.find(
        (c) => c.id === 7
      );
      assert.equal(currentURL(), `/chat/channel/${channelWithUnread.title}`);
      assert.notOk(
        visible(".topic-chat-float-container"),
        "chat float is not open"
      );
    });

    test("Chat float opens on header icon click when sidebar is not installed", async function (assert) {
      await visit("/t/internationalization-localization/280");
      this.container.lookup("service:chat").setSidebarActive(false);
      await click(".header-dropdown-toggle.open-chat");

      assert.ok(visible(".topic-chat-float-container"), "chat float is open");
      assert.equal(currentURL(), `/t/internationalization-localization/280`);
    });

    test("Unread header indicator is present", async function (assert) {
      await visit("/t/internationalization-localization/280");

      assert.ok(
        exists(
          ".header-dropdown-toggle.open-chat .unread-chat-messages-indicator"
        ),
        "Unread indicator present in header"
      );
    });
  }
);

acceptance(
  "Discourse Chat - Acceptance Test with unread DMs and public channel messages",
  function (needs) {
    needs.user({
      admin: false,
      moderator: false,
      username: "eviltrout",
      id: 1,
      can_chat: true,
    });
    needs.settings({
      topic_chat_enabled: true,
    });
    needs.pretender((server, helper) => {
      baseChatPretenders(server, helper);
      siteChannelPretender(server, helper, { unread_count: 2, muted: false });
      directMessageChannelPretender(server, helper);
      // chat channel with ID 75 is direct message channel.
      chatChannelPretender(server, helper, [
        { id: 9, unread_count: 2, muted: false },
        { id: 75, unread_count: 2, muted: false },
      ]);
    });

    test("Chat float open to DM channel with unread messages with sidebar off", async function (assert) {
      await visit("/t/internationalization-localization/280");
      this.container.lookup("service:chat").setSidebarActive(false);
      await click(".header-dropdown-toggle.open-chat");
      const chatContainer = query(".topic-chat-container");
      assert.ok(chatContainer.classList.contains("channel-75"));
    });

    test("Chat full page open to DM channel with unread messages with sidebar on", async function (assert) {
      await visit("/t/internationalization-localization/280");
      this.container.lookup("service:chat").setSidebarActive(true);
      await click(".header-dropdown-toggle.open-chat");
      const channelWithUnread = chatChannels.direct_message_channels.find(
        (c) => c.id === 75
      );
      assert.equal(currentURL(), `/chat/channel/${channelWithUnread.title}`);
    });

    test("Exit full screen chat button takes you to previous non-chat location", async function (assert) {
      const nonChatPath = "/t/internationalization-localization/280";
      await visit(nonChatPath);
      await visit("/chat/channel/@hawk");
      await visit("/chat/channel/Site");
      await click(".exit-chat-btn");
      assert.equal(currentURL(), nonChatPath);
    });
  }
);

acceptance("Discourse Chat - chat channel settings", function (needs) {
  needs.user({
    admin: false,
    moderator: false,
    username: "eviltrout",
    id: 1,
    can_chat: true,
  });
  needs.settings({
    topic_chat_enabled: true,
  });
  needs.pretender((server, helper) => {
    baseChatPretenders(server, helper);
    siteChannelPretender(server, helper);
    directMessageChannelPretender(server, helper);
    chatChannelPretender(server, helper);
    server.get("/chat/chat_channels/all.json", () => {
      return helper.response(allChannels());
    });
    server.post("/chat/chat_channels/:chatChannelId/unfollow", () => {
      return helper.response({ success: "OK" });
    });
    server.get("/chat/chat_channels/:chatChannelId", () => {
      return helper.response(siteChannel);
    });
    server.post("/chat/chat_channels/:chatChannelId/follow", () => {
      return helper.response(siteChannel.chat_channel);
    });
  });

  test("Chat channel settings modal", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click(".header-dropdown-toggle.open-chat");
    await click(".edit-channel-membership-btn");
    assert.ok(
      exists(".chat-channel-settings-modal"),
      "Chat channel settings modal is open"
    );
    const settingsRow = query(".chat-channel-settings-row");
    assert.ok(
      settingsRow.querySelector(".chat-channel-expand-settings"),
      "Expand notifications button is present"
    );
    assert.ok(
      settingsRow.querySelector(".chat-channel-unfollow"),
      "Unfollow button is present"
    );
    await click(".chat-channel-expand-settings");
    assert.ok(exists(".chat-channel-row-controls"), "Controls are present");

    // Click unfollow!
    await click(".chat-channel-unfollow");
    assert.notOk(
      settingsRow.querySelector(".chat-channel-expand-settings"),
      "Expand notifications button is gone"
    );
    assert.notOk(
      settingsRow.querySelector(".chat-channel-unfollow"),
      "Unfollow button is gone"
    );

    assert.ok(
      settingsRow.querySelector(".chat-channel-preview"),
      "Preview channel button is present"
    );
    assert.ok(
      settingsRow.querySelector(".chat-channel-follow"),
      "Follow button is present"
    );

    // Click preview button!
    await click(".chat-channel-preview");
    assert.equal(currentURL(), "/chat/channel/Site?id=9&previewing=true");
    assert.ok(exists(".join-channel-btn"), "Join channel button is present");

    await click(".join-channel-btn");
    assert.equal(currentURL(), "/chat/channel/Site");
    assert.notOk(exists(".join-channel-btn"), "Join channel button is gone");
  });
});
