import {
  acceptance,
  count,
  exists,
  query,
  queryAll,
  visible,
} from "discourse/tests/helpers/qunit-helpers";
import { click, visit } from "@ember/test-helpers";
import { test } from "qunit";

const messageOneContent = "Hello world";
const messageTwoContent = "What upp";

acceptance("Discourse Chat - Acceptance Test", function (needs) {
  needs.user({ admin: false, moderator: false, id: 1, can_chat: true });
  needs.settings({
    topic_chat_enabled: true,
  });

  needs.pretender((server, helper) => {
    server.get("/chat/index.json", () =>
      helper.response([
        {
          chat_channels: [],
          chatable: null,
          chatable_id: -1,
          chatable_type: "Site",
          chatable_url: "http://localhost:3000",
          id: 9,
          title: "Site",
        },
        {
          id: 7,
          chatable_id: 1,
          chatable_type: "Category",
          chatable_url: "/c/uncategorized/1",
          title: "Uncategorized",
          chatable: {
            id: 1,
            name: "Uncategorized",
            color: "0088CC",
            text_color: "FFFFFF",
            slug: "uncategorized",
          },
          chat_channels: [
            {
              id: 4,
              chatable_id: 12,
              chatable_type: "Topic",
              chatable_url:
                "http://localhost:3000/t/small-action-testing-topic/12",
              title: "Small action - testing topic",
              chatable: {
                id: 12,
                title: "Small action - testing topic",
                fancy_title: "Small action - testing topic",
                slug: "small-action-testing-topic",
                posts_count: 1,
              },
              chat_channels: [],
            },
            {
              id: 11,
              chatable_id: 80,
              chatable_type: "Topic",
              chatable_url:
                "http://localhost:3000/t/coolest-thing-you-have-seen-today/80",
              title: "Coolest thing you have seen today",
              chatable: {
                id: 80,
                title: "Coolest thing you have seen today",
                fancy_title: "Coolest thing you have seen today",
                slug: "coolest-thing-you-have-seen-today",
                posts_count: 100,
              },
              chat_channels: [],
            },
          ],
        },
      ])
    );
    server.get("/chat/9/recent.json", () =>
      helper.response({
        topic_chat_view: {
          last_id: 0,
          can_chat: true,
          can_flag: true,
          can_delete_self: true,
          can_delete_others: false,
          messages: [
            {
              id: 174,
              message: messageOneContent,
              action_code: null,
              created_at: "2021-07-20T08:14:16.950Z",
              flag_count: 0,
              user: {
                id: 1,
                username: "markvanlan",
                name: null,
                avatar_template:
                  "/letter_avatar_proxy/v4/letter/m/48db29/{size}.png",
              },
            },
            {
              id: 175,
              message: messageTwoContent,
              action_code: null,
              created_at: "2021-07-20T08:14:22.043Z",
              in_reply_to_id: 174,
              flag_count: 0,
              user: {
                id: 2,
                username: "hawk",
                name: null,
                avatar_template:
                  "/letter_avatar_proxy/v4/letter/m/48db29/{size}.png",
              },
            },
          ],
        },
      })
    );
  });

  test("Chat float can be opened and channels are populated", async function (assert) {
    await visit("/t/internationalization-localization/280");
    await click("#toggle-hamburger-menu");
    await click(".widget-link.open-chat");

    assert.ok(visible(".topic-chat-float-container"), "chat float is visible");
    assert.equal(count(".chat-channel-row"), 4, "it shows chat channel rows");
  });
  const enterFirstChatChannel = async function () {
    await visit("/t/internationalization-localization/280");
    await click("#toggle-hamburger-menu");
    await click(".widget-link.open-chat");
    await click(".chat-channel-row");
  };

  test("Chat messages are populated when a channel is entered", async function (assert) {
    await enterFirstChatChannel();
    const messages = queryAll(".tc-message .tc-text");
    assert.equal(messages[0].textContent.trim(), messageOneContent);

    assert.equal(messages[1].textContent.trim(), messageTwoContent);
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

    assert.equal(query(".tc-composer-input").value.trim(), messageOneContent);
  });
});
