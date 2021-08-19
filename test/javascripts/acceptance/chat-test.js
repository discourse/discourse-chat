import I18n from "I18n";
import {
  acceptance,
  count,
  exists,
  publishToMessageBus,
  query,
  queryAll,
  updateCurrentUser,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import { click, triggerKeyEvent, visit } from "@ember/test-helpers";
import { test } from "qunit";
import {
  chatChannels,
  chatView,
  directMessageChannel,
  messageContents,
  siteChannel,
} from "discourse/plugins/discourse-topic-chat/chat-fixtures";
import { next } from "@ember/runloop";

const userNeeds = (unreadCounts = {}) => {
  return {
    admin: false,
    moderator: false,
    username: "eviltrout",
    id: 1,
    can_chat: true,
    chat_channel_tracking_state: {
      9: { unread_count: unreadCounts["9"] || 0, chatable_type: "Site" },
      7: { unread_count: unreadCounts["7"] || 0, chatable_type: "Topic" },
      4: { unread_count: unreadCounts["4"] || 0, chatable_type: "Topic" },
      11: { unread_count: unreadCounts["11"] || 0, chatable_type: "Topic" },
      75: {
        unread_count: unreadCounts["75"] || 0,
        chatable_type: "DirectMessageChannel",
      }, // Direct message channel
    },
  };
};

const chatPretenders = (server, helper) => {
  server.get("/chat/index.json", () => helper.response(chatChannels));
  server.get("/chat/:chatChannelId/messages.json", () =>
    helper.response(chatView)
  );
  server.get("/chat/9.json", () => helper.response(siteChannel));
  server.get("/chat/75.json", () => helper.response(directMessageChannel));
  server.post("/chat/:chatChannelId.json", () => {
    return helper.response({ success: "OK" });
  });
};

acceptance("Discourse Chat - without unread", function (needs) {
  needs.user();
  needs.settings({
    topic_chat_enabled: true,
  });
  needs.pretender(chatPretenders);
  needs.hooks.beforeEach(() => {
    updateCurrentUser(userNeeds());
  });

  test("Chat float can be opened and channels are populated", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click(".header-dropdown-toggle.open-chat");

    assert.ok(visible(".topic-chat-float-container"), "chat float is visible");
    assert.equal(
      count(".topic-chat-float-container .public-channels .chat-channel-row"),
      4,
      "it show public channel rows"
    );
    assert.equal(
      count(
        ".topic-chat-float-container .direct-message-channels .chat-channel-row"
      ),
      1,
      "it shows DM channel rows"
    );
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
    needs.user();
    needs.settings({
      topic_chat_enabled: true,
    });
    needs.pretender(chatPretenders);
    needs.hooks.beforeEach(() => {
      updateCurrentUser(userNeeds({ 9: 2 }));
    });

    test("Chat opens to channel with unread messages", async function (assert) {
      await visit("/t/internationalization-localization/280");
      await click(".header-dropdown-toggle.open-chat");

      assert.ok(
        exists(".topic-chat-float-container .tc-messages-scroll"),
        "The messages scroll container is present"
      );
    });

    test("Unread header indicator and unread count on channel row are present", async function (assert) {
      await visit("/t/internationalization-localization/280");

      assert.ok(
        exists(
          ".header-dropdown-toggle.open-chat .unread-chat-messages-indicator"
        ),
        "Unread indicator present in header"
      );

      await click(".header-dropdown-toggle.open-chat");
      // Automatically placed in site channel. Go back to index and check channel row
      await click(".return-to-channels");

      assert.ok(
        exists(".chat-channel-row .unread-chat-messages-indicator"),
        "Unread indicator present in chat channel row"
      );

      assert.equal(
        query(
          ".chat-channel-row .chat-channel-row-unread-count"
        ).innerText.trim(),
        I18n.t("chat.unread_count", { count: 2 })
      );
    });
  }
);

acceptance(
  "Discourse Chat - Acceptance Test with unread DMs and public channel messages",
  function (needs) {
    needs.user();
    needs.settings({
      topic_chat_enabled: true,
    });
    needs.pretender(chatPretenders);
    needs.hooks.beforeEach(() => {
      updateCurrentUser(userNeeds({ 9: 2, 75: 2 }));
    });

    test("Chat opens to DM channel with unread messages", async function (assert) {
      await visit("/t/internationalization-localization/280");
      await click(".header-dropdown-toggle.open-chat");

      assert.ok(
        exists(".topic-chat-float-container .tc-messages-scroll"),
        "The messages scroll container is present"
      );
      assert.ok(
        exists(`.topic-chat-container.channel-75`),
        "Active channel id matches direct message channel id"
      );
    });
  }
);
