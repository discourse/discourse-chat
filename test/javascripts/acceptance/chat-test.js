import {
  acceptance,
  exists,
  loggedInUser,
  publishToMessageBus,
  query,
  queryAll,
  updateCurrentUser,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import {
  click,
  currentURL,
  fillIn,
  settled,
  triggerEvent,
  triggerKeyEvent,
  visit,
} from "@ember/test-helpers";
import { skip, test } from "qunit";
import {
  allChannels,
  chatChannels,
  chatView,
  directMessageChannels,
  messageContents,
  siteChannel,
} from "discourse/plugins/discourse-chat/chat-fixtures";
import Session from "discourse/models/session";
import { cloneJSON } from "discourse-common/lib/object";
import { presentUserIds } from "discourse/tests/helpers/presence-pretender";
import User from "discourse/models/user";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import { next } from "@ember/runloop";
import { Promise } from "rsvp";
import { isLegacyEmber } from "discourse-common/config/environment";
import sinon from "sinon";
import * as ajaxlib from "discourse/lib/ajax";

const chatSettled = async () => {
  await settled();
  if (isLegacyEmber()) {
    // In the legacy environment, settled() doesn't always seem to work for us
    // Using `next()` seems to work around the problem
    // This hack can be removed once we're 100% Ember CLI
    await new Promise((resolve) => {
      next(resolve);
    });
  }
};

const baseChatPretenders = (server, helper) => {
  server.get("/chat/:chatChannelId/messages.json", () =>
    helper.response(chatView)
  );
  server.post("/chat/:chatChannelId.json", () => {
    return helper.response({ success: "OK" });
  });
  server.get("/notifications", () => {
    return helper.response({
      notifications: [
        {
          id: 42,
          user_id: 1,
          notification_type: 29,
          read: false,
          high_priority: true,
          created_at: "2021-01-01 12:00:00 UTC",
          fancy_title: "First notification",
          post_number: null,
          topic_id: null,
          slug: null,
          data: {
            message: "notifications.popup.chat_mention",
            chat_message_id: 174,
            chat_channel_id: 9,
            chat_channel_title: "Site",
            mentioned_by_username: "hawk",
          },
        },
        {
          id: 43,
          user_id: 1,
          notification_type: 32,
          read: false,
          high_priority: true,
          created_at: "2021-01-01 12:00:00 UTC",
          fancy_title: "First notification",
          post_number: null,
          topic_id: null,
          slug: null,
          data: {
            message: "notifications.popup.chat_group_mention",
            group_name: "engineers",
            chat_message_id: 174,
            chat_channel_id: 9,
            chat_channel_title: "Site",
            mentioned_by_username: "hawk",
          },
        },
      ],
      seen_notification_id: null,
    });
  });
  server.get("/chat/lookup/:message_id.json", () => helper.response(chatView));
  server.post("/uploads/lookup-urls", () => {
    return helper.response([]);
  });
};

function siteChannelPretender(
  server,
  helper,
  opts = { unread_count: 0, muted: false }
) {
  let copy = cloneJSON(siteChannel);
  copy.chat_channel.unread_count = opts.unread_count;
  copy.chat_channel.muted = opts.muted;
  server.get("/chat/chat_channels/9.json", () => helper.response(copy));
}

function directMessageChannelPretender(
  server,
  helper,
  opts = { unread_count: 0, muted: false }
) {
  let copy = cloneJSON(directMessageChannels[0]);
  copy.chat_channel.unread_count = opts.unread_count;
  copy.chat_channel.muted = opts.muted;
  server.get("/chat/chat_channels/75.json", () => helper.response(copy));
}

function chatChannelPretender(server, helper, changes = []) {
  // changes is [{ id: X, unread_count: Y, muted: true}]
  let copy = cloneJSON(chatChannels);
  changes.forEach((change) => {
    let found;
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

acceptance("Discourse Chat - anonymouse 🐭 user", function (needs) {
  needs.settings({
    chat_enabled: true,
  });

  test("doesn't error for anonymous users", async function (assert) {
    await visit("");
    assert.ok(true, "no errors on homepage");
  });
});

acceptance("Discourse Chat - without unread", function (needs) {
  needs.user({
    admin: false,
    moderator: false,
    username: "eviltrout",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });
  needs.settings({
    chat_enabled: true,
  });
  needs.pretender((server, helper) => {
    baseChatPretenders(server, helper);
    siteChannelPretender(server, helper);
    directMessageChannelPretender(server, helper);
    chatChannelPretender(server, helper);
    const hawkAsJson = {
      username: "hawk",
      id: 2,
      name: "hawk",
      avatar_template:
        "https://avatars.discourse.org/v3/letter/t/41988e/{size}.png",
    };
    server.get("/u/search/users", () => {
      return helper.response({
        users: [hawkAsJson],
      });
    });

    server.put(
      "/chat/:chat_channel_id/react/:message_id.json",
      helper.response
    );

    server.put("/chat/:chat_channel_id/invite", helper.response);
    server.post("/chat/direct_messages/create.json", () => {
      return helper.response({
        chat_channel: {
          chat_channels: [],
          chatable: { users: [hawkAsJson] },
          chatable_id: 16,
          chatable_type: "DirectMessageChannel",
          chatable_url: null,
          id: 75,
          last_read_message_id: null,
          title: "@hawk",
          unread_count: 0,
          unread_mentions: 0,
          updated_at: "2021-11-08T21:26:05.710Z",
        },
      });
    });
    server.post("/chat/chat_channels/:chatChannelId/unfollow", () => {
      return helper.response({ success: "OK" });
    });
  });
  needs.hooks.beforeEach(function () {
    Object.defineProperty(this, "chatService", {
      get: () => this.container.lookup("service:chat"),
    });
    Object.defineProperty(this, "appEvents", {
      get: () => this.container.lookup("service:appEvents"),
    });
    Session.current().highlightJsPath =
      "/assets/highlightjs/highlight-test-bundle.min.js";
  });

  test("Clicking mention notification from outside chat opens the float", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click(".header-dropdown-toggle.current-user");
    await click("#quick-access-notifications .chat-mention");
    assert.ok(visible(".topic-chat-float-container"), "chat float is open");
    assert.ok(query(".topic-chat-container").classList.contains("channel-9"));
  });

  test("Clicking mention notification inside other full page channel switches the channel", async function (assert) {
    await visit("/chat/channel/75/@hawk");
    await click(".header-dropdown-toggle.current-user");
    await click("#quick-access-notifications .chat-mention");
    assert.equal(currentURL(), `/chat/channel/9/Site`);
  });

  test("Clicking mention notification inside other full page channel switches the channel", async function (assert) {
    await visit("/chat/channel/75/@hawk");
    await click(".header-dropdown-toggle.current-user");
    await click("#quick-access-notifications .chat-mention");
    assert.equal(currentURL(), `/chat/channel/9/Site`);
  });

  test("Regular mention uses the `@` icon", async function (assert) {
    await visit("/chat/channel/75/@hawk");
    await click(".header-dropdown-toggle.current-user");
    assert.ok(exists("#quick-access-notifications .chat-mention .d-icon-at"));
  });

  test("Group mention uses the users icon", async function (assert) {
    await visit("/chat/channel/75/@hawk");
    await click(".header-dropdown-toggle.current-user");
    assert.ok(
      exists("#quick-access-notifications .chat-group-mention .d-icon-users")
    );
  });

  test("notifications for current user and here/all are highlighted", async function (assert) {
    updateCurrentUser({ username: "osama" });
    await visit("/chat/channel/9/Site");
    // 177 is message id from fixture
    const highlighted = [];
    const notHighlighted = [];
    query(".chat-message-container-177")
      .querySelectorAll(".mention.highlighted")
      .forEach((node) => {
        highlighted.push(node.textContent.trim());
      });
    query(".chat-message-container-177")
      .querySelectorAll(".mention:not(.highlighted)")
      .forEach((node) => {
        notHighlighted.push(node.textContent.trim());
      });
    assert.equal(highlighted.length, 2, "2 mentions are highlighted");
    assert.equal(notHighlighted.length, 1, "1 mention is regular mention");
    assert.ok(highlighted.includes("@here"), "@here mention is highlighted");
    assert.ok(highlighted.includes("@osama"), "@osama mention is highlighted");
    assert.ok(
      notHighlighted.includes("@mark"),
      "@mark mention is not highlighted"
    );
  });

  test("Chat messages are populated when a channel is entered and images are rendered", async function (assert) {
    await visit("/chat/channel/9/Site");
    const messages = queryAll(".chat-message .chat-message-text");
    assert.equal(messages[0].innerText.trim(), messageContents[0]);

    assert.ok(messages[1].querySelector("a.chat-other-upload"));

    assert.equal(
      messages[2].innerText.trim().split("\n")[0],
      messageContents[2]
    );
    assert.ok(messages[2].querySelector("img.chat-img-upload"));
  });

  test("Reply-to line is hidden when reply-to message is directly above", async function (assert) {
    await visit("/chat/channel/9/Site");
    const messages = queryAll(".chat-message-container");
    assert.notOk(messages[1].querySelector(".tc-reply-msg"));
  });

  test("Reply-to line is present when reply-to message is not directly above", async function (assert) {
    await visit("/chat/channel/9/Site");
    const messages = queryAll(".chat-message-container");
    const replyTo = messages[2].querySelector(".tc-reply-msg");
    assert.ok(replyTo);
    assert.equal(replyTo.innerText.trim(), messageContents[0]);
  });

  test("Unfollowing a direct message channel transitions to another channel", async function (assert) {
    await visit("/chat/channel/75/@hawk");
    await click(".chat-channel-row.chat-channel-76 .chat-channel-leave-btn");

    assert.ok(/^\/chat\/channel\/75/.test(currentURL()));

    await click(".chat-channel-row.chat-channel-75 .chat-channel-leave-btn");

    assert.ok(/^\/chat\/channel\/4/.test(currentURL()));
  });

  test("Admin only controls are present", async function (assert) {
    await visit("/chat/channel/9/Site");
    const currentUserDropdown = selectKit(
      ".chat-message-container-174 .more-buttons"
    );
    await currentUserDropdown.expand();

    assert.notOk(
      currentUserDropdown.rowByValue("rebakeMessage").exists(),
      "it doesn’t show the rebake button for non staff"
    );

    await visit("/");
    updateCurrentUser({ admin: true, moderator: true });
    await visit("/chat/channel/9/Site");
    await currentUserDropdown.expand();

    assert.ok(
      currentUserDropdown.rowByValue("rebakeMessage").exists(),
      "it shows the rebake button"
    );
  });

  test("Message controls are present and correct for permissions", async function (assert) {
    await visit("/chat/channel/9/Site");
    const messages = queryAll(".chat-message");

    // User created this message
    assert.ok(
      messages[0].querySelector(".reply-btn"),
      "it shows the reply button"
    );

    const currentUserDropdown = selectKit(
      ".chat-message-container-174 .more-buttons"
    );
    await currentUserDropdown.expand();

    assert.ok(
      currentUserDropdown.rowByValue("copyLinkToMessage").exists(),
      "it shows the link to button"
    );

    assert.notOk(
      currentUserDropdown.rowByValue("rebakeMessage").exists(),
      "it doesn’t show the rebake button to a regular user"
    );

    assert.ok(
      currentUserDropdown.rowByValue("edit").exists(),
      "it shows the edit button"
    );

    assert.notOk(
      currentUserDropdown.rowByValue("flag").exists(),
      "it hides the flag button"
    );

    assert.ok(
      currentUserDropdown.rowByValue("deleteMessage").exists(),
      "it shows the delete button"
    );

    // User _didn't_ create this message
    assert.ok(
      messages[1].querySelector(".reply-btn"),
      "it shows the reply button"
    );

    const notCurrentUserDropdown = selectKit(
      ".chat-message-container-175 .more-buttons"
    );
    await notCurrentUserDropdown.expand();

    assert.ok(
      notCurrentUserDropdown.rowByValue("copyLinkToMessage").exists(),
      "it shows the link to button"
    );

    assert.notOk(
      notCurrentUserDropdown.rowByValue("edit").exists(),
      "it hides the edit button"
    );

    assert.notOk(
      notCurrentUserDropdown.rowByValue("deleteMessage").exists(),
      "it hides the delete button"
    );
  });

  test("pressing the reply button adds the indicator to the composer", async function (assert) {
    await visit("/chat/channel/9/Site");
    await click(".reply-btn");
    assert.ok(
      exists(".chat-composer-message-details .d-icon-reply"),
      "Reply icon is present"
    );
    assert.equal(
      query(
        ".chat-composer-message-details .tc-reply-username"
      ).innerText.trim(),
      "markvanlan"
    );
  });

  test("pressing the edit button fills the composer and indicates edit", async function (assert) {
    await visit("/chat/channel/9/Site");

    const dropdown = selectKit(".more-buttons");
    await dropdown.expand();
    await dropdown.selectRowByValue("edit");

    assert.ok(
      exists(".chat-composer-message-details .d-icon-pencil-alt"),
      "Edit icon is present"
    );
    assert.equal(
      query(
        ".chat-composer-message-details .tc-reply-username"
      ).innerText.trim(),
      "markvanlan"
    );

    assert.equal(
      query(".chat-composer-input").value.trim(),
      messageContents[0]
    );
  });

  test("Reply-to is stored in draft", async function (assert) {
    this.chatService.set("sidebarActive", false);
    await visit("/latest");
    this.appEvents.trigger("chat:toggle-open");
    await chatSettled();
    await click(".return-to-channels");
    await click(".chat-channel-row.chat-channel-9");
    await click(".chat-message-container .reply-btn");
    // Reply-to line is present
    assert.ok(exists(".chat-composer-message-details .tc-reply-display"));
    await click(".return-to-channels");
    await click(".chat-channel-row.chat-channel-7");
    // Reply-to line is gone since switching channels
    assert.notOk(exists(".chat-composer-message-details .tc-reply-display"));
    // Now click on reply btn and cancel it on channel 7
    await click(".chat-message-container .reply-btn");
    await click(".chat-composer .cancel-message-action");

    // Go back to channel 9 and check that reply-to is present
    await click(".return-to-channels");
    await click(".chat-channel-row.chat-channel-9");
    // Now reply-to should be back and loaded from draft
    assert.ok(exists(".chat-composer-message-details .tc-reply-display"));

    // Go back one for time to channel 7 and make sure reply-to is gone
    await click(".return-to-channels");
    await click(".chat-channel-row.chat-channel-7");
    assert.notOk(exists(".chat-composer-message-details .tc-reply-display"));
  });

  test("Sending a message", async function (assert) {
    await visit("/chat/channel/9/Site");
    const messageContent = "Here's a message";
    const composerInput = query(".chat-composer-input");
    assert.deepEqual(
      presentUserIds("/chat-reply/9"),
      [],
      "is not present before typing"
    );
    await fillIn(composerInput, messageContent);
    assert.deepEqual(
      presentUserIds("/chat-reply/9"),
      [User.current().id],
      "is present after typing"
    );
    await focus(composerInput);

    await triggerKeyEvent(composerInput, "keydown", 13); // 13 is enter keycode

    assert.equal(composerInput.innerText.trim(), "", "composer input cleared");

    assert.deepEqual(
      presentUserIds("/chat-reply/9"),
      [],
      "stops being present after sending message"
    );

    let messages = queryAll(".chat-message");
    let lastMessage = messages[messages.length - 1];

    // Message is staged, without an ID
    assert.ok(lastMessage.classList.contains("chat-message-staged"));

    // Last message was from a different user; full meta data is shown
    assert.ok(
      lastMessage.querySelector(".chat-user-avatar"),
      "Avatar is present"
    );
    assert.ok(lastMessage.querySelector(".full-name"), "Username is present");
    assert.equal(
      lastMessage.querySelector(".chat-message-text").innerText.trim(),
      messageContent
    );

    publishToMessageBus("/chat/9", {
      typ: "sent",
      stagedId: 1,
      chat_message: {
        id: 202,
        user: {
          id: 1,
        },
      },
    });

    // Wait for DOM to rerender. Message should be un-staged
    await chatSettled();

    assert.ok(
      lastMessage
        .closest(".chat-message-container")
        .classList.contains("chat-message-container-202")
    );
    assert.notOk(lastMessage.classList.contains("chat-message-staged"));

    const nextMessageContent = "What up what up!";
    await fillIn(composerInput, nextMessageContent);
    await focus(composerInput);
    await triggerKeyEvent(composerInput, "keydown", 13); // 13 is enter keycode

    messages = queryAll(".chat-message");
    lastMessage = messages[messages.length - 1];

    // We just sent a message so avatar/username will not be present for the last message
    assert.notOk(
      lastMessage.querySelector(".chat-user-avatar"),
      "Avatar is not shown"
    );
    assert.notOk(
      lastMessage.querySelector(".full-name"),
      "Username is not shown"
    );
    assert.equal(
      lastMessage.querySelector(".chat-message-text").innerText.trim(),
      nextMessageContent
    );
  });

  test("cooked processing messages are handled properly", async function (assert) {
    await visit("/chat/channel/9/Site");

    const cooked = "<h1>hello there</h1>";
    publishToMessageBus(`/chat/9`, {
      typ: "processed",
      chat_message: {
        cooked,
        id: 175,
      },
    });

    await chatSettled();
    assert.ok(
      query(
        ".chat-message-container-175 .chat-message-text"
      ).innerHTML.includes(cooked)
    );
  });

  test("Code highlighting in a message", async function (assert) {
    // TODO (martin) Remove this when we completely remove legacy ember tests
    if (isLegacyEmber()) {
      assert.equal(
        1,
        1,
        "skipping code highlighting test which does not work in legacy ember CI"
      );
      return;
    }

    await visit("/chat/channel/9/Site");
    const messageContent = `Here's a message with code highlighting

\`\`\`ruby
Widget.triangulate(arg: "test")
\`\`\``;
    const composerInput = query(".chat-composer-input");
    await fillIn(composerInput, messageContent);
    await focus(composerInput);
    await triggerKeyEvent(composerInput, "keydown", 13); // 13 is enter keycode

    publishToMessageBus("/chat/9", {
      typ: "sent",
      stagedId: 1,
      chat_message: {
        id: 202,
        cooked: `<pre><code class="lang-ruby">Widget.triangulate(arg: "test")
      </code></pre>`,
        user: {
          id: 1,
        },
      },
    });

    await chatSettled();

    const messages = queryAll(".chat-message");
    const lastMessage = messages[messages.length - 1];
    assert.ok(
      lastMessage
        .closest(".chat-message-container")
        .classList.contains("chat-message-container-202")
    );
    assert.ok(
      exists(
        ".chat-message-container-202 .chat-message-text.hljs-complete code.lang-ruby.hljs"
      ),
      "chat message code block has been highlighted as ruby code"
    );
  });

  test("Drafts are saved and reloaded", async function (assert) {
    await visit("/chat/channel/9/Site");
    await fillIn(".chat-composer-input", "Hi people");

    await visit("/chat/channel/75/@hawk");
    assert.equal(query(".chat-composer-input").value.trim(), "");
    await fillIn(".chat-composer-input", "What up what up");

    await visit("/chat/channel/9/Site");
    assert.equal(query(".chat-composer-input").value.trim(), "Hi people");
    await fillIn(".chat-composer-input", "");

    await visit("/chat/channel/75/@hawk");
    assert.equal(query(".chat-composer-input").value.trim(), "What up what up");

    // Send a message
    const composerTextarea = query(".chat-composer-input");
    await focus(composerTextarea);
    await triggerKeyEvent(composerTextarea, "keydown", 13); // 13 is enter keycode

    assert.equal(query(".chat-composer-input").value.trim(), "");

    // Navigate away and back to make sure input didn't re-fill
    await visit("/chat/channel/9/Site");
    await visit("/chat/channel/75/@hawk");
    assert.equal(query(".chat-composer-input").value.trim(), "");
  });

  test("Pressing escape cancels editing", async function (assert) {
    await visit("/chat/channel/9/Site");

    const dropdown = selectKit(".more-buttons");
    await dropdown.expand();
    await dropdown.selectRowByValue("edit");

    assert.ok(exists(".chat-composer .chat-composer-message-details"));
    await triggerKeyEvent(".chat-composer", "keydown", 27); // 27 is escape

    // chat-composer-message-details will be gone as no message is being edited
    assert.notOk(exists(".chat-composer .chat-composer-message-details"));
  });

  test("Unread indicator increments for public channels when messages come in", async function (assert) {
    await visit("/t/internationalization-localization/280");
    assert.notOk(
      exists(".header-dropdown-toggle.open-chat .chat-channel-unread-indicator")
    );

    publishToMessageBus("/chat/9/new-messages", {
      message_id: 201,
      user_id: 2,
    });
    await chatSettled();
    assert.ok(
      exists(".header-dropdown-toggle.open-chat .chat-channel-unread-indicator")
    );
  });

  test("Unread count increments for direct message channels when messages come in", async function (assert) {
    await visit("/t/internationalization-localization/280");
    assert.notOk(
      exists(
        ".header-dropdown-toggle.open-chat .chat-channel-unread-indicator.urgent .number"
      )
    );

    publishToMessageBus("/chat/75/new-messages", {
      message_id: 201,
      user_id: 2,
    });
    await chatSettled();
    assert.ok(
      exists(
        ".header-dropdown-toggle.open-chat .chat-channel-unread-indicator.urgent .number"
      )
    );
    assert.equal(
      query(
        ".header-dropdown-toggle.open-chat .chat-channel-unread-indicator.urgent .number"
      ).innerText.trim(),
      1
    );
  });

  test("Unread DM count overrides the public unread indicator", async function (assert) {
    await visit("/t/internationalization-localization/280");
    publishToMessageBus("/chat/9/new-messages", {
      message_id: 201,
      user_id: 2,
    });
    publishToMessageBus("/chat/75/new-messages", {
      message_id: 202,
      user_id: 2,
    });
    await chatSettled();
    assert.ok(
      exists(
        ".header-dropdown-toggle.open-chat .chat-channel-unread-indicator.urgent .number"
      )
    );
    assert.notOk(
      exists(
        ".header-dropdown-toggle.open-chat .chat-channel-unread-indicator:not(.urgent)"
      )
    );
  });

  test("Mentions in public channels show the unread urgent indicator", async function (assert) {
    await visit("/t/internationalization-localization/280");
    publishToMessageBus("/chat/9/new-mentions", {
      message_id: 201,
    });
    await chatSettled();
    assert.ok(
      exists(
        ".header-dropdown-toggle.open-chat .chat-channel-unread-indicator.urgent .number"
      )
    );
    assert.notOk(
      exists(
        ".header-dropdown-toggle.open-chat .chat-channel-unread-indicator:not(.urgent)"
      )
    );
  });

  test("message selection and live pane buttons for regular user", async function (assert) {
    updateCurrentUser({ admin: false, moderator: false });
    await visit("/chat/channel/9/Site");

    const firstMessage = query(".chat-message-container");
    const dropdown = selectKit(".chat-message-container .more-buttons");
    await dropdown.expand();
    await dropdown.selectRowByValue("selectMessage");

    assert.ok(firstMessage.classList.contains("selecting-messages"));
    assert.notOk(exists("#chat-move-to-topic-btn"));
    assert.ok(exists("#chat-quote-btn"));
  });

  test("message selection for 'move to topic'", async function (assert) {
    updateCurrentUser({ admin: true, moderator: true });
    await visit("/chat/channel/9/Site");

    const firstMessage = query(".chat-message-container");
    const dropdown = selectKit(".chat-message-container .more-buttons");
    await dropdown.expand();
    await dropdown.selectRowByValue("selectMessage");

    assert.ok(firstMessage.classList.contains("selecting-messages"));
    const moveToTopicBtn = query(".chat-live-pane #chat-move-to-topic-btn");
    assert.equal(
      moveToTopicBtn.disabled,
      false,
      "button is enabled as a message is selected"
    );

    await click(firstMessage.querySelector("input[type='checkbox']"));
    assert.equal(
      moveToTopicBtn.disabled,
      true,
      "button is disabled when no messages are selected"
    );

    await click(firstMessage.querySelector("input[type='checkbox']"));
    const allCheckboxes = queryAll(
      ".chat-message-container input[type='checkbox']"
    );

    await triggerEvent(allCheckboxes[allCheckboxes.length - 1], "click", {
      shiftKey: true,
    });
    assert.equal(
      queryAll(".chat-message-container input:checked").length,
      4,
      "Bulk message select works"
    );

    await click("#chat-move-to-topic-btn");
    assert.ok(exists(".move-chat-to-topic-modal"));
  });

  test("message selection is not present for regular user", async function (assert) {
    updateCurrentUser({ admin: false, moderator: false });
    await visit("/chat/channel/9/Site");
    assert.notOk(
      exists(".chat-message-container .chat-msgactions-hover .select-btn")
    );
  });

  test("creating a new direct message channel works", async function (assert) {
    await visit("/chat/channel/9/Site");
    await click(".new-dm");
    let users = selectKit(".dm-user-chooser");
    await click(".dm-user-chooser");
    await users.expand();
    await fillIn(".dm-user-chooser input.filter-input", "hawk");
    await users.selectRowByValue("hawk");
    await click("button.create-dm");
    assert.equal(currentURL(), "/chat/channel/75/@hawk");
    assert.notOk(
      query(".join-channel-btn"),
      "Join channel button is not present"
    );
  });

  test("Reacting works with no existing reactions", async function (assert) {
    await visit("/chat/channel/9/Site");
    const message = query(".chat-message-container");
    assert.notOk(message.querySelector(".chat-message-reaction-list"));
    await click(message.querySelector(".chat-msgactions .react-btn"));
    await click(message.querySelector(".emoji-picker .section-group .emoji"));

    assert.ok(message.querySelector(".chat-message-reaction-list"));
    const reaction = message.querySelector(
      ".chat-message-reaction-list .chat-message-reaction.reacted"
    );
    assert.ok(reaction);
    assert.equal(reaction.innerText.trim(), 1);
  });

  test("Reacting works with existing reactions", async function (assert) {
    await visit("/chat/channel/9/Site");
    const messages = queryAll(".chat-message-container");

    // First 2 messages have no reactions; make sure the list isn't rendered
    assert.notOk(messages[0].querySelector(".chat-message-reaction-list"));
    assert.notOk(messages[1].querySelector(".chat-message-reaction-list"));

    const lastMessage = messages[2];
    assert.ok(lastMessage.querySelector(".chat-message-reaction-list"));
    assert.equal(
      lastMessage.querySelectorAll(".chat-message-reaction.reacted").length,
      2
    );
    assert.equal(
      lastMessage.querySelectorAll(".chat-message-reaction:not(.reacted)")
        .length,
      1
    );

    // React with a heart and make sure the count increments and class is added
    const heartReaction = lastMessage.querySelector(
      ".chat-message-reaction.heart"
    );
    assert.equal(heartReaction.innerText.trim(), "1");
    await click(heartReaction);
    assert.equal(heartReaction.innerText.trim(), "2");
    assert.ok(heartReaction.classList.contains("reacted"));

    publishToMessageBus("/chat/9", {
      action: "add",
      user: { id: 1, username: "eviltrout" },
      emoji: "heart",
      typ: "reaction",
      chat_message_id: 176,
    });

    // Click again make sure count goes down
    await click(heartReaction);
    assert.equal(heartReaction.innerText.trim(), "1");
    assert.notOk(heartReaction.classList.contains("reacted"));

    // Message from another user coming in!
    publishToMessageBus("/chat/9", {
      action: "add",
      user: { id: 77, username: "rando" },
      emoji: "sneezing_face",
      typ: "reaction",
      chat_message_id: 176,
    });
    await chatSettled();
    const sneezingFaceReaction = lastMessage.querySelector(
      ".chat-message-reaction.sneezing_face"
    );
    assert.ok(sneezingFaceReaction);
    assert.equal(sneezingFaceReaction.innerText.trim(), "1");
    assert.notOk(sneezingFaceReaction.classList.contains("reacted"));
    await click(sneezingFaceReaction);
    assert.equal(sneezingFaceReaction.innerText.trim(), "2");
    assert.ok(sneezingFaceReaction.classList.contains("reacted"));
  });

  test("mention warning is rendered", async function (assert) {
    await visit("/chat/channel/9/Site");
    publishToMessageBus("/chat/9", {
      typ: "mention_warning",
      cannot_see: [{ id: 75, username: "hawk" }],
      without_membership: [
        { id: 76, username: "eviltrout" },
        { id: 77, username: "sam" },
      ],
      chat_message_id: 176,
    });
    await chatSettled();

    assert.ok(
      exists(".chat-message-container-176 .chat-message-mention-warning")
    );
    assert.ok(
      query(
        ".chat-message-container-176 .chat-message-mention-warning .cannot-see"
      ).innerText.includes("hawk")
    );

    const withoutMembershipText = query(
      ".chat-message-container-176 .chat-message-mention-warning .without-membership"
    ).innerText;
    assert.ok(withoutMembershipText.includes("eviltrout"));
    assert.ok(withoutMembershipText.includes("sam"));

    await click(
      ".chat-message-container-176 .chat-message-mention-warning .invite-link"
    );
    assert.notOk(
      exists(".chat-message-container-176 .chat-message-mention-warning")
    );
  });

  test("It displays a separator between days", async function (assert) {
    await visit("/chat/channel/9/Site");
    assert.equal(
      query(".first-daily-message").innerText.trim(),
      "July 22, 2021"
    );
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
      has_chat_enabled: true,
    });
    needs.settings({
      chat_enabled: true,
    });
    needs.pretender((server, helper) => {
      baseChatPretenders(server, helper);
      siteChannelPretender(server, helper);
      directMessageChannelPretender(server, helper);
      chatChannelPretender(server, helper, [
        { id: 7, unread_count: 2, muted: false },
      ]);
    });
    needs.hooks.beforeEach(function () {
      Object.defineProperty(this, "chatService", {
        get: () => this.container.lookup("service:chat"),
      });
    });

    test("Expand button takes you to full page chat on the correct channel", async function (assert) {
      await visit("/t/internationalization-localization/280");
      this.chatService.set("sidebarActive", false);
      await visit(".header-dropdown-toggle.open-chat");
      await click(".chat-full-screen-btn");
      const channelWithUnread = chatChannels.public_channels.findBy("id", 7);
      assert.equal(
        currentURL(),
        `/chat/channel/${channelWithUnread.id}/${channelWithUnread.title}`
      );
    });

    test("Chat opens to full-page channel with unread messages when sidebar is installed", async function (assert) {
      await visit("/t/internationalization-localization/280");
      this.chatService.set("sidebarActive", true);

      await click(".header-dropdown-toggle.open-chat");

      const channelWithUnread = chatChannels.public_channels.findBy("id", 7);
      assert.equal(
        currentURL(),
        `/chat/channel/${channelWithUnread.id}/${channelWithUnread.title}`
      );
      assert.notOk(
        visible(".topic-chat-float-container"),
        "chat float is not open"
      );
    });

    test("Chat float opens on header icon click when sidebar is not installed", async function (assert) {
      await visit("/t/internationalization-localization/280");
      this.chatService.set("sidebarActive", false);
      await click(".header-dropdown-toggle.open-chat");
      assert.ok(visible(".topic-chat-float-container"), "chat float is open");
    });

    test("Unread header indicator is present", async function (assert) {
      await visit("/t/internationalization-localization/280");

      assert.ok(
        exists(
          ".header-dropdown-toggle.open-chat .chat-channel-unread-indicator"
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
      has_chat_enabled: true,
    });
    needs.settings({
      chat_enabled: true,
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
    needs.hooks.beforeEach(function () {
      Object.defineProperty(this, "chatService", {
        get: () => this.container.lookup("service:chat"),
      });
    });

    test("Unread indicator doesn't show when user is in do not disturb", async function (assert) {
      let now = new Date();
      let later = new Date();
      later.setTime(now.getTime() + 600000);
      updateCurrentUser({ do_not_disturb_until: later.toUTCString() });
      await visit("/t/internationalization-localization/280");
      assert.notOk(
        exists(
          ".header-dropdown-toggle.open-chat .chat-unread-urgent-indicator"
        )
      );
    });

    test("Unread indicator doesn't show on homepage when user has chat_isolated", async function (assert) {
      updateCurrentUser({ chat_isolated: true });
      await visit("/t/internationalization-localization/280");
      assert.notOk(
        exists(
          ".header-dropdown-toggle.open-chat .chat-unread-urgent-indicator"
        )
      );
    });

    test("Unread indicator does show on chat page when use has chat_isolated", async function (assert) {
      updateCurrentUser({ chat_isolated: true });
      await visit("/chat/channel/9/Site");
      await click(".header-dropdown-toggle.open-chat"); // Force re-render. Flakey otherwise.
      assert.ok(
        exists(
          ".header-dropdown-toggle.open-chat .chat-channel-unread-indicator.urgent"
        )
      );
    });

    test("Chat float open to DM channel with unread messages with sidebar off", async function (assert) {
      await visit("/t/internationalization-localization/280");
      this.chatService.set("sidebarActive", false);
      await click(".header-dropdown-toggle.open-chat");
      const chatContainer = query(".topic-chat-container");
      assert.ok(chatContainer.classList.contains("channel-75"));
    });

    test("Chat full page open to DM channel with unread messages with sidebar on", async function (assert) {
      await visit("/t/internationalization-localization/280");
      this.chatService.set("sidebarActive", true);
      await click(".header-dropdown-toggle.open-chat");
      const channelWithUnread = chatChannels.direct_message_channels.find(
        (c) => c.id === 75
      );
      assert.equal(
        currentURL(),
        `/chat/channel/${channelWithUnread.id}/${channelWithUnread.title}`
      );
    });

    test("Exit full screen chat button takes you to previous non-chat location", async function (assert) {
      const nonChatPath = "/t/internationalization-localization/280";
      await visit(nonChatPath);
      await visit("/chat/channel/75/@hawk");
      await visit("/chat/channel/9/Site");
      await click(".exit-chat-btn");
      assert.equal(currentURL(), nonChatPath);
    });
  }
);

acceptance(
  "Discourse Chat - chat channel settings and creation",
  function (needs) {
    needs.user({
      admin: true,
      moderator: true,
      username: "eviltrout",
      id: 1,
      can_chat: true,
      has_chat_enabled: true,
    });
    needs.settings({
      chat_enabled: true,
    });
    needs.pretender((server, helper) => {
      baseChatPretenders(server, helper);
      chatChannelPretender(server, helper);
      server.get("/chat/chat_channels/all.json", () => {
        return helper.response(allChannels());
      });
      server.get("/chat/chat_channels/:chatChannelId", () => {
        return helper.response(siteChannel);
      });
      server.get("/chat/chat_channels/70", () => {
        return helper.response({
          chat_channel: {
            id: 70,
            name: "preview-me",
          },
        });
      });
      server.put("/chat/chat_channels", () => {
        return helper.response({
          chat_channel: {
            chatable: {},
            chatable_id: 88,
            chatable_type: "Category",
            chatable_url: null,
            id: 88,
            last_read_message_id: null,
            title: "Something",
            unread_count: 0,
            unread_mentions: 0,
            updated_at: "2021-11-08T21:26:05.710Z",
          },
        });
      });
    });

    test("previewing channel", async function (assert) {
      await visit("/chat/channel/70/preview-me");
      assert.ok(exists(".join-channel-btn"), "Join channel button is present");
      assert.equal(query(".chat-composer-row textarea").disabled, true);
    });

    test("Create channel modal", async function (assert) {
      await visit("/chat/channel/9/Site");
      const dropdown = selectKit(".edit-channels-dropdown");
      await dropdown.expand();
      await dropdown.selectRowByValue("browseChannels");

      assert.equal(currentURL(), "/chat/browse");
      await visit("/chat/channel/9/Site");
      await dropdown.expand();
      await dropdown.selectRowByValue("openCreateChannelModal");
      assert.ok(exists(".create-channel-modal-modal"));

      assert.ok(query(".create-channel-modal-modal .btn.create").disabled);
      let categories = selectKit(
        ".create-channel-modal-modal .category-chooser"
      );
      await categories.expand();
      await categories.selectRowByValue("6"); // Category 6 is "support"
      assert.equal(
        query(
          ".create-channel-modal-modal .create-channel-name-input"
        ).value.trim(),
        "support"
      );
      assert.notOk(query(".create-channel-modal-modal .btn.create").disabled);

      let types = selectKit(".create-channel-modal-modal .type-chooser");
      await types.expand();
      await types.selectRowByValue("topic");

      await fillIn("#choose-topic-title", "This is a test");
      const topicRow = query(".controls.existing-topic label");
      await click(topicRow);
      const topicTitle = topicRow
        .querySelector(".topic-title")
        .innerText.trim();
      assert.equal(
        query(
          ".create-channel-modal-modal .create-channel-name-input"
        ).value.trim(),
        topicTitle
      );
      assert.notOk(query(".create-channel-modal-modal .btn.create").disabled);

      await click(".create-channel-modal-modal .btn.create");
      assert.equal(currentURL(), "/chat/channel/88/Something");
    });
  }
);

acceptance("Discourse Chat - chat preferences", function (needs) {
  needs.user({
    admin: false,
    moderator: false,
    username: "eviltrout",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });
  needs.settings({
    chat_enabled: true,
  });
  needs.pretender((server, helper) => {
    baseChatPretenders(server, helper);
    siteChannelPretender(server, helper);
    directMessageChannelPretender(server, helper);
    chatChannelPretender(server, helper);
  });
  needs.hooks.beforeEach(function () {
    Object.defineProperty(this, "chatService", {
      get: () => this.container.lookup("service:chat"),
    });
  });

  test("Chat preferences route takes user to homepage when can_chat is false", async function (assert) {
    updateCurrentUser({ can_chat: false });
    await visit("/u/eviltrout/preferences/chat");
    assert.equal(currentURL(), "/latest");
  });

  test("There are all 4 settings shown", async function (assert) {
    this.chatService.set("sidebarActive", true);
    await visit("/u/eviltrout/preferences/chat");
    assert.equal(currentURL(), "/u/eviltrout/preferences/chat");
    assert.equal(queryAll(".chat-setting").length, 4);
  });

  test("The user can save the settings", async function (assert) {
    updateCurrentUser({ has_chat_enabled: false });
    const spy = sinon.spy(ajaxlib, "ajax");
    await visit("/u/eviltrout/preferences/chat");
    await click("#user_chat_enabled");
    await click("#user_chat_only_push_notifications");
    await click("#user_chat_isolated");
    await selectKit("#user_chat_sounds").expand();
    await selectKit("#user_chat_sounds").selectRowByValue("bell");

    await click(".save-changes");

    assert.ok(
      spy.calledWithMatch("/u/eviltrout.json", {
        data: {
          chat_enabled: true,
          chat_isolated: true,
          chat_sound: "bell",
          only_chat_push_notifications: true,
        },
        type: "PUT",
      }),
      "is able to save the chat preferences for the user"
    );
  });
});

acceptance("Discourse Chat - image uploads", function (needs) {
  needs.user({
    admin: false,
    moderator: false,
    username: "eviltrout",
    id: 1,
    can_chat: true,
    has_chat_enabled: true,
  });
  needs.settings({
    chat_enabled: true,
  });
  needs.pretender((server, helper) => {
    baseChatPretenders(server, helper);
    siteChannelPretender(server, helper);
    directMessageChannelPretender(server, helper);
    chatChannelPretender(server, helper);

    server.post(
      "/uploads.json",
      () => {
        return helper.response({
          extension: "jpeg",
          filesize: 126177,
          height: 800,
          human_filesize: "123 KB",
          id: 202,
          original_filename: "avatar.PNG.jpg",
          retain_hours: null,
          short_path: "/uploads/short-url/yoj8pf9DdIeHRRULyw7i57GAYdz.jpeg",
          short_url: "upload://yoj8pf9DdIeHRRULyw7i57GAYdz.jpeg",
          thumbnail_height: 320,
          thumbnail_width: 690,
          url:
            "//testbucket.s3.dualstack.us-east-2.amazonaws.com/original/1X/f1095d89269ff22e1818cf54b73e857261851019.jpeg",
          width: 1920,
        });
      },
      500 // this delay is important to slow down the uploads a bit so we can click elements in the UI like the cancel button
    );
  });

  // this times out in CI...of course
  skip("uploading files in chat works", async function (assert) {
    await visit("/t/internationalization-localization/280");
    this.container.lookup("service:chat").set("sidebarActive", false);
    await click(".header-dropdown-toggle.open-chat");

    assert.ok(visible(".topic-chat-float-container"), "chat float is open");

    const appEvents = loggedInUser().appEvents;
    const done = assert.async();

    appEvents.on("chat-composer:all-uploads-complete", () => {
      assert.strictEqual(
        queryAll(".chat-composer-input").val(),
        "![avatar.PNG|690x320](upload://yoj8pf9DdIeHRRULyw7i57GAYdz.jpeg)\n"
      );
      done();
    });

    appEvents.on("chat-composer:upload-started", () => {
      assert.strictEqual(
        queryAll(".chat-composer-input").val(),
        "[Uploading: avatar.png...]()\n"
      );
    });

    const image = createFile("avatar.png");
    appEvents.trigger("chat-composer:add-files", image);
  });
});

function createFile(name, type = "image/png") {
  // the blob content doesn't matter at all, just want it to be random-ish
  const file = new Blob([(Math.random() + 1).toString(36).substring(2)], {
    type,
  });
  file.name = name;
  return file;
}
